#!/usr/bin/env python3
"""Parse Prototype-style workbook and refresh JSON artifacts.

This parser intentionally uses only Python stdlib (zip+xml) so it runs in
restricted environments without extra dependencies.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import zipfile
import xml.etree.ElementTree as ET
from collections import Counter
from typing import Any, Dict, List, Optional, Tuple

NS = {
    "m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
    "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
    "pr": "http://schemas.openxmlformats.org/package/2006/relationships",
}


def col_to_num(col: str) -> int:
    num = 0
    for char in col:
        if "A" <= char <= "Z":
            num = num * 26 + ord(char) - 64
    return num


def split_ref(ref: str) -> Tuple[str, int]:
    match = re.match(r"([A-Z]+)(\d+)", ref)
    if not match:
        return "", 0
    return match.group(1), int(match.group(2))


def join_si_text(si: ET.Element) -> str:
    direct = si.find("m:t", NS)
    if direct is not None:
        return direct.text or ""
    return "".join((part.text or "") for part in si.findall(".//m:t", NS))


def parse_shared_strings(zf: zipfile.ZipFile) -> List[str]:
    if "xl/sharedStrings.xml" not in zf.namelist():
        return []

    root = ET.fromstring(zf.read("xl/sharedStrings.xml"))
    return [join_si_text(si) for si in root.findall("m:si", NS)]


def normalize_target(target: str) -> str:
    if target.startswith("xl/"):
        return target
    if target.startswith("worksheets/"):
        return f"xl/{target}"
    return f"xl/{target.replace('../', '')}"


def decode_value(cell: ET.Element, shared_strings: List[str]) -> Optional[str]:
    cell_type = cell.get("t")
    value_node = cell.find("m:v", NS)

    if cell_type == "s" and value_node is not None and value_node.text is not None:
        try:
            return shared_strings[int(value_node.text)]
        except Exception:
            return value_node.text

    if cell_type == "inlineStr":
        inline = cell.find("m:is/m:t", NS)
        return inline.text if inline is not None else ""

    if cell_type == "b" and value_node is not None:
        return "TRUE" if value_node.text == "1" else "FALSE"

    if value_node is not None:
        return value_node.text

    return None


def build_cell_payload(cell: ET.Element, shared_strings: List[str]) -> Dict[str, Any]:
    ref = cell.get("r", "")
    payload: Dict[str, Any] = {"ref": ref}

    formula_node = cell.find("m:f", NS)
    value_node = cell.find("m:v", NS)

    if formula_node is not None:
        payload["formula"] = (formula_node.text or "")
        payload["shared_si"] = formula_node.get("si")

    payload["value"] = decode_value(cell, shared_strings)
    payload["cached"] = value_node.text if value_node is not None else None

    return payload


def parse_sheet_comments_count(zf: zipfile.ZipFile, sheet_path: str) -> int:
    rels_path = f"xl/worksheets/_rels/{os.path.basename(sheet_path)}.rels"
    if rels_path not in zf.namelist():
        return 0

    rels_root = ET.fromstring(zf.read(rels_path))
    count = 0
    for rel in rels_root.findall("pr:Relationship", NS):
        rel_type = rel.get("Type", "")
        if rel_type.endswith("/comments"):
            target = normalize_target(rel.get("Target", ""))
            if target in zf.namelist():
                comments_root = ET.fromstring(zf.read(target))
                count += len(comments_root.findall("m:commentList/m:comment", NS))
    return count


def parse_sheet(
    zf: zipfile.ZipFile, sheet_name: str, sheet_path: str, shared_strings: List[str]
) -> Dict[str, Any]:
    root = ET.fromstring(zf.read(sheet_path))

    cells: Dict[str, Dict[str, Any]] = {}
    formula_count = 0
    hidden_rows: List[int] = []

    for row in root.findall("m:sheetData/m:row", NS):
        row_num = int(row.get("r", "0"))
        if row.get("hidden") == "1":
            hidden_rows.append(row_num)

        for cell in row.findall("m:c", NS):
            payload = build_cell_payload(cell, shared_strings)
            if "formula" in payload:
                formula_count += 1
            cells[payload["ref"]] = payload

    dimension_node = root.find("m:dimension", NS)
    dimension = dimension_node.get("ref") if dimension_node is not None else None

    data_validations = root.find("m:dataValidations", NS)
    data_validation_count = (
        len(data_validations.findall("m:dataValidation", NS))
        if data_validations is not None
        else 0
    )

    return {
        "name": sheet_name,
        "path": sheet_path,
        "root": root,
        "cells": cells,
        "dimension": dimension,
        "formula_count": formula_count,
        "comment_count": parse_sheet_comments_count(zf, sheet_path),
        "data_validation_count": data_validation_count,
        "hidden_rows": sorted(hidden_rows),
    }


def workbook_index(zf: zipfile.ZipFile) -> Tuple[List[Tuple[str, str]], List[Dict[str, Any]]]:
    workbook = ET.fromstring(zf.read("xl/workbook.xml"))
    rels = ET.fromstring(zf.read("xl/_rels/workbook.xml.rels"))
    rel_map = {rel.get("Id"): rel.get("Target") for rel in rels.findall("pr:Relationship", NS)}

    sheets: List[Tuple[str, str]] = []
    for sheet in workbook.findall("m:sheets/m:sheet", NS):
        sheet_name = sheet.get("name", "")
        rel_id = sheet.get(f"{{{NS['r']}}}id")
        target = rel_map.get(rel_id)
        if not target:
            continue
        sheets.append((sheet_name, normalize_target(target)))

    defined_names: List[Dict[str, Any]] = []
    dn_parent = workbook.find("m:definedNames", NS)
    if dn_parent is not None:
        for dn in dn_parent.findall("m:definedName", NS):
            defined_names.append(
                {
                    "name": dn.get("name"),
                    "localSheetId": dn.get("localSheetId"),
                    "text": dn.text or "",
                }
            )

    return sheets, defined_names


def get_value(sheet: Dict[str, Any], ref: str) -> Optional[Any]:
    cell = sheet["cells"].get(ref)
    if not cell:
        return None

    value = cell.get("value")
    if value is not None:
        return value

    cached = cell.get("cached")
    return cached


def get_formula(sheet: Dict[str, Any], ref: str) -> Optional[str]:
    cell = sheet["cells"].get(ref)
    if not cell:
        return None
    if "formula" in cell:
        return cell.get("formula") or ""
    return None


def normalize_compare(value: Optional[Any]) -> Optional[Any]:
    if value is None:
        return None

    if isinstance(value, (int, float)):
        return int(value) if float(value).is_integer() else round(float(value), 6)

    text = str(value).strip()
    if text in {"", "\xa0"}:
        return None

    try:
        number = float(text)
        return int(number) if number.is_integer() else round(number, 6)
    except Exception:
        return text


def build_sections(base_sheet: Dict[str, Any]) -> List[Dict[str, Any]]:
    sections: List[Dict[str, Any]] = []

    for ref, cell in base_sheet["cells"].items():
        col, row = split_ref(ref)
        if col != "E" or "formula" not in cell:
            continue

        formula = cell.get("formula") or ""
        range_match = re.match(r"SUM\(E(\d+):E(\d+)\)$", formula)
        single_match = re.match(r"SUM\(E(\d+)\)$", formula)

        if range_match:
            start_row = int(range_match.group(1))
            end_row = int(range_match.group(2))
        elif single_match:
            start_row = int(single_match.group(1))
            end_row = int(single_match.group(1))
        else:
            continue

        sections.append(
            {
                "header_row": row,
                "name": get_value(base_sheet, f"B{row}"),
                "crm_id": get_value(base_sheet, f"C{row}"),
                "start_row": start_row,
                "end_row": end_row,
            }
        )

    sections.sort(key=lambda entry: entry["header_row"])
    return sections


def build_service_items(base_sheet: Dict[str, Any], sections: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    seen_rows = set()
    services: List[Dict[str, Any]] = []

    for section in sections:
        for row in range(section["start_row"], section["end_row"] + 1):
            if row in seen_rows:
                continue
            seen_rows.add(row)

            name = get_value(base_sheet, f"B{row}")
            crm_id = get_value(base_sheet, f"C{row}")
            if name is None and crm_id is None:
                continue

            services.append(
                {
                    "row": row,
                    "section": section["name"],
                    "service_name": name,
                    "crm_id": crm_id,
                    "default_effort": get_value(base_sheet, f"D{row}"),
                    "template_S": get_value(base_sheet, f"E{row}"),
                    "template_M": get_value(base_sheet, f"F{row}"),
                    "template_L": get_value(base_sheet, f"G{row}"),
                    "template_Custom": get_value(base_sheet, f"H{row}"),
                    "template_Details": get_value(base_sheet, f"I{row}"),
                }
            )

    return services


def detect_layout(scenario_sheet: Dict[str, Any]) -> Tuple[str, str, str, Optional[str]]:
    h1 = get_value(scenario_sheet, "H1")
    j1 = get_value(scenario_sheet, "J1")

    if h1 == "Totals" and j1 == "Custom":
        return "extended", "J", "K", "H2"

    return "standard", "H", "I", None


def build_domain_model(
    sheets: Dict[str, Dict[str, Any]],
    sheet_order: List[str],
) -> Dict[str, Any]:
    if "Scenario Template" not in sheets:
        raise RuntimeError("Expected sheet 'Scenario Template' not found.")

    base_sheet = sheets["Scenario Template"]
    sections = build_sections(base_sheet)
    services = build_service_items(base_sheet, sections)

    scenarios: List[Dict[str, Any]] = []
    for name in sheet_order:
        if name in {"Max Engagement Quick Sizer", "Scenario Template"}:
            continue

        scenario_sheet = sheets[name]
        layout, custom_col, detail_col, totals_total_cell = detect_layout(scenario_sheet)

        overrides: List[Dict[str, Any]] = []

        for service in services:
            row = service["row"]
            current_values = {
                "S": get_value(scenario_sheet, f"E{row}"),
                "M": get_value(scenario_sheet, f"F{row}"),
                "L": get_value(scenario_sheet, f"G{row}"),
                "Custom": get_value(scenario_sheet, f"{custom_col}{row}"),
                "Details": get_value(scenario_sheet, f"{detail_col}{row}"),
            }

            changed = False
            for key, template_key in [
                ("S", "template_S"),
                ("M", "template_M"),
                ("L", "template_L"),
                ("Custom", "template_Custom"),
                ("Details", "template_Details"),
            ]:
                if normalize_compare(current_values[key]) != normalize_compare(service.get(template_key)):
                    changed = True
                    break

            if changed:
                overrides.append(
                    {
                        "row": row,
                        "service_name": service["service_name"],
                        "changes": current_values,
                    }
                )

        scenarios.append(
            {
                "name": name,
                "override_count": len(overrides),
                "overrides": overrides,
                "totals_row2": {
                    "S": get_value(scenario_sheet, "E2"),
                    "M": get_value(scenario_sheet, "F2"),
                    "L": get_value(scenario_sheet, "G2"),
                    "Custom": get_value(scenario_sheet, f"{custom_col}2"),
                    "layout": layout,
                    "custom_total_cell": f"{custom_col}2",
                    "totals_total_cell": totals_total_cell,
                },
            }
        )

    return {
        "sections": sections,
        "section_count": len(sections),
        "service_count": len(services),
        "service_items": services,
        "scenarios": scenarios,
        "scenario_count": len(scenarios),
    }


def build_totals_payload(
    sheets: Dict[str, Dict[str, Any]],
    sheet_order: List[str],
) -> Dict[str, Any]:
    main = sheets["Max Engagement Quick Sizer"]

    main_rows: List[Dict[str, Any]] = []
    for row in range(7, 31):
        row_payload: Dict[str, Any] = {"row": row}
        for col in ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "N"]:
            row_payload[col] = main["cells"].get(f"{col}{row}")
        main_rows.append(row_payload)

    scenario_totals: List[Dict[str, Any]] = []
    for name in sheet_order:
        if name == "Max Engagement Quick Sizer":
            continue

        sheet = sheets[name]
        hidden = set(sheet["hidden_rows"])
        visible_rows = len([row for row in range(1, 131) if row not in hidden])

        scenario_totals.append(
            {
                "scenario": name,
                "E2": sheet["cells"].get("E2"),
                "F2": sheet["cells"].get("F2"),
                "G2": sheet["cells"].get("G2"),
                "H2": sheet["cells"].get("H2"),
                "I2": sheet["cells"].get("I2"),
                "J2": sheet["cells"].get("J2"),
                "visible_rows": visible_rows,
            }
        )

    return {"scenario_totals": scenario_totals, "main_sheet_rows": main_rows}


def build_visibility_payload(
    sheets: Dict[str, Dict[str, Any]],
    sheet_order: List[str],
    sections: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    visibility: List[Dict[str, Any]] = []

    for name in sheet_order:
        if name == "Max Engagement Quick Sizer":
            continue

        sheet = sheets[name]
        hidden_rows = set(sheet["hidden_rows"])

        visible_sections: List[str] = []
        hidden_sections: List[str] = []
        visible_service_rows = 0

        for section in sections:
            header_row = section["header_row"]
            if header_row in hidden_rows:
                hidden_sections.append(section["name"])
            else:
                visible_sections.append(section["name"])

            for row in range(section["start_row"], section["end_row"] + 1):
                if row in hidden_rows:
                    continue
                if get_value(sheet, f"B{row}") is not None:
                    visible_service_rows += 1

        visibility.append(
            {
                "name": name,
                "hidden_rows_count": len(hidden_rows),
                "visible_service_rows": visible_service_rows,
                "visible_sections": visible_sections,
                "hidden_sections": hidden_sections,
                "hidden_rows_sorted": sorted(list(hidden_rows)),
            }
        )

    return visibility


def build_workbook_profile(
    sheets: Dict[str, Dict[str, Any]],
    sheet_order: List[str],
    defined_names: List[Dict[str, Any]],
) -> Dict[str, Any]:
    profile_sheets: List[Dict[str, Any]] = []
    for name in sheet_order:
        sheet = sheets[name]
        profile_sheets.append(
            {
                "name": name,
                "dimension": sheet["dimension"],
                "formula_cells": sheet["formula_count"],
                "comment_count": sheet["comment_count"],
                "data_validation_count": sheet["data_validation_count"],
                "hidden_rows_count": len(sheet["hidden_rows"]),
            }
        )

    return {
        "sheet_count": len(sheet_order),
        "sheet_names": sheet_order,
        "defined_names": defined_names,
        "sheets": profile_sheets,
    }


def write_json(path: str, payload: Any) -> None:
    with open(path, "w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2)


def run(input_path: str, output_dir: str, analysis_dir: Optional[str]) -> Dict[str, Any]:
    with zipfile.ZipFile(input_path) as workbook_zip:
        shared_strings = parse_shared_strings(workbook_zip)
        indexed_sheets, defined_names = workbook_index(workbook_zip)

        sheet_order = [name for name, _ in indexed_sheets]
        parsed_sheets: Dict[str, Dict[str, Any]] = {}
        for sheet_name, sheet_path in indexed_sheets:
            parsed_sheets[sheet_name] = parse_sheet(
                workbook_zip, sheet_name, sheet_path, shared_strings
            )

    domain_model = build_domain_model(parsed_sheets, sheet_order)
    totals_payload = build_totals_payload(parsed_sheets, sheet_order)
    visibility_payload = build_visibility_payload(
        parsed_sheets, sheet_order, domain_model["sections"]
    )
    workbook_profile = build_workbook_profile(parsed_sheets, sheet_order, defined_names)

    os.makedirs(output_dir, exist_ok=True)
    write_json(os.path.join(output_dir, "domain_model.json"), domain_model)
    write_json(os.path.join(output_dir, "totals.json"), totals_payload)
    write_json(os.path.join(output_dir, "visibility.json"), visibility_payload)
    write_json(os.path.join(output_dir, "workbook_profile.json"), workbook_profile)

    if analysis_dir:
        os.makedirs(analysis_dir, exist_ok=True)
        for artifact in [
            "domain_model.json",
            "totals.json",
            "visibility.json",
            "workbook_profile.json",
        ]:
            shutil.copy2(os.path.join(output_dir, artifact), os.path.join(analysis_dir, artifact))

    return {
        "input": os.path.abspath(input_path),
        "output_dir": os.path.abspath(output_dir),
        "sections": domain_model["section_count"],
        "services": domain_model["service_count"],
        "scenarios": domain_model["scenario_count"],
        "formula_cells": sum(sheet["formula_cells"] for sheet in workbook_profile["sheets"]),
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Import workbook data into JSON artifacts")
    parser.add_argument("--input", required=True, help="Path to XLSX file")
    parser.add_argument("--output-dir", required=True, help="Directory for data artifacts")
    parser.add_argument(
        "--analysis-dir",
        required=False,
        default=None,
        help="Optional secondary output directory for analysis copies",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    summary = run(args.input, args.output_dir, args.analysis_dir)
    print(json.dumps(summary))


if __name__ == "__main__":
    main()
