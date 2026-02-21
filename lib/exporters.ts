import {
  QuickSizerResult,
  ScenarioDrilldownResponse,
  Spread
} from "@/lib/types";

const PDF_PAGE_WIDTH = 842;
const PDF_PAGE_HEIGHT = 595;
const PDF_MARGIN_X = 30;
const PDF_MARGIN_TOP = 30;
const PDF_MARGIN_BOTTOM = 30;
const PDF_LINE_HEIGHT = 12;
const PDF_TITLE_OFFSET = 22;
const PDF_MAX_LINE_LENGTH = 150;

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  const text = String(value);
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function toCsv(rows: Array<Array<unknown>>): string {
  return rows.map((row) => row.map(csvEscape).join(",")).join("\n");
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

type EngagementCsvServiceDetail = {
  serviceName: string;
  sectionName: string | null;
  days: number;
};

export function buildEngagementCsv(args: {
  engagementName: string;
  customerName?: string | null;
  opportunity?: string | null;
  spread: Spread;
  result: QuickSizerResult;
  serviceSummaryByRow?: Record<number, string>;
  serviceDetailsByRow?: Record<number, EngagementCsvServiceDetail[]>;
}): string {
  const {
    engagementName,
    customerName,
    opportunity,
    spread,
    result,
    serviceSummaryByRow,
    serviceDetailsByRow
  } = args;

  const generatedAt = new Date().toISOString();

  const rows: Array<Array<unknown>> = [
    ["Document", "Max Success Plan Premium Services Quicksizer Export"],
    ["Generated At (UTC)", generatedAt],
    ["Engagement", engagementName],
    ["Customer", customerName ?? ""],
    ["Opportunity", opportunity ?? ""],
    ["Spread Y1 (%)", round2(spread.y1)],
    ["Spread Y2 (%)", round2(spread.y2)],
    ["Spread Y3 (%)", round2(spread.y3)],
    ["Spread Y4 (%)", round2(spread.y4)],
    ["Spread Y5 (%)", round2(spread.y5)],
    [],
    ["SCENARIO SUMMARY"],
    [
      "Scenario Row",
      "Scenario",
      "Sizing Mode",
      "Scenario Total Days",
      "Y1 Days",
      "Y2 Days",
      "Y3 Days",
      "Y4 Days",
      "Y5 Days",
      "Included Service Count",
      "Included Services"
    ]
  ];

  for (const row of result.rows) {
    const details = serviceDetailsByRow?.[row.row] ?? [];
    const serviceSummary =
      serviceSummaryByRow?.[row.row] ??
      (row.size === "Custom" ? "Custom service allocation" : "Preset package");

    rows.push([
      row.row,
      row.name,
      row.size,
      round2(row.selectedDays),
      round2(row.y1),
      round2(row.y2),
      round2(row.y3),
      round2(row.y4),
      round2(row.y5),
      details.length,
      serviceSummary
    ]);
  }

  rows.push([
    "GRAND TOTAL",
    "",
    "",
    round2(result.totals.selectedDays),
    round2(result.totals.y1),
    round2(result.totals.y2),
    round2(result.totals.y3),
    round2(result.totals.y4),
    round2(result.totals.y5),
    "",
    ""
  ]);

  rows.push([]);
  rows.push(["SERVICE ALLOCATION DETAIL"]);
  rows.push([
    "Scenario Row",
    "Scenario",
    "Sizing Mode",
    "Service",
    "Section",
    "Service Days",
    "Scenario Total Days"
  ]);

  for (const row of result.rows) {
    const details = serviceDetailsByRow?.[row.row] ?? [];

    if (!details.length) {
      const fallbackService =
        serviceSummaryByRow?.[row.row] ??
        (row.size === "Custom" ? "Custom service allocation" : "Preset package");
      rows.push([
        row.row,
        row.name,
        row.size,
        fallbackService,
        "-",
        round2(row.selectedDays),
        round2(row.selectedDays)
      ]);
      continue;
    }

    for (const detail of details) {
      rows.push([
        row.row,
        row.name,
        row.size,
        detail.serviceName,
        detail.sectionName ?? "",
        round2(detail.days),
        round2(row.selectedDays)
      ]);
    }

    rows.push(["", "", "", "Scenario Total", "", "", round2(row.selectedDays)]);
  }

  rows.push(["", "", "", "GRAND TOTAL", "", "", round2(result.totals.selectedDays)]);

  return `\uFEFF${toCsv(rows)}\n`;
}


export function buildScenarioCsv(
  drilldown: ScenarioDrilldownResponse,
  includeHiddenRows: boolean
): string {
  const rows: Array<Array<unknown>> = [
    ["Scenario", drilldown.scenario.name],
    ["Layout", drilldown.scenario.layout],
    ["Override Count", drilldown.scenario.overrideCount],
    ["Include Hidden", includeHiddenRows ? "Yes" : "No"],
    [],
    [
      "Section",
      "Row",
      "Service",
      "Visible",
      "Template S",
      "Template M",
      "Template L",
      "Template C",
      "Effective S",
      "Effective M",
      "Effective L",
      "Effective C",
      "Details",
      "Overrides"
    ]
  ];

  for (const section of drilldown.sections) {
    const services = includeHiddenRows
      ? section.services
      : section.services.filter((service) => service.visible);

    for (const service of services) {
      const overrideFlags = Object.entries(service.overrides)
        .filter(([, value]) => value)
        .map(([key]) => key)
        .join(",");

      rows.push([
        section.name,
        service.row,
        service.name,
        service.visible ? "Yes" : "No",
        service.template.S,
        service.template.M,
        service.template.L,
        service.template.Custom,
        service.effective.S,
        service.effective.M,
        service.effective.L,
        service.effective.Custom,
        service.effective.Details ?? "",
        overrideFlags
      ]);
    }
  }

  return toCsv(rows);
}

function toPdfSafeAscii(input: string): string {
  const collapsed = input.replace(/\r?\n/g, " ").replace(/\t/g, "  ");
  let out = "";
  for (const char of collapsed) {
    const code = char.charCodeAt(0);
    if (code >= 32 && code <= 126) {
      out += char;
    } else {
      out += "?";
    }
  }
  return out;
}

function escapePdfText(input: string): string {
  return toPdfSafeAscii(input)
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function wrapPdfLines(lines: string[]): string[] {
  const wrapped: string[] = [];

  for (const rawLine of lines) {
    const line = toPdfSafeAscii(rawLine);

    if (!line.length) {
      wrapped.push("");
      continue;
    }

    if (line.length <= PDF_MAX_LINE_LENGTH) {
      wrapped.push(line);
      continue;
    }

    let rest = line;
    while (rest.length > PDF_MAX_LINE_LENGTH) {
      let cut = rest.lastIndexOf(" ", PDF_MAX_LINE_LENGTH);
      if (cut < Math.floor(PDF_MAX_LINE_LENGTH * 0.5)) {
        cut = PDF_MAX_LINE_LENGTH;
      }
      wrapped.push(rest.slice(0, cut).trimEnd());
      rest = rest.slice(cut).trimStart();
    }

    if (rest.length) {
      wrapped.push(rest);
    }
  }

  return wrapped;
}

function buildPdfPageStream(title: string, lines: string[]): string {
  const commands: string[] = ["BT", "/F1 13 Tf"];
  let y = PDF_PAGE_HEIGHT - PDF_MARGIN_TOP;

  commands.push(`1 0 0 1 ${PDF_MARGIN_X} ${y} Tm`);
  commands.push(`(${escapePdfText(title)}) Tj`);

  y -= PDF_TITLE_OFFSET;
  commands.push("/F1 9 Tf");

  for (const line of lines) {
    commands.push(`1 0 0 1 ${PDF_MARGIN_X} ${y} Tm`);
    commands.push(`(${escapePdfText(line)}) Tj`);
    y -= PDF_LINE_HEIGHT;
  }

  commands.push("ET");
  return commands.join("\n");
}

export async function buildSimplePdf(
  title: string,
  lines: string[]
): Promise<Uint8Array> {
  const bodyLines = wrapPdfLines(lines);
  const linesPerPage = Math.max(
    1,
    Math.floor(
      (PDF_PAGE_HEIGHT -
        PDF_MARGIN_TOP -
        PDF_MARGIN_BOTTOM -
        PDF_TITLE_OFFSET) /
        PDF_LINE_HEIGHT
    )
  );

  const pages: string[][] = [];
  for (let start = 0; start < bodyLines.length; start += linesPerPage) {
    pages.push(bodyLines.slice(start, start + linesPerPage));
  }
  if (!pages.length) {
    pages.push([]);
  }

  const pageObjectIds: number[] = [];
  const contentObjectIds: number[] = [];
  let nextObjectId = 3;
  for (let index = 0; index < pages.length; index += 1) {
    pageObjectIds.push(nextObjectId);
    nextObjectId += 1;
    contentObjectIds.push(nextObjectId);
    nextObjectId += 1;
  }
  const fontObjectId = nextObjectId;
  const objectCount = fontObjectId;

  const objectBodies = new Map<number, string>();
  objectBodies.set(1, "<< /Type /Catalog /Pages 2 0 R >>");
  objectBodies.set(
    2,
    `<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>`
  );

  for (let index = 0; index < pages.length; index += 1) {
    const pageTitle =
      pages.length > 1
        ? `${title} (Page ${index + 1}/${pages.length})`
        : title;
    const stream = buildPdfPageStream(pageTitle, pages[index]);
    const streamLength = Buffer.byteLength(stream, "ascii");
    const pageObjectId = pageObjectIds[index];
    const contentObjectId = contentObjectIds[index];

    objectBodies.set(
      pageObjectId,
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PDF_PAGE_WIDTH} ${PDF_PAGE_HEIGHT}] /Resources << /Font << /F1 ${fontObjectId} 0 R >> >> /Contents ${contentObjectId} 0 R >>`
    );
    objectBodies.set(
      contentObjectId,
      `<< /Length ${streamLength} >>\nstream\n${stream}\nendstream`
    );
  }

  objectBodies.set(
    fontObjectId,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"
  );

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [0];

  for (let id = 1; id <= objectCount; id += 1) {
    const body = objectBodies.get(id);
    if (!body) {
      throw new Error(`Missing PDF object body for id ${id}.`);
    }
    offsets[id] = Buffer.byteLength(pdf, "ascii");
    pdf += `${id} 0 obj\n${body}\nendobj\n`;
  }

  const xrefOffset = Buffer.byteLength(pdf, "ascii");
  pdf += `xref\n0 ${objectCount + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let id = 1; id <= objectCount; id += 1) {
    pdf += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  }

  pdf += `trailer\n<< /Size ${objectCount + 1} /Root 1 0 R >>\n`;
  pdf += `startxref\n${xrefOffset}\n%%EOF\n`;

  return Uint8Array.from(Buffer.from(pdf, "ascii"));
}

export function buildEngagementPdfLines(args: {
  engagementName: string;
  customerName?: string | null;
  opportunity?: string | null;
  spread: Spread;
  result: QuickSizerResult;
}): string[] {
  const { engagementName, customerName, opportunity, spread, result } = args;

  const lines: string[] = [];
  lines.push(`Engagement: ${engagementName}`);
  lines.push(`Customer: ${customerName ?? "-"}`);
  lines.push(`Opportunity: ${opportunity ?? "-"}`);
  lines.push(
    `Spread: Y1=${round2(spread.y1)}% Y2=${round2(spread.y2)}% Y3=${round2(spread.y3)}% Y4=${round2(spread.y4)}% Y5=${round2(spread.y5)}%`
  );
  lines.push("");
  lines.push("Row | Scenario | Size | Selected | Y1 | Y2 | Y3 | Y4 | Y5");

  for (const row of result.rows) {
    lines.push(
      `${row.row} | ${row.name} | ${row.size} | ${round2(row.selectedDays)} | ${round2(row.y1)} | ${round2(row.y2)} | ${round2(row.y3)} | ${round2(row.y4)} | ${round2(row.y5)}`
    );
  }

  lines.push("");
  lines.push(
    `Totals | Selected=${round2(result.totals.selectedDays)} | Y1=${round2(result.totals.y1)} | Y2=${round2(result.totals.y2)} | Y3=${round2(result.totals.y3)} | Y4=${round2(result.totals.y4)} | Y5=${round2(result.totals.y5)}`
  );

  return lines;
}

export function buildScenarioPdfLines(
  drilldown: ScenarioDrilldownResponse,
  includeHiddenRows: boolean
): string[] {
  const lines: string[] = [];

  lines.push(`Scenario: ${drilldown.scenario.name}`);
  lines.push(`Layout: ${drilldown.scenario.layout}`);
  lines.push(`Override Count: ${drilldown.scenario.overrideCount}`);
  lines.push(`Include Hidden Rows: ${includeHiddenRows ? "Yes" : "No"}`);
  lines.push("");

  for (const section of drilldown.sections) {
    lines.push(
      `[Section] ${section.name} :: Visible S/M/L/C = ${round2(section.visibleTotals.S)}/${round2(section.visibleTotals.M)}/${round2(section.visibleTotals.L)}/${round2(section.visibleTotals.Custom)}`
    );

    const services = includeHiddenRows
      ? section.services
      : section.services.filter((service) => service.visible);

    for (const service of services) {
      const overrideFlags = Object.entries(service.overrides)
        .filter(([, value]) => value)
        .map(([key]) => key)
        .join(",");

      lines.push(
        `  row ${service.row} | ${service.name} | vis=${service.visible ? "Y" : "N"} | eff=${service.effective.S ?? "-"}/${service.effective.M ?? "-"}/${service.effective.L ?? "-"}/${service.effective.Custom ?? "-"} | ov=${overrideFlags || "-"}`
      );
    }

    lines.push("");
  }

  return lines;
}

type EngagementReportRowVariant = "service" | "scenarioTotal" | "grandTotal" | "empty";

type EngagementReportRow = {
  rowLabel: string;
  scenario: string;
  size: string;
  service: string;
  section: string;
  days: number;
  variant: EngagementReportRowVariant;
};

type Alignment = "left" | "center" | "right";

type EngagementReportColumn = {
  key: keyof Pick<EngagementReportRow, "rowLabel" | "scenario" | "size" | "service" | "section" | "days">;
  label: string;
  width: number;
  align: Alignment;
};

type PreparedEngagementReportRow = EngagementReportRow & {
  scenarioLines: string[];
  serviceLines: string[];
  sectionLines: string[];
  rowHeight: number;
};

const REPORT_COLUMNS: EngagementReportColumn[] = [
  { key: "rowLabel", label: "#", width: 30, align: "center" },
  { key: "scenario", label: "Scenario", width: 196, align: "left" },
  { key: "size", label: "Size", width: 46, align: "center" },
  { key: "service", label: "Service", width: 188, align: "left" },
  { key: "section", label: "Section", width: 176, align: "left" },
  { key: "days", label: "Days", width: 76, align: "right" }
];

const REPORT_TABLE_X = 32;
const REPORT_TABLE_HEADER_HEIGHT = 18;
const REPORT_TABLE_TOP_Y = PDF_PAGE_HEIGHT - 204;
const REPORT_TABLE_BOTTOM_Y = 34;
const REPORT_ROW_FONT_SIZE = 8;
const REPORT_ROW_LINE_HEIGHT = 8.8;
const REPORT_CELL_PADDING_X = 4;

function formatReportNumber(value: number): string {
  const rounded = round2(value);
  return rounded.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function wrapPdfCellText(
  input: string,
  maxChars: number,
  maxLines: number,
  emptyPlaceholder = "-"
): string[] {
  const safe = toPdfSafeAscii(input).replace(/\s+/g, " ").trim();
  if (!safe) {
    return [emptyPlaceholder];
  }

  const wrapped: string[] = [];
  let rest = safe;

  while (rest.length > maxChars) {
    let cut = rest.lastIndexOf(" ", maxChars);
    if (cut < Math.floor(maxChars * 0.55)) {
      cut = maxChars;
    }

    wrapped.push(rest.slice(0, cut).trimEnd());
    rest = rest.slice(cut).trimStart();
  }

  if (rest.length) {
    wrapped.push(rest);
  }

  if (wrapped.length <= maxLines) {
    return wrapped;
  }

  const clipped = wrapped.slice(0, maxLines);
  const lastIndex = maxLines - 1;
  const last = clipped[lastIndex];
  clipped[lastIndex] =
    last.length > maxChars - 3
      ? `${last.slice(0, Math.max(0, maxChars - 3)).trimEnd()}...`
      : `${last}...`;

  return clipped;
}

function estimatePdfTextWidth(text: string, fontSize: number): number {
  return toPdfSafeAscii(text).length * (fontSize * 0.48);
}

function resolveCellTextX(args: {
  colX: number;
  colWidth: number;
  align: Alignment;
  text: string;
  fontSize: number;
  padding?: number;
}): number {
  const { colX, colWidth, align, text, fontSize, padding = REPORT_CELL_PADDING_X } = args;

  if (align === "left") {
    return colX + padding;
  }

  const width = estimatePdfTextWidth(text, fontSize);

  if (align === "right") {
    return colX + colWidth - width - padding;
  }

  return colX + (colWidth - width) / 2;
}

function buildEngagementReportRows(args: {
  result: QuickSizerResult;
  serviceSummaryByRow?: Record<number, string>;
  serviceDetailsByRow?: Record<number, EngagementCsvServiceDetail[]>;
}): EngagementReportRow[] {
  const { result, serviceSummaryByRow, serviceDetailsByRow } = args;
  const reportRows: EngagementReportRow[] = [];

  for (const row of result.rows) {
    const details = serviceDetailsByRow?.[row.row] ?? [];
    const fallbackSummary =
      serviceSummaryByRow?.[row.row] ??
      (row.size === "Custom" ? "Custom service allocation" : "Preset package");

    if (!details.length) {
      reportRows.push({
        rowLabel: String(row.row),
        scenario: row.name,
        size: row.size,
        service: fallbackSummary,
        section: "-",
        days: row.selectedDays,
        variant: "empty"
      });
    } else {
      details.forEach((detail, index) => {
        reportRows.push({
          rowLabel: index === 0 ? String(row.row) : "",
          scenario: index === 0 ? row.name : "",
          size: index === 0 ? row.size : "",
          service: detail.serviceName,
          section: detail.sectionName ?? "-",
          days: detail.days,
          variant: "service"
        });
      });
    }

    reportRows.push({
      rowLabel: "",
      scenario: "",
      size: "",
      service: "Scenario Total",
      section: row.name,
      days: row.selectedDays,
      variant: "scenarioTotal"
    });
  }

  reportRows.push({
    rowLabel: "",
    scenario: "",
    size: "",
    service: "Grand Total",
    section: "",
    days: result.totals.selectedDays,
    variant: "grandTotal"
  });

  return reportRows;
}

function prepareEngagementReportRows(rows: EngagementReportRow[]): PreparedEngagementReportRow[] {
  return rows.map((row) => {
    const scenarioLines = wrapPdfCellText(row.scenario, 36, 3, "");
    const serviceLines = wrapPdfCellText(row.service, 34, 3, "");
    const sectionLines = wrapPdfCellText(row.section, 32, 3, "");
    const lineCount = Math.max(1, scenarioLines.length, serviceLines.length, sectionLines.length);

    return {
      ...row,
      scenarioLines,
      serviceLines,
      sectionLines,
      rowHeight: Math.max(16, 8 + lineCount * REPORT_ROW_LINE_HEIGHT)
    };
  });
}

function paginateEngagementReportRows(
  rows: PreparedEngagementReportRow[]
): PreparedEngagementReportRow[][] {
  const usableHeight = REPORT_TABLE_TOP_Y - REPORT_TABLE_HEADER_HEIGHT - REPORT_TABLE_BOTTOM_Y;
  const pages: PreparedEngagementReportRow[][] = [];
  let current: PreparedEngagementReportRow[] = [];
  let usedHeight = 0;

  for (const row of rows) {
    if (current.length > 0 && usedHeight + row.rowHeight > usableHeight) {
      pages.push(current);
      current = [];
      usedHeight = 0;
    }

    current.push(row);
    usedHeight += row.rowHeight;
  }

  if (!current.length) {
    pages.push([]);
  } else {
    pages.push(current);
  }

  return pages;
}


function drawPdfText(args: {
  commands: string[];
  text: string;
  x: number;
  y: number;
  size: number;
  font?: "F1" | "F2";
  color?: [number, number, number];
}) {
  const { commands, text, x, y, size, font = "F1", color = [0.1, 0.17, 0.28] } = args;

  commands.push("BT");
  commands.push(`/${font} ${size} Tf`);
  commands.push(`${color[0]} ${color[1]} ${color[2]} rg`);
  commands.push(`1 0 0 1 ${round2(x)} ${round2(y)} Tm`);
  commands.push(`(${escapePdfText(text)}) Tj`);
  commands.push("ET");
}

function drawPdfLine(args: {
  commands: string[];
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color?: [number, number, number];
  width?: number;
}) {
  const { commands, x1, y1, x2, y2, color = [0.78, 0.83, 0.9], width = 0.6 } = args;

  commands.push(`${color[0]} ${color[1]} ${color[2]} RG`);
  commands.push(`${width} w`);
  commands.push(`${round2(x1)} ${round2(y1)} m`);
  commands.push(`${round2(x2)} ${round2(y2)} l`);
  commands.push("S");
}

function drawPdfFillRect(args: {
  commands: string[];
  x: number;
  y: number;
  width: number;
  height: number;
  color: [number, number, number];
}) {
  const { commands, x, y, width, height, color } = args;
  commands.push(`${color[0]} ${color[1]} ${color[2]} rg`);
  commands.push(`${round2(x)} ${round2(y)} ${round2(width)} ${round2(height)} re`);
  commands.push("f");
}

function buildEngagementReportPageStream(args: {
  engagementName: string;
  customerName?: string | null;
  opportunity?: string | null;
  spread: Spread;
  rows: PreparedEngagementReportRow[];
  totals: QuickSizerResult["totals"];
  generatedAtLabel: string;
  pageIndex: number;
  pageCount: number;
}): string {
  const {
    engagementName,
    customerName,
    opportunity,
    spread,
    rows,
    totals,
    generatedAtLabel,
    pageIndex,
    pageCount
  } = args;

  const tableWidth = REPORT_COLUMNS.reduce((sum, col) => sum + col.width, 0);
  const tableRightX = REPORT_TABLE_X + tableWidth;
  const headerBottomY = REPORT_TABLE_TOP_Y - REPORT_TABLE_HEADER_HEIGHT;

  const commands: string[] = [];

  drawPdfFillRect({
    commands,
    x: REPORT_TABLE_X,
    y: PDF_PAGE_HEIGHT - 26,
    width: tableWidth,
    height: 3,
    color: [0.04, 0.43, 0.82]
  });

  drawPdfText({
    commands,
    text: "Max Success Plan Premium Services Quicksizer",
    x: REPORT_TABLE_X,
    y: PDF_PAGE_HEIGHT - 43,
    size: 15,
    font: "F2",
    color: [0.05, 0.26, 0.52]
  });

  const planLine = wrapPdfCellText(`Plan: ${engagementName}`, 96, 1)[0];
  drawPdfText({
    commands,
    text: planLine,
    x: REPORT_TABLE_X,
    y: PDF_PAGE_HEIGHT - 58,
    size: 9.6,
    font: "F2",
    color: [0.18, 0.27, 0.41]
  });

  drawPdfText({
    commands,
    text: `Generated ${generatedAtLabel} | Page ${pageIndex + 1} of ${pageCount}`,
    x: REPORT_TABLE_X,
    y: PDF_PAGE_HEIGHT - 71,
    size: 8.3,
    color: [0.34, 0.43, 0.55]
  });

  const infoBoxY = PDF_PAGE_HEIGHT - 150;
  drawPdfFillRect({
    commands,
    x: REPORT_TABLE_X,
    y: infoBoxY,
    width: tableWidth,
    height: 62,
    color: [0.95, 0.98, 1]
  });

  drawPdfText({
    commands,
    text: `Customer: ${customerName ?? "-"}`,
    x: REPORT_TABLE_X + 8,
    y: infoBoxY + 44,
    size: 8.5,
    font: "F2"
  });

  drawPdfText({
    commands,
    text: `Opportunity: ${opportunity ?? "-"}`,
    x: REPORT_TABLE_X + 8,
    y: infoBoxY + 31,
    size: 8.5
  });

  drawPdfText({
    commands,
    text: `Spread %: Y1 ${formatReportNumber(spread.y1)}  Y2 ${formatReportNumber(spread.y2)}  Y3 ${formatReportNumber(spread.y3)}  Y4 ${formatReportNumber(spread.y4)}  Y5 ${formatReportNumber(spread.y5)}`,
    x: REPORT_TABLE_X + 8,
    y: infoBoxY + 18,
    size: 8.5
  });

  drawPdfFillRect({
    commands,
    x: REPORT_TABLE_X,
    y: infoBoxY + 2,
    width: tableWidth,
    height: 12,
    color: [0.9, 0.95, 1]
  });

  drawPdfText({
    commands,
    text: `Totals: Days ${formatReportNumber(totals.selectedDays)}  |  Y1 ${formatReportNumber(totals.y1)}  Y2 ${formatReportNumber(totals.y2)}  Y3 ${formatReportNumber(totals.y3)}  Y4 ${formatReportNumber(totals.y4)}  Y5 ${formatReportNumber(totals.y5)}`,
    x: REPORT_TABLE_X + 8,
    y: infoBoxY + 5,
    size: 8.4,
    font: "F2",
    color: [0.06, 0.29, 0.56]
  });

  drawPdfFillRect({
    commands,
    x: REPORT_TABLE_X,
    y: headerBottomY,
    width: tableWidth,
    height: REPORT_TABLE_HEADER_HEIGHT,
    color: [0.91, 0.95, 1]
  });

  let headerX = REPORT_TABLE_X;
  for (const col of REPORT_COLUMNS) {
    const headerTextX = resolveCellTextX({
      colX: headerX,
      colWidth: col.width,
      align: col.align,
      text: col.label,
      fontSize: 8,
      padding: 3
    });

    drawPdfText({
      commands,
      text: col.label,
      x: headerTextX,
      y: headerBottomY + 5,
      size: 8,
      font: "F2",
      color: [0.14, 0.24, 0.37]
    });

    headerX += col.width;
  }

  let rowTopY = headerBottomY;

  if (!rows.length) {
    const emptyRowBottomY = rowTopY - 18;

    drawPdfFillRect({
      commands,
      x: REPORT_TABLE_X,
      y: emptyRowBottomY,
      width: tableWidth,
      height: 18,
      color: [0.98, 0.99, 1]
    });

    drawPdfText({
      commands,
      text: "No selected scenario rows to export.",
      x: REPORT_TABLE_X + 8,
      y: emptyRowBottomY + 6,
      size: 8.2,
      color: [0.34, 0.43, 0.55]
    });

    drawPdfLine({
      commands,
      x1: REPORT_TABLE_X,
      y1: emptyRowBottomY,
      x2: tableRightX,
      y2: emptyRowBottomY,
      color: [0.85, 0.89, 0.94]
    });

    rowTopY = emptyRowBottomY;
  } else {
    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];
      const rowBottomY = rowTopY - row.rowHeight;
      const isScenarioTotal = row.variant === "scenarioTotal";
      const isGrandTotal = row.variant === "grandTotal";

      if (isGrandTotal) {
        drawPdfFillRect({
          commands,
          x: REPORT_TABLE_X,
          y: rowBottomY,
          width: tableWidth,
          height: row.rowHeight,
          color: [0.83, 0.92, 1]
        });
      } else if (isScenarioTotal) {
        drawPdfFillRect({
          commands,
          x: REPORT_TABLE_X,
          y: rowBottomY,
          width: tableWidth,
          height: row.rowHeight,
          color: [0.93, 0.97, 1]
        });
      } else if (index % 2 === 1) {
        drawPdfFillRect({
          commands,
          x: REPORT_TABLE_X,
          y: rowBottomY,
          width: tableWidth,
          height: row.rowHeight,
          color: [0.98, 0.99, 1]
        });
      }

      let colX = REPORT_TABLE_X;
      for (const col of REPORT_COLUMNS) {
        if (col.key === "scenario") {
          const firstLineY = rowTopY - 10;
          for (let lineIndex = 0; lineIndex < row.scenarioLines.length; lineIndex += 1) {
            const text = row.scenarioLines[lineIndex];
            if (!text) {
              continue;
            }
            drawPdfText({
              commands,
              text,
              x: colX + REPORT_CELL_PADDING_X,
              y: firstLineY - lineIndex * REPORT_ROW_LINE_HEIGHT,
              size: REPORT_ROW_FONT_SIZE,
              font: isGrandTotal || isScenarioTotal ? "F2" : "F1",
              color: [0.16, 0.22, 0.32]
            });
          }
        } else if (col.key === "service") {
          const firstLineY = rowTopY - 10;
          for (let lineIndex = 0; lineIndex < row.serviceLines.length; lineIndex += 1) {
            const text = row.serviceLines[lineIndex];
            if (!text) {
              continue;
            }
            drawPdfText({
              commands,
              text,
              x: colX + REPORT_CELL_PADDING_X,
              y: firstLineY - lineIndex * REPORT_ROW_LINE_HEIGHT,
              size: REPORT_ROW_FONT_SIZE,
              font: isGrandTotal || isScenarioTotal ? "F2" : "F1",
              color: [0.16, 0.22, 0.32]
            });
          }
        } else if (col.key === "section") {
          const firstLineY = rowTopY - 10;
          for (let lineIndex = 0; lineIndex < row.sectionLines.length; lineIndex += 1) {
            const text = row.sectionLines[lineIndex];
            if (!text) {
              continue;
            }
            drawPdfText({
              commands,
              text,
              x: colX + REPORT_CELL_PADDING_X,
              y: firstLineY - lineIndex * REPORT_ROW_LINE_HEIGHT,
              size: REPORT_ROW_FONT_SIZE,
              font: isGrandTotal || isScenarioTotal ? "F2" : "F1",
              color: [0.16, 0.22, 0.32]
            });
          }
        } else {
          const rawValue = col.key === "days" ? row.days : row[col.key];
          const text =
            typeof rawValue === "number" ? formatReportNumber(rawValue) : String(rawValue ?? "");

          const textX = resolveCellTextX({
            colX,
            colWidth: col.width,
            align: col.align,
            text,
            fontSize: REPORT_ROW_FONT_SIZE
          });

          drawPdfText({
            commands,
            text,
            x: textX,
            y: rowBottomY + row.rowHeight / 2 - 3,
            size: REPORT_ROW_FONT_SIZE,
            font:
              isGrandTotal ||
              isScenarioTotal ||
              col.key === "size" ||
              (col.key === "days" && row.variant !== "service")
                ? "F2"
                : "F1",
            color: [0.16, 0.22, 0.32]
          });
        }

        colX += col.width;
      }

      drawPdfLine({
        commands,
        x1: REPORT_TABLE_X,
        y1: rowBottomY,
        x2: tableRightX,
        y2: rowBottomY,
        color: [0.85, 0.89, 0.94]
      });

      rowTopY = rowBottomY;
    }
  }

  drawPdfLine({
    commands,
    x1: REPORT_TABLE_X,
    y1: REPORT_TABLE_TOP_Y,
    x2: tableRightX,
    y2: REPORT_TABLE_TOP_Y
  });

  drawPdfLine({
    commands,
    x1: REPORT_TABLE_X,
    y1: headerBottomY,
    x2: tableRightX,
    y2: headerBottomY
  });

  let gridX = REPORT_TABLE_X;
  drawPdfLine({
    commands,
    x1: gridX,
    y1: REPORT_TABLE_TOP_Y,
    x2: gridX,
    y2: rowTopY
  });

  for (const col of REPORT_COLUMNS) {
    gridX += col.width;
    drawPdfLine({
      commands,
      x1: gridX,
      y1: REPORT_TABLE_TOP_Y,
      x2: gridX,
      y2: rowTopY
    });
  }

  drawPdfText({
    commands,
    text: "Generated by Max Success Plan Premium Services Quicksizer",
    x: REPORT_TABLE_X,
    y: 16,
    size: 7.8,
    color: [0.44, 0.5, 0.6]
  });

  drawPdfText({
    commands,
    text: `Page ${pageIndex + 1} of ${pageCount}`,
    x: tableRightX - 58,
    y: 16,
    size: 7.8,
    color: [0.44, 0.5, 0.6]
  });

  return commands.join("\n");
}


function buildPdfWithTwoFonts(pageStreams: string[]): Uint8Array {
  const pageObjectIds: number[] = [];
  const contentObjectIds: number[] = [];

  let nextObjectId = 3;
  for (let index = 0; index < pageStreams.length; index += 1) {
    pageObjectIds.push(nextObjectId);
    nextObjectId += 1;
    contentObjectIds.push(nextObjectId);
    nextObjectId += 1;
  }

  const regularFontObjectId = nextObjectId;
  nextObjectId += 1;
  const boldFontObjectId = nextObjectId;
  const objectCount = boldFontObjectId;

  const objectBodies = new Map<number, string>();
  objectBodies.set(1, "<< /Type /Catalog /Pages 2 0 R >>");
  objectBodies.set(
    2,
    `<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageStreams.length} >>`
  );

  for (let index = 0; index < pageStreams.length; index += 1) {
    const pageObjectId = pageObjectIds[index];
    const contentObjectId = contentObjectIds[index];
    const stream = pageStreams[index];
    const streamLength = Buffer.byteLength(stream, "ascii");

    objectBodies.set(
      pageObjectId,
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PDF_PAGE_WIDTH} ${PDF_PAGE_HEIGHT}] /Resources << /Font << /F1 ${regularFontObjectId} 0 R /F2 ${boldFontObjectId} 0 R >> >> /Contents ${contentObjectId} 0 R >>`
    );
    objectBodies.set(
      contentObjectId,
      `<< /Length ${streamLength} >>\nstream\n${stream}\nendstream`
    );
  }

  objectBodies.set(
    regularFontObjectId,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"
  );
  objectBodies.set(
    boldFontObjectId,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>"
  );

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [0];

  for (let id = 1; id <= objectCount; id += 1) {
    const body = objectBodies.get(id);
    if (!body) {
      throw new Error(`Missing PDF object body for id ${id}.`);
    }
    offsets[id] = Buffer.byteLength(pdf, "ascii");
    pdf += `${id} 0 obj\n${body}\nendobj\n`;
  }

  const xrefOffset = Buffer.byteLength(pdf, "ascii");
  pdf += `xref\n0 ${objectCount + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let id = 1; id <= objectCount; id += 1) {
    pdf += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  }

  pdf += `trailer\n<< /Size ${objectCount + 1} /Root 1 0 R >>\n`;
  pdf += `startxref\n${xrefOffset}\n%%EOF\n`;

  return Uint8Array.from(Buffer.from(pdf, "ascii"));
}

export async function buildEngagementReportPdf(args: {
  engagementName: string;
  customerName?: string | null;
  opportunity?: string | null;
  spread: Spread;
  result: QuickSizerResult;
  serviceSummaryByRow?: Record<number, string>;
  serviceDetailsByRow?: Record<number, EngagementCsvServiceDetail[]>;
}): Promise<Uint8Array> {
  const rows = buildEngagementReportRows({
    result: args.result,
    serviceSummaryByRow: args.serviceSummaryByRow,
    serviceDetailsByRow: args.serviceDetailsByRow
  });

  const preparedRows = prepareEngagementReportRows(rows);
  const pages = paginateEngagementReportRows(preparedRows);

  const generatedAtLabel = new Date().toISOString().slice(0, 16).replace("T", " ");

  const streams = pages.map((pageRows, index) =>
    buildEngagementReportPageStream({
      engagementName: args.engagementName,
      customerName: args.customerName,
      opportunity: args.opportunity,
      spread: args.spread,
      rows: pageRows,
      totals: args.result.totals,
      generatedAtLabel,
      pageIndex: index,
      pageCount: pages.length
    })
  );

  return buildPdfWithTwoFonts(streams);
}

