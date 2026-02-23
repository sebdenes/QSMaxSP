"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { calculateQuickSizer } from "@/lib/quickSizer";
import {
  AuthUser,
  EngagementCustomServiceRecord,
  EngagementDetail,
  EngagementSummary,
  OptimizerStrategy,
  QuickSizerSelection,
  ScenarioOptimizerResult,
  ScenarioDrilldownResponse,
  ScenarioSummary,
  Spread,
  WorkbookSnapshot
} from "@/lib/types";

type WizardStep = 1 | 2 | 3 | 4 | 5 | 6;
type AuthMode = "login" | "register";
type ApiError = Error & { status?: number };
type BaselineSize = "S" | "M" | "L";
type ServiceCatalogItem = {
  id: number;
  name: string;
  sectionName: string;
};

type CustomServiceDraft = {
  serviceKey: string;
  serviceId: number | null;
  serviceName: string;
  sectionName: string | null;
  days: number;
};

type SizeServiceInsight = {
  serviceId: number;
  serviceName: string;
  sectionName: string;
  daysS: number;
  daysM: number;
  daysL: number;
};

type ScenarioTypeMeta = {
  key: string;
  subtitle: string;
};

const RECOMMENDED_BASELINE_SIZE: BaselineSize = "M";

const STEP_ITEMS: Array<{ id: WizardStep; label: string }> = [
  { id: 1, label: "Context" },
  { id: 2, label: "Scope" },
  { id: 3, label: "Scenarios" },
  { id: 4, label: "Sizing" },
  { id: 5, label: "Expert Mode" },
  { id: 6, label: "Review" }
];

const SCENARIO_TYPE_META: ScenarioTypeMeta[] = [
  {
    key: "Strategy & Foundation",
    subtitle: "AI, clean core, architecture, and transformation management foundations."
  },
  {
    key: "Cloud ERP Journey",
    subtitle: "Cloud ERP strategy, migration pathways, and operating model evolution."
  },
  {
    key: "Finance & Spend Transformation",
    subtitle: "Finance modernization and spend management transformation scenarios."
  },
  {
    key: "Line-of-Business Transformation",
    subtitle: "Functional transformations across supply chain, HCM, and CX."
  },
  {
    key: "Platform, Data & Integration",
    subtitle: "BTP, data cloud, toolchain, and integration suite initiatives."
  },
  {
    key: "Cybersecurity & Compliance",
    subtitle: "Cybersecurity, controls, and compliance hardening outcomes."
  }
];

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

const OPTIMIZER_STRATEGIES: OptimizerStrategy[] = ["balanced", "coverage", "depth"];
const OPTIMIZER_STRATEGY_LABELS: Record<OptimizerStrategy, string> = {
  balanced: "Option A - Balanced",
  coverage: "Option B - Coverage",
  depth: "Option C - Depth"
};
const OPTIMIZER_STRATEGY_HINTS: Record<OptimizerStrategy, string> = {
  balanced: "Balanced mix of coverage and delivery depth.",
  coverage: "Broader coverage across more scenarios.",
  depth: "Concentrated investment in fewer scenarios."
};

function createEmptyOptimizerCompareResults(): Record<OptimizerStrategy, ScenarioOptimizerResult | null> {
  return {
    balanced: null,
    coverage: null,
    depth: null
  };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function formatNum(value: number): string {
  return round2(value).toLocaleString();
}

function normalizeScenarioKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function isSameDays(left: number, right: number): boolean {
  return Math.abs(left - right) < 0.0001;
}

function normalizeDuration(value: unknown): number {
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

function classifyScenarioType(row: number): string {
  return SCENARIO_TYPE_BY_ROW[row] ?? "Strategy & Foundation";
}

function spreadTotal(spread: Spread): number {
  return spread.y1 + spread.y2 + spread.y3 + spread.y4 + spread.y5;
}

function clampSpreadToDuration(spread: Spread, durationYears: number): Spread {
  const years = normalizeDuration(durationYears);
  const values = [spread.y1, spread.y2, spread.y3, spread.y4, spread.y5];

  for (let index = years; index < values.length; index += 1) {
    values[index] = 0;
  }

  return {
    y1: values[0],
    y2: values[1],
    y3: values[2],
    y4: values[3],
    y5: values[4]
  };
}

function buildSpreadPreset(durationYears: number, mode: "even" | "front" | "back"): Spread {
  const years = normalizeDuration(durationYears);
  const base = [0, 0, 0, 0, 0];

  if (mode === "even") {
    const even = round2(100 / years);
    let used = 0;
    for (let i = 0; i < years; i += 1) {
      base[i] = i === years - 1 ? round2(100 - used) : even;
      used = round2(used + base[i]);
    }
  } else {
    const weights = Array.from({ length: years }).map((_, index) =>
      mode === "front" ? years - index : index + 1
    );
    const weightTotal = weights.reduce((sum, value) => sum + value, 0);

    let used = 0;
    for (let i = 0; i < years; i += 1) {
      const raw = (weights[i] / weightTotal) * 100;
      base[i] = i === years - 1 ? round2(100 - used) : round2(raw);
      used = round2(used + base[i]);
    }
  }

  return {
    y1: base[0],
    y2: base[1],
    y3: base[2],
    y4: base[3],
    y5: base[4]
  };
}

function sizeDescriptor(size: BaselineSize): string {
  if (size === "S") {
    return "Starter SAP package for focused outcomes.";
  }
  if (size === "M") {
    return "Recommended baseline for most customers.";
  }
  return "Expanded SAP package for broader transformation scope.";
}

function daysForBaselineSize(service: SizeServiceInsight, size: BaselineSize): number {
  if (size === "S") {
    return service.daysS;
  }
  if (size === "M") {
    return service.daysM;
  }
  return service.daysL;
}

function normalizeBaselineSize(value: string): BaselineSize | null {
  if (value === "S" || value === "M" || value === "L") {
    return value;
  }
  return null;
}

function toApiError(status: number, message: string): ApiError {
  const err = new Error(message) as ApiError;
  err.status = status;
  return err;
}

function parseBooleanFlag(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }

  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }

  return fallback;
}

export default function QuickSizerApp() {
  const [authLoading, setAuthLoading] = useState(true);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [authEmail, setAuthEmail] = useState("demo@quicksizer.local");
  const [authPassword, setAuthPassword] = useState("demo1234");
  const [authName, setAuthName] = useState("Demo User");
  const authDisabled = parseBooleanFlag(process.env.NEXT_PUBLIC_AUTH_DISABLED, false);

  const [workbook, setWorkbook] = useState<WorkbookSnapshot | null>(null);
  const [scenarios, setScenarios] = useState<ScenarioSummary[]>([]);
  const [engagements, setEngagements] = useState<EngagementSummary[]>([]);

  const [activeEngagementId, setActiveEngagementId] = useState<number | null>(null);
  const [wizardStep, setWizardStep] = useState<WizardStep>(1);
  const stepHistoryRef = useRef<WizardStep[]>([]);

  const [customerName, setCustomerName] = useState("");
  const [durationYears, setDurationYears] = useState(3);
  const [spread, setSpread] = useState<Spread>({ y1: 50, y2: 25, y3: 25, y4: 0, y5: 0 });

  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedRows, setSelectedRows] = useState<number[]>([]);
  const [, setBaselineSize] = useState<BaselineSize>("M");
  const [presetSizeByRow, setPresetSizeByRow] = useState<Record<number, BaselineSize>>({});
  const [customRows, setCustomRows] = useState<number[]>([]);
  const useCustomSizing = customRows.length > 0;
  const expertModeUnlocked = useCustomSizing;

  const [serviceCatalog, setServiceCatalog] = useState<ServiceCatalogItem[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [pendingServiceByRow, setPendingServiceByRow] = useState<Record<number, number>>({});
  const [customByRow, setCustomByRow] = useState<Record<number, CustomServiceDraft[]>>({});

  const [sizingInsightsByRow, setSizingInsightsByRow] = useState<Record<number, SizeServiceInsight[]>>({});
  const [loadingInsightsByRow, setLoadingInsightsByRow] = useState<Record<number, boolean>>({});
  const [insightRow, setInsightRow] = useState<number | null>(null);


  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [optimizerTargetDays, setOptimizerTargetDays] = useState(0);
  const [optimizerStrategy, setOptimizerStrategy] = useState<OptimizerStrategy>("balanced");
  const [optimizerLoading, setOptimizerLoading] = useState(false);
  const [optimizerError, setOptimizerError] = useState<string | null>(null);
  const [optimizerResult, setOptimizerResult] = useState<ScenarioOptimizerResult | null>(null);
  const [optimizerCompareResults, setOptimizerCompareResults] = useState<
    Record<OptimizerStrategy, ScenarioOptimizerResult | null>
  >(createEmptyOptimizerCompareResults);

  function canAccessStep(step: WizardStep): boolean {
    if (step === 5 && !expertModeUnlocked) {
      return false;
    }
    return true;
  }

  function resetStepHistory() {
    stepHistoryRef.current = [];
  }

  function navigateToStep(nextStep: WizardStep, trackHistory = true) {
    setWizardStep((currentStep) => {
      if (currentStep === nextStep || !canAccessStep(nextStep)) {
        return currentStep;
      }

      if (trackHistory) {
        const history = stepHistoryRef.current;
        if (history[history.length - 1] !== currentStep) {
          history.push(currentStep);
        }
      }

      return nextStep;
    });
  }

  function goBackStep(fallbackStep: WizardStep) {
    setWizardStep((currentStep) => {
      while (stepHistoryRef.current.length > 0) {
        const candidate = stepHistoryRef.current.pop();
        if (!candidate || candidate === currentStep) {
          continue;
        }

        if (!canAccessStep(candidate)) {
          continue;
        }

        return candidate;
      }

      return canAccessStep(fallbackStep) ? fallbackStep : 4;
    });
  }

  const scenarioRows = useMemo(() => workbook?.lineItems ?? [], [workbook]);

  const rowMap = useMemo(() => {
    const map = new Map<number, (typeof scenarioRows)[number]>();
    for (const row of scenarioRows) {
      map.set(row.row, row);
    }
    return map;
  }, [scenarioRows]);

  const rowsByType = useMemo(() => {
    const map = new Map<string, typeof scenarioRows>();
    for (const row of scenarioRows) {
      const type = classifyScenarioType(row.row);
      const existing = map.get(type) ?? [];
      existing.push(row);
      map.set(type, existing);
    }
    return map;
  }, [scenarioRows]);

  const availableTypeEntries = useMemo(() => {
    return SCENARIO_TYPE_META.filter((entry) => rowsByType.has(entry.key));
  }, [rowsByType]);

  const selectedTypeEntries = useMemo(
    () => availableTypeEntries.filter((entry) => selectedTypes.includes(entry.key)),
    [availableTypeEntries, selectedTypes]
  );

  const visibleRowsByType = useMemo(() => {
    const map = new Map<string, typeof scenarioRows>();

    for (const entry of selectedTypeEntries) {
      map.set(entry.key, rowsByType.get(entry.key) ?? []);
    }

    return map;
  }, [selectedTypeEntries, rowsByType]);

  const selectedRowsSet = useMemo(() => new Set(selectedRows), [selectedRows]);
  const customRowsSet = useMemo(() => new Set(customRows), [customRows]);

  const missingScenarioTypeSelections = useMemo(
    () =>
      selectedTypeEntries
        .map((entry) => entry.key)
        .filter((type) => {
          const rows = visibleRowsByType.get(type) ?? [];
          return rows.length > 0 && !rows.some((row) => selectedRowsSet.has(row.row));
        }),
    [selectedTypeEntries, visibleRowsByType, selectedRowsSet]
  );

  const scenarioIdByRow = useMemo(() => {
    const map = new Map<number, number>();

    const scenarioBucketsByKey = new Map<string, ScenarioSummary[]>();
    for (const scenario of scenarios) {
      if (typeof scenario.id !== "number") {
        continue;
      }

      const key = normalizeScenarioKey(scenario.name);
      const list = scenarioBucketsByKey.get(key) ?? [];
      list.push(scenario);
      scenarioBucketsByKey.set(key, list);
    }

    for (const row of scenarioRows) {
      let matchedScenario: ScenarioSummary | null = null;

      if (row.scenarioLabel) {
        const candidates = scenarioBucketsByKey.get(normalizeScenarioKey(row.scenarioLabel)) ?? [];

        if (candidates.length === 1) {
          matchedScenario = candidates[0];
        } else if (candidates.length > 1) {
          const narrowed = candidates.filter(
            (scenario) =>
              isSameDays(scenario.totalS, row.daysBySize.S) &&
              isSameDays(scenario.totalM, row.daysBySize.M) &&
              isSameDays(scenario.totalL, row.daysBySize.L)
          );

          if (narrowed.length === 1) {
            matchedScenario = narrowed[0];
          }
        }
      }

      if (!matchedScenario) {
        const totalMatches = scenarios.filter(
          (scenario) =>
            typeof scenario.id === "number" &&
            isSameDays(scenario.totalS, row.daysBySize.S) &&
            isSameDays(scenario.totalM, row.daysBySize.M) &&
            isSameDays(scenario.totalL, row.daysBySize.L)
        );

        if (totalMatches.length === 1) {
          matchedScenario = totalMatches[0];
        }
      }

      if (matchedScenario && typeof matchedScenario.id === "number") {
        map.set(row.row, matchedScenario.id);
      }
    }

    return map;
  }, [scenarioRows, scenarios]);

  const visibleRows = useMemo(() => {
    if (!selectedTypes.length) {
      return [] as typeof scenarioRows;
    }

    return scenarioRows.filter((row) => selectedTypes.includes(classifyScenarioType(row.row)));
  }, [scenarioRows, selectedTypes]);

  const optimizerCandidateRows = useMemo(() => {
    if (selectedTypes.length > 0) {
      return visibleRows.map((row) => row.row);
    }
    return scenarioRows.map((row) => row.row);
  }, [selectedTypes.length, visibleRows, scenarioRows]);

  const selectedLineItems = useMemo(
    () => selectedRows.map((row) => rowMap.get(row)).filter(Boolean) as typeof scenarioRows,
    [selectedRows, rowMap]
  );

  const customLineItems = useMemo(
    () => selectedLineItems.filter((line) => customRowsSet.has(line.row)),
    [selectedLineItems, customRowsSet]
  );

  const presetSizeCounts = useMemo<Record<BaselineSize, number>>(() => {
    const counts: Record<BaselineSize, number> = { S: 0, M: 0, L: 0 };

    for (const row of selectedRows) {
      if (customRowsSet.has(row)) {
        continue;
      }

      const size = presetSizeByRow[row] ?? RECOMMENDED_BASELINE_SIZE;
      counts[size] += 1;
    }

    return counts;
  }, [selectedRows, presetSizeByRow, customRowsSet]);

  const presetSizingModeLabel = useMemo(() => {
    const active = (["S", "M", "L"] as BaselineSize[])
      .map((size) => ({ size, count: presetSizeCounts[size] }))
      .filter((entry) => entry.count > 0);

    if (!active.length) {
      return "T-Shirt";
    }

    if (active.length === 1) {
      return `T-Shirt (${active[0].size})`;
    }

    return `T-Shirt Mixed (${active.map((entry) => `${entry.size} x${entry.count}`).join(", ")})`;
  }, [presetSizeCounts]);

  const sidebarSizingLabel = useMemo(() => {
    const active = (["S", "M", "L"] as BaselineSize[]).filter(
      (size) => presetSizeCounts[size] > 0
    );

    if (!active.length) {
      return "-";
    }

    if (active.length === 1) {
      return active[0];
    }

    return "Mixed";
  }, [presetSizeCounts]);

  const sizingModeLabel = useMemo(() => {
    if (!useCustomSizing) {
      return presetSizingModeLabel;
    }

    if (customRows.length === selectedRows.length) {
      return "Custom";
    }

    return `Mixed (${selectedRows.length - customRows.length} preset, ${customRows.length} custom)`;
  }, [useCustomSizing, customRows.length, selectedRows.length, presetSizingModeLabel]);

  const activeInsightRow = useMemo(() => {
    if (!selectedRows.length) {
      return null;
    }
    if (typeof insightRow === "number" && selectedRows.includes(insightRow)) {
      return insightRow;
    }
    return selectedRows[0];
  }, [selectedRows, insightRow]);

  const activeInsightLineItem = useMemo(
    () => (activeInsightRow ? rowMap.get(activeInsightRow) ?? null : null),
    [activeInsightRow, rowMap]
  );

  const activeInsightServices = useMemo(
    () => (activeInsightRow ? sizingInsightsByRow[activeInsightRow] ?? [] : []),
    [activeInsightRow, sizingInsightsByRow]
  );

  const activeInsightSize = useMemo<BaselineSize>(() => {
    if (!activeInsightRow) {
      return RECOMMENDED_BASELINE_SIZE;
    }

    return presetSizeByRow[activeInsightRow] ?? RECOMMENDED_BASELINE_SIZE;
  }, [activeInsightRow, presetSizeByRow]);

  const activeInsightUsesCustom = Boolean(
    activeInsightRow ? customRowsSet.has(activeInsightRow) : false
  );

  const activeInsightServicesForBaseline = useMemo(
    () =>
      activeInsightUsesCustom
        ? []
        : activeInsightServices.filter(
            (service) => daysForBaselineSize(service, activeInsightSize) > 0
          ),
    [activeInsightUsesCustom, activeInsightServices, activeInsightSize]
  );

  const activeInsightSelectedSizeTotal = useMemo(
    () =>
      round2(
        activeInsightServicesForBaseline.reduce(
          (sum, service) => sum + daysForBaselineSize(service, activeInsightSize),
          0
        )
      ),
    [activeInsightServicesForBaseline, activeInsightSize]
  );

  const activeInsightLoading = Boolean(
    activeInsightRow ? loadingInsightsByRow[activeInsightRow] : false
  );

  const activeInsightScenarioId = activeInsightRow
    ? scenarioIdByRow.get(activeInsightRow) ?? null
    : null;

  const activeSpread = useMemo(
    () => clampSpreadToDuration(spread, durationYears),
    [spread, durationYears]
  );

  const currentSpreadTotal = useMemo(() => spreadTotal(activeSpread), [activeSpread]);
  const spreadOverLimit = currentSpreadTotal > 100.000001;

  const compiledSelections = useMemo<QuickSizerSelection[]>(() => {
    if (!selectedRows.length) {
      return [];
    }

    return selectedRows.map((row) => {
      if (customRowsSet.has(row)) {
        const total = (customByRow[row] ?? []).reduce((sum, entry) => sum + entry.days, 0);
        return {
          row,
          size: "Custom" as const,
          customDays: round2(total)
        };
      }

      return {
        row,
        size: presetSizeByRow[row] ?? RECOMMENDED_BASELINE_SIZE
      };
    });
  }, [selectedRows, customRowsSet, presetSizeByRow, customByRow]);

  const quickResult = useMemo(() => {
    if (!workbook) {
      return null;
    }

    return calculateQuickSizer(workbook.lineItems, compiledSelections, activeSpread);
  }, [workbook, compiledSelections, activeSpread]);

  const reviewAllocations = useMemo(() => {
    return selectedLineItems.map((line) => {
      const rowResult = quickResult?.rows.find((entry) => entry.row === line.row);
      const baselineSize = presetSizeByRow[line.row] ?? RECOMMENDED_BASELINE_SIZE;
      const rowUsesCustom = customRowsSet.has(line.row);
      const scenarioId = scenarioIdByRow.get(line.row);
      const sizeLabel = rowUsesCustom ? "Custom" : baselineSize;
      const hasPresetInsights = Array.isArray(sizingInsightsByRow[line.row]);

      const services = rowUsesCustom
        ? (customByRow[line.row] ?? []).map((entry) => ({
            serviceName: entry.serviceName,
            sectionName: entry.sectionName ?? "-",
            days: round2(entry.days)
          }))
        : (sizingInsightsByRow[line.row] ?? [])
            .map((service) => ({
              serviceName: service.serviceName,
              sectionName: service.sectionName,
              days: round2(daysForBaselineSize(service, baselineSize))
            }))
            .filter((service) => service.days > 0);

      const serviceTotal = round2(services.reduce((sum, service) => sum + service.days, 0));
      const loading =
        !rowUsesCustom &&
        Boolean(scenarioId) &&
        (Boolean(loadingInsightsByRow[line.row]) || !hasPresetInsights) &&
        services.length === 0;
      const unavailable = !rowUsesCustom && !scenarioId && services.length === 0;

      return {
        row: line.row,
        scenarioName: line.name,
        sizeLabel,
        loading,
        unavailable,
        services,
        totalDays: round2(rowResult?.selectedDays ?? serviceTotal)
      };
    });
  }, [
    selectedLineItems,
    quickResult,
    presetSizeByRow,
    customRowsSet,
    customByRow,
    sizingInsightsByRow,
    loadingInsightsByRow,
    scenarioIdByRow
  ]);

  const reviewGrandTotal = useMemo(
    () => round2(quickResult?.totals.selectedDays ?? 0),
    [quickResult]
  );

  useEffect(() => {
    if (optimizerTargetDays > 0) {
      return;
    }

    if (reviewGrandTotal > 0) {
      setOptimizerTargetDays(reviewGrandTotal);
    }
  }, [optimizerTargetDays, reviewGrandTotal]);

  const optimizerComparePlans = useMemo(
    () =>
      OPTIMIZER_STRATEGIES.map((strategy) => ({
        strategy,
        label: OPTIMIZER_STRATEGY_LABELS[strategy],
        hint: OPTIMIZER_STRATEGY_HINTS[strategy],
        result: optimizerCompareResults[strategy]
      })),
    [optimizerCompareResults]
  );

  const hasOptimizerComparePlans = useMemo(
    () => optimizerComparePlans.some((plan) => Boolean(plan.result)),
    [optimizerComparePlans]
  );

  useEffect(() => {
    const selectedCompareResult = optimizerCompareResults[optimizerStrategy];
    if (selectedCompareResult) {
      setOptimizerResult(selectedCompareResult);
    }
  }, [optimizerCompareResults, optimizerStrategy]);

  const customIssuesByRow = useMemo(() => {
    const issues: Record<number, string> = {};

    for (const row of selectedRows) {
      if (!customRowsSet.has(row)) {
        continue;
      }

      const services = customByRow[row] ?? [];
      if (!services.length) {
        issues[row] = "Select at least one service.";
        continue;
      }

      if (services.some((entry) => !Number.isFinite(entry.days) || entry.days < 10)) {
        issues[row] = "Each selected service must be at least 10 days.";
      }
    }

    return issues;
  }, [selectedRows, customRowsSet, customByRow]);

  const basicsValid = customerName.trim().length > 0 && !spreadOverLimit;
  const typesValid = selectedTypes.length > 0;
  const scenariosValid = selectedRows.length > 0 && missingScenarioTypeSelections.length === 0;
  const customValid = Object.keys(customIssuesByRow).length === 0;
  const readyToSave = basicsValid && typesValid && scenariosValid && (!useCustomSizing || customValid);

  const workflowCompletion = useMemo(() => {
    const checks = [basicsValid, typesValid, scenariosValid, !useCustomSizing || customValid, readyToSave];
    const done = checks.filter(Boolean).length;
    return Math.round((done / checks.length) * 100);
  }, [basicsValid, typesValid, scenariosValid, useCustomSizing, customValid, readyToSave]);

  async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
    const response = await fetch(url, {
      ...init,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {})
      }
    });

    const text = await response.text();
    let payload: unknown = null;
    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        payload = text;
      }
    }

    if (!response.ok) {
      const msg =
        typeof payload === "object" && payload !== null && "error" in payload
          ? String((payload as { error: unknown }).error)
          : `Request failed (${response.status}).`;
      throw toApiError(response.status, msg);
    }

    return payload as T;
  }

  function resetDraft() {
    setActiveEngagementId(null);
    setWizardStep(1);
    resetStepHistory();
    setCustomerName("");
    setDurationYears(3);
    setSpread({ y1: 50, y2: 25, y3: 25, y4: 0, y5: 0 });
    setSelectedTypes([]);
    setSelectedRows([]);
    setBaselineSize("M");
    setPresetSizeByRow({});
    setCustomRows([]);
    setPendingServiceByRow({});
    setCustomByRow({});
    setSizingInsightsByRow({});
    setLoadingInsightsByRow({});
    setInsightRow(null);
    setSavedAt(null);
    setError(null);
    setMessage(null);
    setOptimizerTargetDays(0);
    setOptimizerStrategy("balanced");
    setOptimizerLoading(false);
    setOptimizerError(null);
    setOptimizerResult(null);
    setOptimizerCompareResults(createEmptyOptimizerCompareResults());
  }

  function hydrateCustomServices(customServices: EngagementCustomServiceRecord[]) {
    const grouped: Record<number, CustomServiceDraft[]> = {};

    for (const service of customServices) {
      const list = grouped[service.scenarioRow] ?? [];
      list.push({
        serviceKey: service.serviceKey,
        serviceId: service.serviceId,
        serviceName: service.serviceName,
        sectionName: service.sectionName,
        days: Math.max(10, service.days)
      });
      grouped[service.scenarioRow] = list;
    }

    return grouped;
  }

  function hydrateFromEngagement(engagement: EngagementDetail) {
    const duration = normalizeDuration(engagement.durationYears);
    const spreadFromEngagement = clampSpreadToDuration(
      {
        y1: engagement.spreadY1,
        y2: engagement.spreadY2,
        y3: engagement.spreadY3,
        y4: engagement.spreadY4,
        y5: engagement.spreadY5
      },
      duration
    );

    setCustomerName(engagement.customerName ?? "");
    setDurationYears(duration);
    setSpread(spreadFromEngagement);

    const activeSelections = engagement.selections.filter((entry) => entry.size !== "N/A");
    const rows = activeSelections.map((entry) => entry.row);
    setSelectedRows(rows);

    const inferredTypes = Array.from(new Set(rows.map((row) => classifyScenarioType(row))));
    setSelectedTypes(inferredTypes);

    const presetMap: Record<number, BaselineSize> = {};
    const customRowsFromSelections = new Set<number>();

    for (const selection of activeSelections) {
      const size = normalizeBaselineSize(selection.size);
      if (size) {
        presetMap[selection.row] = size;
      } else if (selection.size === "Custom") {
        customRowsFromSelections.add(selection.row);
      }
    }

    const customRowsFromServices = new Set<number>(
      engagement.customServices.map((entry) => entry.scenarioRow)
    );

    const hydratedCustomRows = rows.filter(
      (row) => customRowsFromSelections.has(row) || customRowsFromServices.has(row)
    );

    setBaselineSize(RECOMMENDED_BASELINE_SIZE);
    setPresetSizeByRow(
      rows.reduce<Record<number, BaselineSize>>((acc, row) => {
        acc[row] = presetMap[row] ?? RECOMMENDED_BASELINE_SIZE;
        return acc;
      }, {})
    );
    setCustomRows(hydratedCustomRows);

    if (engagement.customServices.length > 0) {
      setCustomByRow(hydrateCustomServices(engagement.customServices));
    } else {
      const legacyCustom: Record<number, CustomServiceDraft[]> = {};
      for (const selection of activeSelections) {
        if (selection.size !== "Custom") {
          continue;
        }

        const rowInfo = rowMap.get(selection.row);
        if (!rowInfo) {
          continue;
        }

        const days = Math.max(10, selection.customDays ?? rowInfo.daysBySize.Custom);
        legacyCustom[selection.row] = [
          {
            serviceKey: `legacy-${selection.row}`,
            serviceId: null,
            serviceName: "Imported Custom Allocation",
            sectionName: null,
            days
          }
        ];
      }

      setCustomByRow(legacyCustom);
    }

    setSavedAt(new Date().toLocaleString());
    setOptimizerError(null);
    setOptimizerResult(null);
    setOptimizerCompareResults(createEmptyOptimizerCompareResults());
    resetStepHistory();
    setWizardStep(6);
  }

  async function bootstrapData() {
    setLoading(true);
    setError(null);

    try {
      const [workbookData, engagementList, scenarioList] = await Promise.all([
        fetchJson<WorkbookSnapshot>("/api/workbook"),
        fetchJson<EngagementSummary[]>("/api/engagements"),
        fetchJson<ScenarioSummary[]>("/api/scenarios")
      ]);

      setWorkbook(workbookData);
      setEngagements(engagementList);
      setScenarios(scenarioList);

      // Always start with a fresh draft after auth; users can explicitly load a saved plan.
      resetDraft();
    } catch (err) {
      const apiErr = err as ApiError;
      if (apiErr.status === 401) {
        setAuthUser(null);
      } else {
        setError(apiErr.message);
      }
    } finally {
      setLoading(false);
    }
  }

  async function initializeAuth() {
    setAuthLoading(true);
    setError(null);

    try {
      const me = await fetchJson<{ user: AuthUser }>("/api/auth/me");
      setAuthUser(me.user);
      await bootstrapData();
    } catch (err) {
      const apiErr = err as ApiError;
      if (apiErr.status === 401) {
        setAuthUser(null);
      } else {
        setError(apiErr.message);
      }
    } finally {
      setAuthLoading(false);
    }
  }

  useEffect(() => {
    void initializeAuth();
  }, []);

  useEffect(() => {
    if (!authUser || !activeEngagementId || !workbook) {
      return;
    }

    let mounted = true;

    const run = async () => {
      try {
        const engagement = await fetchJson<EngagementDetail>(`/api/engagements/${activeEngagementId}`);
        if (!mounted) {
          return;
        }
        hydrateFromEngagement(engagement);
      } catch (err) {
        if (!mounted) {
          return;
        }
        const apiErr = err as ApiError;
        setError(apiErr.message);
      }
    };

    void run();

    return () => {
      mounted = false;
    };
  }, [authUser, activeEngagementId, workbook]);

  useEffect(() => {
    setSelectedRows((prev) =>
      prev.filter((row) => {
        const item = rowMap.get(row);
        return item ? selectedTypes.includes(classifyScenarioType(item.row)) : false;
      })
    );
  }, [selectedTypes, rowMap]);

  useEffect(() => {
    setCustomByRow((prev) => {
      const next: Record<number, CustomServiceDraft[]> = {};
      for (const row of selectedRows) {
        if (prev[row]) {
          next[row] = prev[row];
        }
      }
      return next;
    });

    setPresetSizeByRow((prev) => {
      const next: Record<number, BaselineSize> = {};
      for (const row of selectedRows) {
        next[row] = prev[row] ?? RECOMMENDED_BASELINE_SIZE;
      }
      return next;
    });

    setCustomRows((prev) => prev.filter((row) => selectedRows.includes(row)));

    setPendingServiceByRow((prev) => {
      const next: Record<number, number> = {};
      for (const row of selectedRows) {
        if (prev[row]) {
          next[row] = prev[row];
        }
      }
      return next;
    });

    setSizingInsightsByRow((prev) => {
      const next: Record<number, SizeServiceInsight[]> = {};
      for (const row of selectedRows) {
        if (prev[row]) {
          next[row] = prev[row];
        }
      }
      return next;
    });

    setLoadingInsightsByRow((prev) => {
      const next: Record<number, boolean> = {};
      for (const row of selectedRows) {
        if (prev[row]) {
          next[row] = prev[row];
        }
      }
      return next;
    });

    setInsightRow((prev) => {
      if (typeof prev === "number" && selectedRows.includes(prev)) {
        return prev;
      }
      return selectedRows[0] ?? null;
    });
  }, [selectedRows]);

  useEffect(() => {
    if (!useCustomSizing || wizardStep !== 5) {
      return;
    }

    const loadServiceCatalog = async () => {
      if (serviceCatalog.length > 0 || loadingCatalog) {
        return;
      }

      const firstScenario = scenarios.find((scenario) => typeof scenario.id === "number");
      if (!firstScenario?.id) {
        return;
      }

      setLoadingCatalog(true);
      try {
        const detail = await fetchJson<ScenarioDrilldownResponse>(`/api/scenarios/${firstScenario.id}`);

        const rows: ServiceCatalogItem[] = [];
        for (const section of detail.sections) {
          for (const service of section.services) {
            rows.push({
              id: service.id,
              name: service.name,
              sectionName: section.name
            });
          }
        }

        const deduped = Array.from(new Map(rows.map((entry) => [entry.id, entry])).values());
        setServiceCatalog(deduped);
      } catch (err) {
        const apiErr = err as ApiError;
        setError(apiErr.message);
      } finally {
        setLoadingCatalog(false);
      }
    };

    void loadServiceCatalog();
  }, [useCustomSizing, wizardStep, serviceCatalog.length, loadingCatalog, scenarios]);

  useEffect(() => {
    if (wizardStep !== 4) {
      return;
    }

    if (!activeInsightRow) {
      return;
    }

    if (sizingInsightsByRow[activeInsightRow] || loadingInsightsByRow[activeInsightRow]) {
      return;
    }

    void loadSizingInsights(activeInsightRow);
  }, [
    wizardStep,
    activeInsightRow,
    sizingInsightsByRow,
    loadingInsightsByRow,
    scenarioIdByRow
  ]);

  useEffect(() => {
    if (wizardStep !== 6) {
      return;
    }

    for (const row of selectedRows) {
      if (customRowsSet.has(row)) {
        continue;
      }
      if (!scenarioIdByRow.get(row)) {
        continue;
      }

      if (sizingInsightsByRow[row] || loadingInsightsByRow[row]) {
        continue;
      }

      void loadSizingInsights(row);
    }
  }, [
    wizardStep,
    selectedRows,
    customRowsSet,
    sizingInsightsByRow,
    loadingInsightsByRow,
    scenarioIdByRow
  ]);

  async function submitAuth() {
    setError(null);
    setMessage(null);

    try {
      const endpoint = authMode === "register" ? "/api/auth/register" : "/api/auth/login";
      const payload =
        authMode === "register"
          ? { email: authEmail, password: authPassword, name: authName }
          : { email: authEmail, password: authPassword };

      const response = await fetchJson<{ user: AuthUser }>(endpoint, {
        method: "POST",
        body: JSON.stringify(payload)
      });

      setAuthUser(response.user);
      setMessage(`${authMode === "register" ? "Registered" : "Logged in"} as ${response.user.email}`);
      await bootstrapData();
    } catch (err) {
      const apiErr = err as ApiError;
      setError(apiErr.message);
    }
  }

  async function logout() {
    try {
      await fetchJson<{ ok: boolean }>("/api/auth/logout", {
        method: "POST",
        body: JSON.stringify({})
      });
    } catch {
      // ignore logout errors
    }

    setAuthUser(null);
    setWorkbook(null);
    setScenarios([]);
    setEngagements([]);
    setActiveEngagementId(null);
    setMessage("Signed out.");
  }

  function toggleType(type: string) {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((entry) => entry !== type) : [...prev, type]
    );
  }

  function toggleRow(row: number) {
    setSelectedRows((prev) =>
      prev.includes(row) ? prev.filter((entry) => entry !== row) : [...prev, row]
    );
  }

  function selectAllRowsForType(type: string) {
    const rows = rowsByType.get(type) ?? [];
    const typeRowIds = rows.map((row) => row.row);

    setSelectedRows((prev) => Array.from(new Set([...prev, ...typeRowIds])));
  }

  function clearRowsForType(type: string) {
    const typeRowIds = new Set((rowsByType.get(type) ?? []).map((row) => row.row));
    setSelectedRows((prev) => prev.filter((row) => !typeRowIds.has(row)));
  }

  function updateDuration(nextValue: number) {
    const normalized = normalizeDuration(nextValue);
    setDurationYears(normalized);
    setSpread((prev) => clampSpreadToDuration(prev, normalized));
  }

  function updateSpread(year: keyof Spread, rawValue: string) {
    const parsed = Number(rawValue);
    const safe = Number.isFinite(parsed) ? parsed : 0;

    setSpread((prev) =>
      clampSpreadToDuration(
        {
          ...prev,
          [year]: safe
        },
        durationYears
      )
    );
  }

  function applySpreadPreset(mode: "even" | "front" | "back") {
    setSpread(buildSpreadPreset(durationYears, mode));
  }

  function setPresetSizeForRow(row: number, size: BaselineSize) {
    setPresetSizeByRow((prev) => ({
      ...prev,
      [row]: size
    }));
    setBaselineSize(size);
    setCustomRows((prev) => prev.filter((entry) => entry !== row));
  }

  function applyPresetSizeToSelected(size: BaselineSize) {
    setBaselineSize(size);
    setPresetSizeByRow((prev) => {
      const next = { ...prev };
      for (const row of selectedRows) {
        next[row] = size;
      }
      return next;
    });
    setCustomRows((prev) => prev.filter((row) => !selectedRows.includes(row)));
  }

  function setCustomSizingForRow(row: number, enabled: boolean) {
    setCustomRows((prev) => {
      const set = new Set(prev);
      if (enabled) {
        set.add(row);
      } else {
        set.delete(row);
      }
      return Array.from(set);
    });
  }

  async function loadSizingInsights(row: number) {
    if (loadingInsightsByRow[row] || sizingInsightsByRow[row]) {
      return;
    }

    const scenarioId = scenarioIdByRow.get(row);
    if (!scenarioId) {
      setSizingInsightsByRow((prev) => ({
        ...prev,
        [row]: []
      }));
      return;
    }

    setLoadingInsightsByRow((prev) => ({
      ...prev,
      [row]: true
    }));

    try {
      const detail = await fetchJson<ScenarioDrilldownResponse>(`/api/scenarios/${scenarioId}`);

      const services: SizeServiceInsight[] = [];
      for (const section of detail.sections) {
        for (const service of section.services) {
          const daysS = Math.max(0, service.effective.S ?? 0);
          const daysM = Math.max(0, service.effective.M ?? 0);
          const daysL = Math.max(0, service.effective.L ?? 0);

          if (daysS <= 0 && daysM <= 0 && daysL <= 0) {
            continue;
          }

          services.push({
            serviceId: service.id,
            serviceName: service.name,
            sectionName: section.name,
            daysS,
            daysM,
            daysL
          });
        }
      }

      services.sort((a, b) => {
        if (a.sectionName !== b.sectionName) {
          return a.sectionName.localeCompare(b.sectionName);
        }
        return a.serviceName.localeCompare(b.serviceName);
      });

      setSizingInsightsByRow((prev) => ({
        ...prev,
        [row]: services
      }));
    } catch (err) {
      const apiErr = err as ApiError;
      setError(apiErr.message);
    } finally {
      setLoadingInsightsByRow((prev) => {
        const next = { ...prev };
        delete next[row];
        return next;
      });
    }
  }

  function addServiceToRow(row: number, serviceId: number) {
    const service = serviceCatalog.find((entry) => entry.id === serviceId);
    if (!service) {
      return;
    }

    setCustomByRow((prev) => {
      const list = [...(prev[row] ?? [])];
      if (list.some((entry) => entry.serviceId === serviceId)) {
        return prev;
      }

      list.push({
        serviceKey: `service-${serviceId}`,
        serviceId,
        serviceName: service.name,
        sectionName: service.sectionName,
        days: 10
      });

      return {
        ...prev,
        [row]: list
      };
    });
  }

  function removeServiceFromRow(row: number, serviceKey: string) {
    setCustomByRow((prev) => {
      const list = (prev[row] ?? []).filter((entry) => entry.serviceKey !== serviceKey);
      return {
        ...prev,
        [row]: list
      };
    });
  }

  function updateCustomServiceDays(row: number, serviceKey: string, rawValue: string) {
    const parsed = Number(rawValue);
    const safe = Number.isFinite(parsed) ? Math.max(10, parsed) : 10;

    setCustomByRow((prev) => ({
      ...prev,
      [row]: (prev[row] ?? []).map((entry) =>
        entry.serviceKey === serviceKey ? { ...entry, days: safe } : entry
      )
    }));
  }

  function rowCustomTotal(row: number): number {
    return round2((customByRow[row] ?? []).reduce((sum, entry) => sum + entry.days, 0));
  }

  async function savePlan() {
    if (!workbook || !quickResult) {
      return;
    }

    setError(null);

    if (!readyToSave) {
      setError("Complete all steps before saving.");
      return;
    }

    setSaving(true);

    try {
      const name = `${customerName.trim()} Premium Services Project`;
      const spreadPayload = clampSpreadToDuration(activeSpread, durationYears);

      let engagementId = activeEngagementId;

      if (!engagementId) {
        const created = await fetchJson<EngagementSummary>("/api/engagements", {
          method: "POST",
          body: JSON.stringify({
            name,
            customerName: customerName.trim(),
            durationYears,
            spreadY1: spreadPayload.y1,
            spreadY2: spreadPayload.y2,
            spreadY3: spreadPayload.y3,
            spreadY4: spreadPayload.y4,
            spreadY5: spreadPayload.y5
          })
        });

        engagementId = created.id;
        setActiveEngagementId(created.id);
      }

      const noteSections: string[] = [];
      noteSections.push(`Scenario Types: ${selectedTypes.join(", ")}`);
      noteSections.push(`Scenarios: ${selectedLineItems.map((line) => line.name).join(" | ")}`);
      noteSections.push(`Sizing Mode: ${sizingModeLabel}`);

      const customServicesPayload: EngagementCustomServiceRecord[] = selectedRows.flatMap((row) => {
        if (!customRowsSet.has(row)) {
          return [];
        }

        return (customByRow[row] ?? []).map((entry) => ({
          scenarioRow: row,
          serviceKey: entry.serviceKey,
          serviceId: entry.serviceId,
          serviceName: entry.serviceName,
          sectionName: entry.sectionName,
          days: round2(entry.days)
        }));
      });

      await fetchJson<EngagementDetail>(`/api/engagements/${engagementId}`, {
        method: "PUT",
        body: JSON.stringify({
          name,
          customerName: customerName.trim(),
          durationYears,
          notes: noteSections.join("\n"),
          spreadY1: spreadPayload.y1,
          spreadY2: spreadPayload.y2,
          spreadY3: spreadPayload.y3,
          spreadY4: spreadPayload.y4,
          spreadY5: spreadPayload.y5,
          selections: compiledSelections,
          customServices: customServicesPayload
        })
      });

      const refreshed = await fetchJson<EngagementSummary[]>("/api/engagements");
      setEngagements(refreshed);

      setSavedAt(new Date().toLocaleString());
      setMessage(
        `Project saved. ${selectedLineItems.length} scenarios configured, ${formatNum(
          quickResult.totals.selectedDays
        )} total days.`
      );
    } catch (err) {
      const apiErr = err as ApiError;
      setError(apiErr.message);
    } finally {
      setSaving(false);
    }
  }

  function exportEngagementCsv() {
    if (!activeEngagementId) {
      return;
    }
    window.open(`/api/engagements/${activeEngagementId}/export?format=csv`, "_blank");
  }

  function buildOptimizerPayload(strategy: OptimizerStrategy) {
    return {
      targetDays: Number(optimizerTargetDays),
      strategy,
      durationYears,
      spread: activeSpread,
      candidateRows: optimizerCandidateRows
    };
  }

  function firstAvailableOptimizerResult(
    source: Record<OptimizerStrategy, ScenarioOptimizerResult | null>
  ): ScenarioOptimizerResult | null {
    for (const strategy of OPTIMIZER_STRATEGIES) {
      if (source[strategy]) {
        return source[strategy];
      }
    }
    return null;
  }

  async function runScenarioOptimizer() {
    if (!workbook) {
      return;
    }

    const targetDays = Number(optimizerTargetDays);
    if (!Number.isFinite(targetDays) || targetDays <= 0) {
      setOptimizerError("Enter a positive target day budget.");
      return;
    }

    setOptimizerLoading(true);
    setOptimizerError(null);

    try {
      const result = await fetchJson<ScenarioOptimizerResult>("/api/optimizer", {
        method: "POST",
        body: JSON.stringify(buildOptimizerPayload(optimizerStrategy))
      });

      setOptimizerResult(result);
      setOptimizerCompareResults((prev) => ({
        ...prev,
        [optimizerStrategy]: result
      }));
      setMessage(
        `Optimizer generated ${result.selectedScenarioCount} scenario recommendations (${formatNum(
          result.totalDays
        )} / ${formatNum(result.targetDays)} days).`
      );
    } catch (err) {
      const apiErr = err as ApiError;
      setOptimizerError(apiErr.message);
    } finally {
      setOptimizerLoading(false);
    }
  }

  async function runScenarioOptimizerCompare() {
    if (!workbook) {
      return;
    }

    const targetDays = Number(optimizerTargetDays);
    if (!Number.isFinite(targetDays) || targetDays <= 0) {
      setOptimizerError("Enter a positive target day budget.");
      return;
    }

    setOptimizerLoading(true);
    setOptimizerError(null);

    try {
      const compareTuples = await Promise.all(
        OPTIMIZER_STRATEGIES.map(async (strategy) => {
          const result = await fetchJson<ScenarioOptimizerResult>("/api/optimizer", {
            method: "POST",
            body: JSON.stringify(buildOptimizerPayload(strategy))
          });
          return [strategy, result] as const;
        })
      );

      const next = createEmptyOptimizerCompareResults();
      for (const [strategy, result] of compareTuples) {
        next[strategy] = result;
      }
      setOptimizerCompareResults(next);

      const selected = next[optimizerStrategy] ?? firstAvailableOptimizerResult(next);
      setOptimizerResult(selected);

      const generatedCount = compareTuples.filter(([, result]) => result.selections.length > 0).length;
      setMessage(
        `Generated ${generatedCount}/${OPTIMIZER_STRATEGIES.length} optimizer options for comparison.`
      );
    } catch (err) {
      const apiErr = err as ApiError;
      setOptimizerError(apiErr.message);
    } finally {
      setOptimizerLoading(false);
    }
  }

  function applyOptimizerPlanFromResult(result: ScenarioOptimizerResult, sourceLabel: string) {
    if (result.selections.length === 0) {
      setOptimizerError("Optimizer did not find a valid plan for this target.");
      return;
    }

    const rows = result.selections.map((selection) => selection.row).sort((a, b) => a - b);
    const inferredTypes = Array.from(new Set(rows.map((row) => classifyScenarioType(row))));
    const nextPresetSizes = result.selections.reduce<Record<number, BaselineSize>>(
      (acc, selection) => {
        acc[selection.row] = selection.size;
        return acc;
      },
      {}
    );

    setSelectedTypes(inferredTypes);
    setSelectedRows(rows);
    setPresetSizeByRow(nextPresetSizes);
    setCustomRows([]);
    setCustomByRow({});
    setPendingServiceByRow({});
    setInsightRow(rows[0] ?? null);
    setError(null);
    setOptimizerError(null);
    setOptimizerResult(result);
    setMessage(
      `Applied ${sourceLabel}: ${rows.length} scenarios, ${formatNum(result.totalDays)} total days.`
    );
  }

  function applyOptimizerPlan() {
    if (!optimizerResult) {
      return;
    }
    applyOptimizerPlanFromResult(optimizerResult, "selected optimizer plan");
  }

  function goNextFromBasics() {
    if (!basicsValid) {
      setError("Enter customer and keep spread total at or below 100%.");
      return;
    }
    setError(null);
    navigateToStep(2);
  }

  function goNextFromTypes() {
    if (!typesValid) {
      setError("Select at least one scenario type.");
      return;
    }
    setError(null);
    navigateToStep(3);
  }

  function goNextFromScenarios() {
    if (missingScenarioTypeSelections.length > 0) {
      setError(
        `Select at least one scenario in each selected type: ${missingScenarioTypeSelections.join(", ")}.`
      );
      return;
    }

    if (!scenariosValid) {
      setError("Select at least one scenario.");
      return;
    }

    setError(null);
    navigateToStep(4);
  }

  async function ensureReviewInsightsLoaded() {
    const rowsToLoad = selectedRows.filter((row) => {
      if (customRowsSet.has(row)) {
        return false;
      }

      if (!scenarioIdByRow.get(row)) {
        return false;
      }

      return !sizingInsightsByRow[row];
    });

    if (!rowsToLoad.length) {
      return;
    }

    await Promise.all(rowsToLoad.map((row) => loadSizingInsights(row)));
  }

  async function goNextBaseline() {
    setPresetSizeByRow((prev) => {
      const next = { ...prev };
      for (const row of selectedRows) {
        next[row] = next[row] ?? RECOMMENDED_BASELINE_SIZE;
      }
      return next;
    });
    setError(null);

    if (useCustomSizing) {
      navigateToStep(5);
      return;
    }

    await ensureReviewInsightsLoaded();
    navigateToStep(6);
  }

  async function applyRecommendedSizingAndReview() {
    applyPresetSizeToSelected(RECOMMENDED_BASELINE_SIZE);
    setError(null);
    await ensureReviewInsightsLoaded();
    navigateToStep(6);
  }

  function switchToCustom() {
    const focusRow = activeInsightRow ?? selectedRows[0] ?? null;
    if (focusRow) {
      setCustomSizingForRow(focusRow, true);
    }
    setError(null);
    navigateToStep(5);
  }

  async function goNextFromCustom() {
    if (!customValid) {
      setError("Resolve custom service validation issues before continuing.");
      return;
    }
    setError(null);
    await ensureReviewInsightsLoaded();
    navigateToStep(6);
  }

  if (authLoading) {
    return <p className="muted">{authDisabled ? "Initializing local workspace..." : "Checking session..."}</p>;
  }

  if (!authUser) {
    if (authDisabled) {
      return (
        <section className="card grid" style={{ gap: "0.8rem" }}>
          <h2>Local Workspace Unavailable</h2>
          <p className="muted" style={{ margin: 0 }}>
            Portable mode is enabled, but the local workspace could not be initialized.
          </p>
          {error && <p style={{ color: "#b64d4d", margin: 0 }}>{error}</p>}
          <div className="row">
            <button type="button" onClick={() => void initializeAuth()}>
              Retry
            </button>
          </div>
        </section>
      );
    }

    return (
      <section className="card grid grid-2" style={{ alignItems: "start" }}>
        <div>
          <h2>SAP Secure Login</h2>
          <p className="muted" style={{ marginTop: "0.45rem" }}>
            Use the seeded SAP demo account or register a new user.
            <br />
            Default: <code>demo@quicksizer.local / demo1234</code>
          </p>

          <div className="row" style={{ marginTop: "0.8rem" }}>
            <button
              type="button"
              onClick={() => setAuthMode("login")}
              style={{
                background: authMode === "login" ? "var(--accent)" : "white",
                color: authMode === "login" ? "white" : "var(--text)",
                borderColor: "var(--line)"
              }}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => setAuthMode("register")}
              style={{
                background: authMode === "register" ? "var(--accent)" : "white",
                color: authMode === "register" ? "white" : "var(--text)",
                borderColor: "var(--line)"
              }}
            >
              Register
            </button>
          </div>
        </div>

        <div className="grid" style={{ gap: "0.5rem" }}>
          <input
            value={authEmail}
            onChange={(event) => setAuthEmail(event.target.value)}
            placeholder="Email"
          />
          {authMode === "register" && (
            <input
              value={authName}
              onChange={(event) => setAuthName(event.target.value)}
              placeholder="Name"
            />
          )}
          <input
            type="password"
            value={authPassword}
            onChange={(event) => setAuthPassword(event.target.value)}
            placeholder="Password"
          />
          <button type="button" onClick={submitAuth}>
            {authMode === "register" ? "Create user" : "Sign In"}
          </button>
          {error && <p style={{ color: "#b64d4d", margin: 0 }}>{error}</p>}
          {message && <p style={{ color: "var(--success)", margin: 0 }}>{message}</p>}
        </div>
      </section>
    );
  }

  if (loading || !workbook || !quickResult) {
    return <p className="muted">Loading SAP workspace...</p>;
  }

  return (
    <div className="grid" style={{ gap: "1rem" }}>
      <section className="card hero-card">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h2 style={{ fontSize: "1.15rem" }}>SAP Guided Plan Builder</h2>
            <p className="muted" style={{ marginTop: "0.4rem", maxWidth: "72ch" }}>
              Guided workflow: define customer scope, choose initiatives, then apply recommended sizing before opening expert-level service detail.
            </p>
          </div>

          <div className="row" style={{ gap: "0.5rem" }}>
            <button type="button" className="ghost-button" onClick={resetDraft}>
              New Project
            </button>
            {!authDisabled && (
              <button
                type="button"
                onClick={logout}
                style={{ background: "#3a4c67", borderColor: "#3a4c67" }}
              >
                Sign Out
              </button>
            )}
          </div>
        </div>

        <div className="row" style={{ marginTop: "0.8rem", flexWrap: "wrap" }}>
          <span className="badge">{authDisabled ? "Portable local mode" : "Signed in: " + authUser.email}</span>
          <span className="badge">Flow completion: {workflowCompletion}%</span>
          <label className="row" style={{ gap: "0.4rem" }}>
            <span className="muted">Load Saved Project</span>
            <select
              value={activeEngagementId ?? ""}
              onChange={(event) => {
                const value = Number(event.target.value);
                if (!value) {
                  resetDraft();
                  return;
                }
                setActiveEngagementId(value);
              }}
            >
              <option value="">Project Draft (unsaved)</option>
              {engagements.map((engagement) => (
                <option key={engagement.id} value={engagement.id}>
                  {engagement.customerName ?? engagement.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      {(message || error) && (
        <section className="card">
          {message && <p style={{ margin: 0, color: "var(--success)" }}>{message}</p>}
          {error && <p style={{ margin: 0, color: "#b64d4d" }}>{error}</p>}
        </section>
      )}

      <section className="wizard-layout">
        <div className="card" style={{ padding: "1rem" }}>
          <div className="step-track">
            {STEP_ITEMS.map((step) => {
              const active = wizardStep === step.id;
              const completed = wizardStep > step.id;
              const expertLocked = step.id === 5 && !expertModeUnlocked;

              return (
                <button
                  key={step.id}
                  type="button"
                  className={`step-pill ${active ? "active" : ""} ${completed ? "done" : ""}`}
                  disabled={expertLocked}
                  title={expertLocked ? "Open Expert Mode from Step 4 to unlock this step." : undefined}
                  onClick={() => {
                    if (expertLocked) {
                      return;
                    }
                    if (step.id <= wizardStep) {
                      resetStepHistory();
                      setWizardStep(step.id);
                    }
                  }}
                >
                  <span>{step.id}</span>
                  <small>{step.label}</small>
                </button>
              );
            })}
          </div>

          {wizardStep === 1 && (
            <div className="grid panel-enter" style={{ gap: "1rem", marginTop: "1rem" }}>
              <h2>Step 1: Customer Context</h2>
              <div className="hint-box">
                <p className="hint-title">Fast path</p>
                <p className="muted" style={{ margin: 0 }}>
                  Most SAP plans can be configured quickly: select initiative scope, choose active scenarios, apply recommended sizing, and open expert service detail only when needed.
                </p>
              </div>

              <div className="grid" style={{ gap: "0.6rem" }}>
                <label>
                  <span className="muted">Customer Name</span>
                  <input
                    value={customerName}
                    onChange={(event) => setCustomerName(event.target.value)}
                    placeholder="Enter customer"
                  />
                </label>

                <label>
                  <span className="muted">Plan Duration</span>
                  <select
                    value={durationYears}
                    onChange={(event) => updateDuration(Number(event.target.value))}
                  >
                    <option value={1}>1 year</option>
                    <option value={2}>2 years</option>
                    <option value={3}>3 years</option>
                    <option value={4}>4 years</option>
                    <option value={5}>5 years</option>
                  </select>
                </label>
              </div>

              <div className="row" style={{ flexWrap: "wrap" }}>
                <button type="button" className="ghost-button" onClick={() => applySpreadPreset("even")}>
                  Even Distribution
                </button>
                <button type="button" className="ghost-button" onClick={() => applySpreadPreset("front")}>
                  Front-Loaded
                </button>
                <button type="button" className="ghost-button" onClick={() => applySpreadPreset("back")}>
                  Back-Loaded
                </button>
              </div>

              <div className="year-grid">
                {[1, 2, 3, 4, 5].map((year) => {
                  const key = `y${year}` as keyof Spread;
                  const enabled = year <= durationYears;
                  return (
                    <label key={year} className="year-card">
                      <span className="muted">Year {year}</span>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={0.1}
                        disabled={!enabled}
                        value={round2(activeSpread[key])}
                        onChange={(event) => updateSpread(key, event.target.value)}
                      />
                    </label>
                  );
                })}
              </div>

              <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
                <p className="muted" style={{ margin: 0 }}>
                  Spread Total: <strong>{round2(currentSpreadTotal)}%</strong>
                </p>
                <button type="button" onClick={goNextFromBasics}>
                  Continue to Scope
                </button>
              </div>
            </div>
          )}

          {wizardStep === 2 && (
            <div className="grid panel-enter" style={{ gap: "1rem", marginTop: "1rem" }}>
              <h2>Step 2: Business Scope</h2>
              <p className="muted" style={{ margin: 0 }}>
                Choose the SAP initiative domains this customer is prioritizing. Most teams select 2 to 3 domains for the baseline plan.
              </p>

              <div className="choice-grid">
                {availableTypeEntries.map((entry) => {
                  const selected = selectedTypes.includes(entry.key);
                  const count = rowsByType.get(entry.key)?.length ?? 0;

                  return (
                    <button
                      key={entry.key}
                      type="button"
                      className={`choice-card ${selected ? "selected" : ""}`}
                      onClick={() => toggleType(entry.key)}
                    >
                      <strong>{entry.key}</strong>
                      <span className="muted">{entry.subtitle}</span>
                      <span className="badge">{count} scenarios</span>
                    </button>
                  );
                })}
              </div>

              <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
                <button type="button" className="ghost-button" onClick={() => goBackStep(1)}>
                  Back
                </button>
                <button type="button" onClick={goNextFromTypes}>
                  Continue to Scenarios
                </button>
              </div>
            </div>
          )}

          {wizardStep === 3 && (
            <div className="grid panel-enter" style={{ gap: "1rem", marginTop: "1rem" }}>
              <h2>Step 3: Scenario Selection</h2>
              <p className="muted" style={{ margin: 0 }}>
                Scenarios are grouped by selected scenario type. Select at least one scenario in each
                selected type before continuing.
              </p>

              <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => setSelectedRows(visibleRows.map((row) => row.row))}
                >
                  Select All Visible
                </button>
                <span className="muted">Selected: {selectedRows.length}</span>
              </div>

              {missingScenarioTypeSelections.length > 0 && (
                <p className="scenario-type-warning" style={{ margin: 0 }}>
                  Select at least one scenario in each type. Missing: {missingScenarioTypeSelections.join(", ")}
                </p>
              )}

              <div className="grid" style={{ gap: "0.75rem" }}>
                {selectedTypeEntries.map((entry) => {
                  const typeRows = visibleRowsByType.get(entry.key) ?? [];
                  const selectedCount = typeRows.filter((row) => selectedRowsSet.has(row.row)).length;
                  const complete = selectedCount > 0;

                  return (
                    <section
                      key={entry.key}
                      className={`scenario-type-group ${complete ? "complete" : "needs-selection"}`}
                    >
                      <div className="scenario-type-header">
                        <div className="scenario-type-meta">
                          <h3>{entry.key}</h3>
                          <p className="muted" style={{ margin: 0 }}>
                            {entry.subtitle}
                          </p>
                        </div>

                        <div className="row" style={{ flexWrap: "wrap", justifyContent: "flex-end" }}>
                          <span className="badge">
                            {selectedCount} / {typeRows.length} selected
                          </span>
                          <button
                            type="button"
                            className="ghost-button"
                            onClick={() => selectAllRowsForType(entry.key)}
                          >
                            Select All in Type
                          </button>
                          <button
                            type="button"
                            className="ghost-button"
                            onClick={() => clearRowsForType(entry.key)}
                          >
                            Clear
                          </button>
                        </div>
                      </div>

                      <div className="choice-grid">
                        {typeRows.map((row) => {
                          const selected = selectedRowsSet.has(row.row);
                          return (
                            <button
                              key={row.row}
                              type="button"
                              className={`choice-card ${selected ? "selected" : ""}`}
                              onClick={() => toggleRow(row.row)}
                            >
                              <strong>{row.name}</strong>
                              <span className="muted">
                                Baseline S/M/L: {formatNum(row.daysBySize.S)} / {formatNum(row.daysBySize.M)} /{" "}
                                {formatNum(row.daysBySize.L)}
                              </span>
                            </button>
                          );
                        })}
                      </div>

                      {!complete && (
                        <p className="scenario-type-warning">Select at least one scenario in this type.</p>
                      )}
                    </section>
                  );
                })}
              </div>

              <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
                <button type="button" className="ghost-button" onClick={() => goBackStep(2)}>
                  Back
                </button>
                <button type="button" onClick={goNextFromScenarios}>
                  Continue to Sizing
                </button>
              </div>
            </div>
          )}

          {wizardStep === 4 && (
            <div className="grid panel-enter" style={{ gap: "1rem", marginTop: "1rem" }}>
              <h2>Step 4: Recommended Sizing</h2>
              <p className="muted" style={{ margin: 0 }}>
                Start with predefined SAP packages. Size M is the default baseline, and you can review included services before confirming.
              </p>

              <div className="choice-grid">
                {(["S", "M", "L"] as BaselineSize[]).map((size) => {
                  const total = selectedLineItems.reduce((sum, row) => sum + row.daysBySize[size], 0);
                  const selected =
                    selectedRows.length > 0 && presetSizeCounts[size] === selectedRows.length;
                  const recommended = size === RECOMMENDED_BASELINE_SIZE;

                  return (
                    <button
                      key={size}
                      type="button"
                      className={`choice-card ${selected ? "selected" : ""}`}
                      onClick={() => applyPresetSizeToSelected(size)}
                    >
                      <div className="row" style={{ justifyContent: "space-between", width: "100%" }}>
                        <strong>Apply Size {size} to All</strong>
                        {recommended && <span className="recommend-tag">Recommended</span>}
                      </div>
                      <span className="muted">{sizeDescriptor(size)}</span>
                      <span className="stat-line">Portfolio days at Size {size}: {formatNum(total)}</span>
                    </button>
                  );
                })}
              </div>

              <section className="card" style={{ borderStyle: "dashed" }}>
                <div className="row" style={{ justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" }}>
                  <h2 style={{ fontSize: "0.95rem", margin: 0 }}>Scenario-level Sizing</h2>
                  <span className="badge">
                    {sizingModeLabel} | Total days: {formatNum(quickResult.totals.selectedDays)}
                  </span>
                </div>

                <p className="muted" style={{ margin: "0.5rem 0 0" }}>
                  Set size per scenario. You can mix S, M, L, and Custom across the selected scope.
                </p>

                <div className="grid" style={{ gap: "0.6rem", marginTop: "0.75rem" }}>
                  {selectedLineItems.map((line) => {
                    const rowSize = presetSizeByRow[line.row] ?? RECOMMENDED_BASELINE_SIZE;
                    const rowUsesCustom = customRowsSet.has(line.row);
                    const selectedDays = rowUsesCustom ? rowCustomTotal(line.row) : line.daysBySize[rowSize];

                    return (
                      <div key={line.row} className="card" style={{ padding: "0.7rem" }}>
                        <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.6rem" }}>
                          <div>
                            <strong>{line.name}</strong>
                            <p className="muted" style={{ margin: "0.35rem 0 0" }}>
                              Selected mode: <strong>{rowUsesCustom ? "Custom" : rowSize}</strong> | Days: {formatNum(selectedDays)}
                            </p>
                          </div>

                          <div className="row" style={{ gap: "0.35rem", flexWrap: "wrap" }}>
                            {(["S", "M", "L"] as BaselineSize[]).map((size) => (
                              <button
                                key={size}
                                type="button"
                                className={!rowUsesCustom && rowSize === size ? "" : "ghost-button"}
                                onClick={() => setPresetSizeForRow(line.row, size)}
                              >
                                {size}
                              </button>
                            ))}
                            <button
                              type="button"
                              className={rowUsesCustom ? "" : "ghost-button"}
                              onClick={() => setCustomSizingForRow(line.row, true)}
                            >
                              Custom
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              <section className="card service-include-card" style={{ borderStyle: "dashed" }}>
                <div
                  className="row"
                  style={{ justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap" }}
                >
                  <div>
                    <h2 style={{ fontSize: "0.95rem" }}>Included Services and Day Allocation</h2>
                    <p className="muted" style={{ margin: "0.3rem 0 0" }}>
                      Review the exact services and day allocation before confirming the baseline package.
                    </p>
                  </div>

                  <label className="row" style={{ gap: "0.45rem" }}>
                    <span className="muted">Scenario</span>
                    <select
                      value={activeInsightRow ?? ""}
                      onChange={(event) => {
                        const row = Number(event.target.value);
                        if (!row) {
                          setInsightRow(null);
                          return;
                        }
                        setInsightRow(row);
                        void loadSizingInsights(row);
                      }}
                    >
                      {selectedLineItems.map((line) => (
                        <option key={line.row} value={line.row}>
                          {line.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                {activeInsightLineItem && (
                  <div className="row" style={{ marginTop: "0.5rem", flexWrap: "wrap" }}>
                    {activeInsightUsesCustom ? (
                      <span className="badge">Custom scenario: configure services and days in Step 5.</span>
                    ) : (
                      <span className="badge">
                        Selected size {activeInsightSize}: {formatNum(activeInsightLineItem.daysBySize[activeInsightSize])} days
                      </span>
                    )}
                  </div>
                )}

                {!activeInsightUsesCustom && activeInsightLoading && (
                  <p className="muted" style={{ margin: "0.6rem 0 0" }}>Loading included services...</p>
                )}

                {activeInsightUsesCustom && activeInsightLineItem && (
                  <p className="muted" style={{ margin: "0.6rem 0 0" }}>
                    This scenario is set to Custom. Use Step 5 to select services and allocate days.
                  </p>
                )}

                {!activeInsightUsesCustom && !activeInsightLoading && !activeInsightScenarioId && activeInsightLineItem && (
                  <p className="muted" style={{ margin: "0.6rem 0 0" }}>
                    Service-level sizing details are not available for this scenario.
                  </p>
                )}

                {!activeInsightUsesCustom && !activeInsightLoading && activeInsightScenarioId && (
                  <div style={{ marginTop: "0.6rem", overflowX: "auto" }}>
                    <table className="service-matrix-table">
                      <thead>
                        <tr>
                          <th>Service</th>
                          <th>Section</th>
                          <th>{activeInsightSize} Days</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeInsightServicesForBaseline.length === 0 && (
                          <tr>
                            <td colSpan={3} className="muted">
                              No services with allocated days found for size {activeInsightSize} in this scenario.
                            </td>
                          </tr>
                        )}

                        {activeInsightServicesForBaseline.map((service) => (
                          <tr key={service.serviceId}>
                            <td>{service.serviceName}</td>
                            <td>{service.sectionName}</td>
                            <td>{formatNum(daysForBaselineSize(service, activeInsightSize))}</td>
                          </tr>
                        ))}
                      </tbody>
                      {activeInsightServicesForBaseline.length > 0 && (
                        <tfoot>
                          <tr className="service-matrix-total-row">
                            <td colSpan={2}>Total {activeInsightSize} Days</td>
                            <td>{formatNum(activeInsightSelectedSizeTotal)}</td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                )}
              </section>

              <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
                <button type="button" className="ghost-button" onClick={() => goBackStep(3)}>
                  Back
                </button>
                <div className="row" style={{ flexWrap: "wrap" }}>
                  <button type="button" className="ghost-button" onClick={switchToCustom}>
                    Need Expert Sizing? Open Custom
                  </button>
                  <button type="button" onClick={goNextBaseline}>
                    {useCustomSizing ? "Continue to Expert Custom" : "Continue with Selected Sizes"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {wizardStep === 5 && (
            <div className="grid panel-enter" style={{ gap: "1rem", marginTop: "1rem" }}>
              <h2>Step 5: Expert Custom Services</h2>
              <p className="muted" style={{ margin: 0 }}>
                Select services per scenario and assign delivery days. Minimum allocation per selected service is 10 days.
              </p>
              <div className="hint-box row" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
                <div>
                  <p className="hint-title">Expert mode guidance</p>
                  <p className="muted" style={{ margin: 0 }}>
                    Use expert mode only for true exceptions. If uncertain, switch back to the recommended baseline package.
                  </p>
                </div>
                <button
                  type="button"
                  className="ghost-button"
                  onClick={applyRecommendedSizingAndReview}
                >
                  Use Recommended Sizing ({RECOMMENDED_BASELINE_SIZE})
                </button>
              </div>

              {loadingCatalog && <p className="muted">Loading service catalog...</p>}

              {!loadingCatalog && serviceCatalog.length === 0 && (
                <p className="muted">Service catalog unavailable. Try again or use baseline sizing.</p>
              )}

              {customLineItems.length === 0 && (
                <p className="muted">No scenario is set to Custom. Go back and set at least one scenario to Custom.</p>
              )}

              {customLineItems.map((line) => {
                const selectedEntries = customByRow[line.row] ?? [];
                const selectedServiceIds = new Set(
                  selectedEntries
                    .map((entry) => entry.serviceId)
                    .filter((value): value is number => typeof value === "number")
                );
                const availableServices = serviceCatalog.filter(
                  (service) => !selectedServiceIds.has(service.id)
                );
                const pendingId = pendingServiceByRow[line.row] ?? availableServices[0]?.id ?? 0;

                return (
                  <section key={line.row} className="card" style={{ borderStyle: "dashed" }}>
                    <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div>
                        <h2 style={{ fontSize: "0.95rem" }}>{line.name}</h2>
                        <p className="muted" style={{ margin: "0.35rem 0 0" }}>
                          Custom total: <strong>{formatNum(rowCustomTotal(line.row))}</strong> days
                        </p>
                      </div>
                      {customIssuesByRow[line.row] && (
                        <span style={{ color: "#b64d4d", fontSize: "0.82rem" }}>
                          {customIssuesByRow[line.row]}
                        </span>
                      )}
                    </div>

                    <div className="row" style={{ marginTop: "0.7rem", flexWrap: "wrap" }}>
                      <select
                        value={pendingId}
                        onChange={(event) =>
                          setPendingServiceByRow((prev) => ({
                            ...prev,
                            [line.row]: Number(event.target.value)
                          }))
                        }
                      >
                        {availableServices.length === 0 && <option value={0}>No services left</option>}
                        {availableServices.map((service) => (
                          <option key={service.id} value={service.id}>
                            {service.sectionName} - {service.name}
                          </option>
                        ))}
                      </select>

                      <button
                        type="button"
                        className="ghost-button"
                        onClick={() => {
                          if (pendingId > 0) {
                            addServiceToRow(line.row, pendingId);
                          }
                        }}
                        disabled={pendingId <= 0}
                      >
                        Add Service
                      </button>
                    </div>

                    <div style={{ marginTop: "0.6rem", overflowX: "auto" }}>
                      <table>
                        <thead>
                          <tr>
                            <th>Service</th>
                            <th>Section</th>
                            <th>Days</th>
                            <th></th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedEntries.length === 0 && (
                            <tr>
                              <td colSpan={4} className="muted">
                                No services selected yet.
                              </td>
                            </tr>
                          )}

                          {selectedEntries.map((entry) => (
                            <tr key={entry.serviceKey}>
                              <td>{entry.serviceName}</td>
                              <td>{entry.sectionName ?? "-"}</td>
                              <td>
                                <input
                                  type="number"
                                  min={10}
                                  step={1}
                                  value={entry.days}
                                  onChange={(event) =>
                                    updateCustomServiceDays(line.row, entry.serviceKey, event.target.value)
                                  }
                                />
                              </td>
                              <td>
                                <button
                                  type="button"
                                  className="ghost-button"
                                  onClick={() => removeServiceFromRow(line.row, entry.serviceKey)}
                                >
                                  Remove
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                );
              })}

              <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
                <button type="button" className="ghost-button" onClick={() => goBackStep(4)}>
                  Back
                </button>
                <div className="row" style={{ flexWrap: "wrap" }}>
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={applyRecommendedSizingAndReview}
                  >
                    Use Recommended Sizing ({RECOMMENDED_BASELINE_SIZE})
                  </button>
                  <button type="button" onClick={goNextFromCustom}>
                    Continue to Review
                  </button>
                </div>
              </div>
            </div>
          )}

          {wizardStep === 6 && (
            <div className="grid panel-enter" style={{ gap: "1rem", marginTop: "1rem" }}>
              <h2>Step 6: Project Summary / Save</h2>
              <p className="muted" style={{ margin: 0 }}>
                SAP-ready summary of scope, scenarios, sizing decision, and service allocations.
              </p>

              <section className="card" style={{ borderStyle: "dashed" }}>
                <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <h2 style={{ fontSize: "0.95rem", margin: 0 }}>Scenario Optimizer (Target Mode)</h2>
                    <p className="muted" style={{ margin: "0.35rem 0 0" }}>
                      Set a target day budget and let the optimizer propose which scenarios to include and what baseline size to use.
                    </p>
                  </div>
                  <span className="badge">MVP</span>
                </div>

                <div className="row" style={{ marginTop: "0.75rem", flexWrap: "wrap", alignItems: "flex-end" }}>
                  <label className="grid" style={{ gap: "0.3rem", minWidth: "200px" }}>
                    <span className="muted">Target total days</span>
                    <input
                      type="number"
                      min={1}
                      step={1}
                      value={optimizerTargetDays}
                      onChange={(event) => setOptimizerTargetDays(Number(event.target.value))}
                    />
                  </label>

                  <label className="grid" style={{ gap: "0.3rem", minWidth: "220px" }}>
                    <span className="muted">Optimization strategy</span>
                    <select
                      value={optimizerStrategy}
                      onChange={(event) => setOptimizerStrategy(event.target.value as OptimizerStrategy)}
                    >
                      {OPTIMIZER_STRATEGIES.map((strategy) => (
                        <option key={strategy} value={strategy}>
                          {OPTIMIZER_STRATEGY_LABELS[strategy]}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="row" style={{ flexWrap: "wrap" }}>
                    <button type="button" onClick={runScenarioOptimizer} disabled={optimizerLoading}>
                      {optimizerLoading ? "Optimizing..." : "Generate Selected Option"}
                    </button>
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={runScenarioOptimizerCompare}
                      disabled={optimizerLoading}
                    >
                      Compare A/B/C
                    </button>
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={applyOptimizerPlan}
                      disabled={!optimizerResult || optimizerLoading}
                    >
                      Apply Plan
                    </button>
                  </div>
                </div>

                {optimizerError && (
                  <p style={{ color: "#b64d4d", margin: "0.65rem 0 0" }}>{optimizerError}</p>
                )}

                {hasOptimizerComparePlans && (
                  <div className="choice-grid" style={{ marginTop: "0.8rem" }}>
                    {optimizerComparePlans.map((plan) => {
                      const compareResult = plan.result;
                      return (
                        <section key={plan.strategy} className="choice-card selected" style={{ alignItems: "stretch" }}>
                          <div className="row" style={{ justifyContent: "space-between", width: "100%" }}>
                            <strong>{plan.label}</strong>
                            {optimizerStrategy === plan.strategy && <span className="recommend-tag">Selected</span>}
                          </div>
                          <span className="muted">{plan.hint}</span>
                          {compareResult ? (
                            <>
                              <span className="stat-line">
                                {formatNum(compareResult.totalDays)} / {formatNum(compareResult.targetDays)} days (
                                {formatNum(compareResult.utilizationPct)}%)
                              </span>
                              <span className="stat-line">
                                {compareResult.selectedScenarioCount} scenarios, {compareResult.coveredTypes.length} types
                              </span>
                              <button
                                type="button"
                                className="ghost-button"
                                onClick={() => applyOptimizerPlanFromResult(compareResult, plan.label)}
                                disabled={optimizerLoading}
                              >
                                Apply {plan.label}
                              </button>
                            </>
                          ) : (
                            <span className="muted">Not generated yet.</span>
                          )}
                        </section>
                      );
                    })}
                  </div>
                )}

                {optimizerResult && (
                  <div className="grid" style={{ gap: "0.65rem", marginTop: "0.8rem" }}>
                    <p className="muted" style={{ margin: 0 }}>
                      Detail view for {OPTIMIZER_STRATEGY_LABELS[optimizerResult.strategy]}.
                    </p>
                    <div className="row" style={{ flexWrap: "wrap" }}>
                      <span className="badge">Recommended: {optimizerResult.selectedScenarioCount} scenarios</span>
                      <span className="badge">
                        Total days: {formatNum(optimizerResult.totalDays)} / {formatNum(optimizerResult.targetDays)}
                      </span>
                      <span className="badge">Utilization: {formatNum(optimizerResult.utilizationPct)}%</span>
                      <span className="badge">Y1: {formatNum(optimizerResult.yearTotals.y1)}</span>
                      <span className="badge">Y2: {formatNum(optimizerResult.yearTotals.y2)}</span>
                      <span className="badge">Y3: {formatNum(optimizerResult.yearTotals.y3)}</span>
                      <span className="badge">Y4: {formatNum(optimizerResult.yearTotals.y4)}</span>
                      <span className="badge">Y5: {formatNum(optimizerResult.yearTotals.y5)}</span>
                    </div>

                    <p className="muted" style={{ margin: 0 }}>
                      Covered types: {optimizerResult.coveredTypes.join(", ") || "None"}.
                      {optimizerResult.uncoveredTypes.length > 0 && (
                        <> Uncovered: {optimizerResult.uncoveredTypes.join(", ")}.</>
                      )}
                    </p>

                    <div style={{ overflowX: "auto" }}>
                      <table>
                        <thead>
                          <tr>
                            <th>Scenario</th>
                            <th>Type</th>
                            <th>Size</th>
                            <th>Days</th>
                            <th>% of Portfolio</th>
                            <th>Reason</th>
                          </tr>
                        </thead>
                        <tbody>
                          {optimizerResult.recommendations.map((entry) => (
                            <tr key={`${entry.row}-${entry.size}`}>
                              <td>{entry.scenarioName}</td>
                              <td>{entry.scenarioType}</td>
                              <td>{entry.size}</td>
                              <td>{formatNum(entry.days)}</td>
                              <td>{formatNum(entry.portfolioSharePct)}%</td>
                              <td>{entry.reason}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </section>

              <section className="card" style={{ borderStyle: "dashed" }}>
                <div className="grid" style={{ gap: "0.6rem" }}>
                  <div className="row" style={{ justifyContent: "space-between" }}>
                    <span className="muted">Customer</span>
                    <strong>{customerName || "-"}</strong>
                  </div>
                  <div className="row" style={{ justifyContent: "space-between" }}>
                    <span className="muted">Duration</span>
                    <strong>{durationYears} years</strong>
                  </div>
                  <div className="row" style={{ justifyContent: "space-between" }}>
                    <span className="muted">Scenario Types</span>
                    <strong>{selectedTypes.join(", ") || "-"}</strong>
                  </div>
                  <div className="row" style={{ justifyContent: "space-between" }}>
                    <span className="muted">Sizing Mode</span>
                    <strong>{sizingModeLabel}</strong>
                  </div>
                </div>
              </section>

              <div style={{ overflowX: "auto" }}>
                <table>
                  <thead>
                    <tr>
                      <th>Scenario</th>
                      <th>Sizing</th>
                      <th>Service</th>
                      <th>Section</th>
                      <th>Days</th>
                    </tr>
                  </thead>
                  {reviewAllocations.map((allocation) => (
                    <tbody key={allocation.row}>
                      {allocation.services.length === 0 ? (
                        <tr>
                          <td>{allocation.scenarioName}</td>
                          <td>{allocation.sizeLabel}</td>
                          <td colSpan={2} className="muted">
                            {allocation.loading
                              ? "Loading included services..."
                              : allocation.unavailable
                                ? "Service breakdown unavailable for this scenario."
                                : "No services with allocated days."}
                          </td>
                          <td>{formatNum(allocation.totalDays)}</td>
                        </tr>
                      ) : (
                        allocation.services.map((service, index) => (
                          <tr key={`${allocation.row}-${service.serviceName}-${index}`}>
                            {index === 0 && <td rowSpan={allocation.services.length}>{allocation.scenarioName}</td>}
                            {index === 0 && <td rowSpan={allocation.services.length}>{allocation.sizeLabel}</td>}
                            <td>{service.serviceName}</td>
                            <td>{service.sectionName}</td>
                            <td>{formatNum(service.days)}</td>
                          </tr>
                        ))
                      )}

                      <tr className="service-matrix-total-row">
                        <td colSpan={4}>Scenario Total</td>
                        <td>{formatNum(allocation.totalDays)}</td>
                      </tr>
                    </tbody>
                  ))}
                  <tfoot>
                    <tr className="service-matrix-total-row">
                      <td colSpan={4}>Grand Total</td>
                      <td>{formatNum(reviewGrandTotal)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => goBackStep(4)}
                >
                  Back
                </button>

                <div className="row" style={{ flexWrap: "wrap" }}>
                  <button type="button" onClick={savePlan} disabled={!readyToSave || saving}>
                    {saving ? "Saving..." : "Save Project"}
                  </button>
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={exportEngagementCsv}
                    disabled={!activeEngagementId}
                  >
                    Export CSV
                  </button>
                </div>
              </div>

              {savedAt && <p className="muted" style={{ margin: 0 }}>Last saved: {savedAt}</p>}
            </div>
          )}
        </div>

        <aside className="card summary-sticky">
          <h2 style={{ fontSize: "1rem" }}>SAP Plan Snapshot</h2>

          <div className="summary-progress">
            <div className="summary-progress-fill" style={{ width: `${workflowCompletion}%` }} />
          </div>

          <div className="summary-kpis">
            <div>
              <small>Customer</small>
              <strong>{customerName || "-"}</strong>
            </div>
            <div>
              <small>Duration</small>
              <strong>{durationYears}Y</strong>
            </div>
            <div>
              <small>Spread Total</small>
              <strong style={{ color: spreadOverLimit ? "#b64d4d" : "inherit" }}>
                {round2(currentSpreadTotal)}%
              </strong>
            </div>
            <div>
              <small>Scenarios</small>
              <strong>{selectedRows.length}</strong>
            </div>
            <div>
              <small>Total Days</small>
              <strong>{formatNum(quickResult.totals.selectedDays)}</strong>
            </div>
            <div>
              <small>Sizing</small>
              <strong>{useCustomSizing ? (customRows.length === selectedRows.length ? "Custom" : "Mixed") : sidebarSizingLabel}</strong>
            </div>
          </div>

          <div className="grid" style={{ gap: "0.4rem", marginTop: "1rem" }}>
            <span className="badge">Y1: {formatNum(quickResult.totals.y1)}</span>
            <span className="badge">Y2: {formatNum(quickResult.totals.y2)}</span>
            <span className="badge">Y3: {formatNum(quickResult.totals.y3)}</span>
            <span className="badge">Y4: {formatNum(quickResult.totals.y4)}</span>
            <span className="badge">Y5: {formatNum(quickResult.totals.y5)}</span>
          </div>

          <hr style={{ border: 0, borderTop: "1px solid var(--line)", margin: "1rem 0" }} />

          <div className="grid" style={{ gap: "0.4rem" }}>
            <p className="muted" style={{ margin: 0 }}>
              Context: <strong>{basicsValid ? "Complete" : "Needs Input"}</strong>
            </p>
            <p className="muted" style={{ margin: 0 }}>
              Scope: <strong>{typesValid ? "Complete" : "Needs Input"}</strong>
            </p>
            <p className="muted" style={{ margin: 0 }}>
              Scenarios: <strong>{scenariosValid ? "Complete" : "Needs Input"}</strong>
            </p>
            <p className="muted" style={{ margin: 0 }}>
              Expert mode: <strong>{useCustomSizing ? (customValid ? "Complete" : "Needs Fix") : "Not used"}</strong>
            </p>
          </div>

        </aside>
      </section>
    </div>
  );
}
