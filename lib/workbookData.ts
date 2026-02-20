import fs from "node:fs";
import path from "node:path";
import { WorkbookSnapshot } from "@/lib/types";

type CellData = {
  value?: string | number | null;
  formula?: string;
};

type TotalsRow = {
  row: number;
  A?: CellData;
  B?: CellData;
  C?: CellData;
  D?: CellData;
  E?: CellData;
  F?: CellData;
};

type TotalsFile = {
  main_sheet_rows: TotalsRow[];
};

type DomainModelFile = {
  scenarios: Array<{
    name: string;
    override_count: number;
    totals_row2: {
      S: string | number;
      M: string | number;
      L: string | number;
      Custom: string | number;
      layout: "standard" | "extended";
      custom_total_cell: string;
    };
  }>;
};

let cache: WorkbookSnapshot | null = null;
let cacheVersion: string | null = null;

function asNumber(value: unknown): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === "string") {
    const normalized = value.trim();
    if (!normalized) {
      return 0;
    }

    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function loadJson<T>(fileName: string): T {
  const fullPath = path.join(process.cwd(), "data", fileName);
  const raw = fs.readFileSync(fullPath, "utf8");
  return JSON.parse(raw) as T;
}

function extractScenarioLabel(formula: string | undefined): string | undefined {
  if (!formula) {
    return undefined;
  }

  const trimmed = formula.trim();
  if (!trimmed) {
    return undefined;
  }

  const match = trimmed.match(/^(?:'([^']+)'|([^'!]+))!\$?[A-Z]+\$?\d+$/);
  if (!match) {
    return undefined;
  }

  const candidate = (match[1] ?? match[2] ?? "").trim();
  return candidate || undefined;
}

function resolveCacheVersion(): string {
  const totalsPath = path.join(process.cwd(), "data", "totals.json");
  const domainPath = path.join(process.cwd(), "data", "domain_model.json");

  const totalsStat = fs.statSync(totalsPath);
  const domainStat = fs.statSync(domainPath);
  return `${totalsStat.mtimeMs}:${domainStat.mtimeMs}`;
}

export function invalidateWorkbookSnapshotCache() {
  cache = null;
  cacheVersion = null;
}

export function getWorkbookSnapshot(): WorkbookSnapshot {
  const version = resolveCacheVersion();

  if (cache && cacheVersion === version) {
    return cache;
  }

  const totals = loadJson<TotalsFile>("totals.json");
  const domain = loadJson<DomainModelFile>("domain_model.json");

  const lineItems = totals.main_sheet_rows
    .filter((row) => row.row >= 7 && row.row <= 28)
    .map((row) => {
      const scenarioLabel =
        extractScenarioLabel(row.C?.formula) ??
        extractScenarioLabel(row.D?.formula) ??
        extractScenarioLabel(row.E?.formula) ??
        extractScenarioLabel(row.F?.formula);

      return {
        row: row.row,
        workbookId: asNumber(row.A?.value),
        name: String(row.B?.value ?? `Row ${row.row}`),
        scenarioLabel,
        daysBySize: {
          S: asNumber(row.C?.value),
          M: asNumber(row.D?.value),
          L: asNumber(row.E?.value),
          Custom: asNumber(row.F?.value)
        }
      };
    });

  const scenarios = domain.scenarios
    .map((scenario) => ({
      name: scenario.name,
      totalS: asNumber(scenario.totals_row2.S),
      totalM: asNumber(scenario.totals_row2.M),
      totalL: asNumber(scenario.totals_row2.L),
      totalCustom: asNumber(scenario.totals_row2.Custom),
      layout: scenario.totals_row2.layout,
      customTotalCell: scenario.totals_row2.custom_total_cell,
      overrideCount: scenario.override_count
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  cache = {
    lineItems,
    scenarios,
    spreadDefaults: { y1: 50, y2: 25, y3: 25, y4: 0, y5: 0 }
  };
  cacheVersion = version;

  return cache;
}
