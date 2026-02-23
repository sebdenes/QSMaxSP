import { calculateQuickSizer, normalizeSpread } from "@/lib/quickSizer";
import {
  OptimizerStrategy,
  QuickSizerLineItem,
  QuickSizerSelection,
  ScenarioOptimizerRecommendation,
  ScenarioOptimizerResult,
  ScenarioOptimizerSelection,
  Spread
} from "@/lib/types";

type OptimizePlanOptions = {
  targetDays: number;
  strategy?: OptimizerStrategy;
  durationYears?: number;
  spread?: Partial<Spread>;
  candidateRows?: number[];
};

type Level = 0 | 1 | 2 | 3;

const LEVEL_TO_SIZE: Record<Level, "N/A" | "S" | "M" | "L"> = {
  0: "N/A",
  1: "S",
  2: "M",
  3: "L"
};

const SCENARIO_TYPE_BY_ROW: Record<number, string> = {
  7: "Strategy & Foundation",
  8: "Cloud ERP Journey",
  9: "Cloud ERP Journey",
  10: "Cloud ERP Journey",
  11: "Cloud ERP Journey",
  12: "Cloud ERP Journey",
  13: "Cloud ERP Journey",
  14: "Cloud ERP Journey",
  15: "Finance & Spend Transformation",
  16: "Finance & Spend Transformation",
  17: "Finance & Spend Transformation",
  18: "Line-of-Business Transformation",
  19: "Line-of-Business Transformation",
  20: "Line-of-Business Transformation",
  21: "Platform, Data & Integration",
  22: "Platform, Data & Integration",
  23: "Platform, Data & Integration",
  24: "Strategy & Foundation",
  25: "Strategy & Foundation",
  26: "Platform, Data & Integration",
  27: "Strategy & Foundation",
  28: "Cybersecurity & Compliance"
};

const STRATEGY_WEIGHTS: Record<
  OptimizerStrategy,
  {
    entryScore: number;
    midUpgradeScore: number;
    topUpgradeScore: number;
    typeCoverageBonus: number;
  }
> = {
  balanced: {
    entryScore: 3,
    midUpgradeScore: 2.2,
    topUpgradeScore: 1.6,
    typeCoverageBonus: 4.5
  },
  coverage: {
    entryScore: 4.2,
    midUpgradeScore: 1.6,
    topUpgradeScore: 1.2,
    typeCoverageBonus: 7.5
  },
  depth: {
    entryScore: 2.2,
    midUpgradeScore: 3.2,
    topUpgradeScore: 2.6,
    typeCoverageBonus: 3.5
  }
};

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function normalizeDurationYears(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    return 3;
  }
  const rounded = Math.round(parsed);
  if (rounded < 1) {
    return 1;
  }
  if (rounded > 5) {
    return 5;
  }
  return rounded;
}

function normalizeTargetDays(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 0;
  }
  return round2(parsed);
}

function classifyScenarioType(row: number): string {
  return SCENARIO_TYPE_BY_ROW[row] ?? "Strategy & Foundation";
}

function resolveDaysAtLevel(item: QuickSizerLineItem, level: Level): number {
  const size = LEVEL_TO_SIZE[level];
  if (size === "N/A") {
    return 0;
  }
  if (size === "S" || size === "M" || size === "L") {
    return Math.max(0, item.daysBySize[size] ?? 0);
  }
  return 0;
}

function toSelection(row: number, level: Level): ScenarioOptimizerSelection | null {
  if (level === 1) {
    return { row, size: "S" };
  }
  if (level === 2) {
    return { row, size: "M" };
  }
  if (level === 3) {
    return { row, size: "L" };
  }
  return null;
}

function emptyResult(
  strategy: OptimizerStrategy,
  targetDays: number,
  durationYears: number,
  spread: Spread,
  uncoveredTypes: string[]
): ScenarioOptimizerResult {
  return {
    strategy,
    targetDays,
    totalDays: 0,
    utilizationPct: 0,
    durationYears,
    spread,
    selectedScenarioCount: 0,
    coveredTypes: [],
    uncoveredTypes,
    yearTotals: { y1: 0, y2: 0, y3: 0, y4: 0, y5: 0 },
    selections: [],
    recommendations: []
  };
}

export function optimizeScenarioPlan(
  lineItems: QuickSizerLineItem[],
  options: OptimizePlanOptions
): ScenarioOptimizerResult {
  const strategy = options.strategy ?? "balanced";
  const weights = STRATEGY_WEIGHTS[strategy];
  const durationYears = normalizeDurationYears(options.durationYears);
  const spread = normalizeSpread(options.spread);
  const targetDays = normalizeTargetDays(options.targetDays);

  const candidateRowSet = Array.isArray(options.candidateRows)
    ? new Set(
        options.candidateRows
          .map((value) => Number(value))
          .filter((value) => Number.isInteger(value) && value > 0)
      )
    : null;

  const candidates = lineItems
    .filter((item) => (candidateRowSet ? candidateRowSet.has(item.row) : true))
    .sort((left, right) => left.row - right.row);

  const allCandidateTypes = Array.from(
    new Set(candidates.map((item) => classifyScenarioType(item.row)))
  ).sort((left, right) => left.localeCompare(right));

  if (targetDays <= 0 || candidates.length === 0) {
    return emptyResult(strategy, targetDays, durationYears, spread, allCandidateTypes);
  }

  const levels = new Map<number, Level>();
  const reasonByRow = new Map<number, string>();
  const typeByRow = new Map<number, string>();
  const selectedRowsSet = new Set<number>();

  for (const item of candidates) {
    levels.set(item.row, 0);
    typeByRow.set(item.row, classifyScenarioType(item.row));
  }

  let usedDays = 0;

  const rowsByType = new Map<string, QuickSizerLineItem[]>();
  for (const item of candidates) {
    const type = typeByRow.get(item.row)!;
    const existing = rowsByType.get(type) ?? [];
    existing.push(item);
    rowsByType.set(type, existing);
  }

  // Seed one low-effort scenario per type when budget allows.
  const typeAnchors = Array.from(rowsByType.entries())
    .map(([type, rows]) => {
      const sortedBySmallest = [...rows].sort((left, right) => {
        const leftDays = resolveDaysAtLevel(left, 1);
        const rightDays = resolveDaysAtLevel(right, 1);
        return leftDays - rightDays || left.row - right.row;
      });
      return {
        type,
        item: sortedBySmallest[0],
        days: resolveDaysAtLevel(sortedBySmallest[0], 1)
      };
    })
    .filter((entry) => entry.days > 0)
    .sort((left, right) => left.days - right.days || left.item.row - right.item.row);

  for (const anchor of typeAnchors) {
    if (usedDays + anchor.days > targetDays + 0.000001) {
      continue;
    }

    levels.set(anchor.item.row, 1);
    selectedRowsSet.add(anchor.item.row);
    usedDays += anchor.days;
    reasonByRow.set(anchor.item.row, `Selected as a low-effort coverage anchor for ${anchor.type}.`);
  }

  while (true) {
    let bestStep:
      | {
          row: number;
          from: Level;
          to: Level;
          type: string;
          deltaDays: number;
          deltaScore: number;
          efficiency: number;
          hadTypeCoverage: boolean;
        }
      | null = null;

    for (const item of candidates) {
      const from = levels.get(item.row) ?? 0;
      if (from >= 3) {
        continue;
      }

      const to = (from + 1) as Level;
      const deltaDays = resolveDaysAtLevel(item, to) - resolveDaysAtLevel(item, from);
      if (deltaDays <= 0) {
        continue;
      }

      if (usedDays + deltaDays > targetDays + 0.000001) {
        continue;
      }

      const type = typeByRow.get(item.row)!;
      const hadTypeCoverage = Array.from(selectedRowsSet).some(
        (selectedRow) => typeByRow.get(selectedRow) === type
      );

      const scoreBase =
        from === 0
          ? weights.entryScore
          : from === 1
            ? weights.midUpgradeScore
            : weights.topUpgradeScore;
      const deltaScore = scoreBase + (from === 0 && !hadTypeCoverage ? weights.typeCoverageBonus : 0);
      const efficiency = deltaScore / deltaDays;

      const shouldReplace =
        !bestStep ||
        efficiency > bestStep.efficiency + 0.000001 ||
        (Math.abs(efficiency - bestStep.efficiency) < 0.000001 &&
          (deltaScore > bestStep.deltaScore + 0.000001 ||
            (Math.abs(deltaScore - bestStep.deltaScore) < 0.000001 &&
              (deltaDays < bestStep.deltaDays - 0.000001 ||
                (Math.abs(deltaDays - bestStep.deltaDays) < 0.000001 && item.row < bestStep.row)))));

      if (shouldReplace) {
        bestStep = {
          row: item.row,
          from,
          to,
          type,
          deltaDays,
          deltaScore,
          efficiency,
          hadTypeCoverage
        };
      }
    }

    if (!bestStep) {
      break;
    }

    levels.set(bestStep.row, bestStep.to);
    selectedRowsSet.add(bestStep.row);
    usedDays = round2(usedDays + bestStep.deltaDays);

    const priorReason = reasonByRow.get(bestStep.row);

    if (bestStep.from === 0) {
      const entryReason = bestStep.hadTypeCoverage
        ? "Selected to broaden solution scope with efficient day usage."
        : `Selected to establish coverage for ${bestStep.type}.`;
      reasonByRow.set(bestStep.row, entryReason);
      continue;
    }

    const upgradeReason =
      bestStep.from === 1
        ? "Upgraded from S to M for stronger delivery depth."
        : "Upgraded from M to L for maximum depth within target.";
    reasonByRow.set(bestStep.row, priorReason ? `${priorReason} ${upgradeReason}` : upgradeReason);
  }

  const selections: ScenarioOptimizerSelection[] = candidates
    .map((item) => toSelection(item.row, levels.get(item.row) ?? 0))
    .filter((entry): entry is ScenarioOptimizerSelection => Boolean(entry))
    .sort((left, right) => left.row - right.row);

  if (selections.length === 0) {
    return emptyResult(strategy, targetDays, durationYears, spread, allCandidateTypes);
  }

  const quickSelections: QuickSizerSelection[] = selections.map((selection) => ({
    row: selection.row,
    size: selection.size
  }));
  const quickResult = calculateQuickSizer(candidates, quickSelections, spread);
  const totalDays = round2(quickResult.totals.selectedDays);
  const utilizationPct = targetDays > 0 ? round2((totalDays / targetDays) * 100) : 0;

  const yearTotals: Spread = {
    y1: round2(quickResult.totals.y1),
    y2: round2(quickResult.totals.y2),
    y3: round2(quickResult.totals.y3),
    y4: round2(quickResult.totals.y4),
    y5: round2(quickResult.totals.y5)
  };

  if (durationYears < 5) {
    const keys: Array<keyof Spread> = ["y1", "y2", "y3", "y4", "y5"];
    for (let index = durationYears; index < keys.length; index += 1) {
      yearTotals[keys[index]] = 0;
    }
  }

  const coveredTypes = Array.from(
    new Set(selections.map((selection) => typeByRow.get(selection.row)!))
  ).sort((left, right) => left.localeCompare(right));

  const uncoveredTypes = allCandidateTypes.filter((type) => !coveredTypes.includes(type));

  const selectionByRow = new Map<number, ScenarioOptimizerSelection>();
  for (const selection of selections) {
    selectionByRow.set(selection.row, selection);
  }

  const recommendations: ScenarioOptimizerRecommendation[] = candidates
    .filter((item) => selectionByRow.has(item.row))
    .map((item) => {
      const selection = selectionByRow.get(item.row)!;
      const days =
        selection.size === "S"
          ? item.daysBySize.S
          : selection.size === "M"
            ? item.daysBySize.M
            : item.daysBySize.L;

      return {
        row: item.row,
        scenarioName: item.name,
        scenarioType: typeByRow.get(item.row)!,
        size: selection.size,
        days: round2(days),
        portfolioSharePct: totalDays > 0 ? round2((days / totalDays) * 100) : 0,
        reason: reasonByRow.get(item.row) ?? "Selected by optimizer."
      };
    })
    .sort((left, right) => right.days - left.days || left.row - right.row);

  return {
    strategy,
    targetDays,
    totalDays,
    utilizationPct,
    durationYears,
    spread,
    selectedScenarioCount: selections.length,
    coveredTypes,
    uncoveredTypes,
    yearTotals,
    selections,
    recommendations
  };
}
