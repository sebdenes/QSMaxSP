export type SizeOption = "N/A" | "S" | "M" | "L" | "Custom";

export type Spread = {
  y1: number;
  y2: number;
  y3: number;
  y4: number;
  y5: number;
};

export type QuickSizerLineItem = {
  row: number;
  workbookId: number;
  name: string;
  scenarioLabel?: string;
  daysBySize: {
    S: number;
    M: number;
    L: number;
    Custom: number;
  };
};

export type ScenarioSummary = {
  id?: number;
  name: string;
  totalS: number;
  totalM: number;
  totalL: number;
  totalCustom: number;
  layout: "standard" | "extended";
  customTotalCell: string;
  overrideCount: number;
};

export type WorkbookSnapshot = {
  lineItems: QuickSizerLineItem[];
  scenarios: ScenarioSummary[];
  spreadDefaults: Spread;
};

export type QuickSizerSelection = {
  row: number;
  size: SizeOption;
  customDays?: number;
};

export type QuickSizerRowResult = {
  row: number;
  name: string;
  size: SizeOption;
  selectedDays: number;
  y1: number;
  y2: number;
  y3: number;
  y4: number;
  y5: number;
};

export type QuickSizerResult = {
  rows: QuickSizerRowResult[];
  totals: {
    selectedDays: number;
    y1: number;
    y2: number;
    y3: number;
    y4: number;
    y5: number;
  };
};

export type OptimizerStrategy = "balanced" | "coverage" | "depth";

export type ScenarioOptimizerSelection = {
  row: number;
  size: "S" | "M" | "L";
};

export type ScenarioOptimizerRecommendation = {
  row: number;
  scenarioName: string;
  scenarioType: string;
  size: "S" | "M" | "L";
  days: number;
  portfolioSharePct: number;
  reason: string;
};

export type ScenarioOptimizerResult = {
  strategy: OptimizerStrategy;
  targetDays: number;
  totalDays: number;
  utilizationPct: number;
  durationYears: number;
  spread: Spread;
  selectedScenarioCount: number;
  coveredTypes: string[];
  uncoveredTypes: string[];
  yearTotals: Spread;
  selections: ScenarioOptimizerSelection[];
  recommendations: ScenarioOptimizerRecommendation[];
};

export type AuthUser = {
  id: number;
  email: string;
  name: string | null;
  role: "ADMIN" | "PLANNER" | "VIEWER";
  createdAt: string;
  updatedAt: string;
};

export type EngagementSummary = {
  id: number;
  name: string;
  customerName: string | null;
  opportunity: string | null;
  notes: string | null;
  durationYears: number;
  spreadY1: number;
  spreadY2: number;
  spreadY3: number;
  spreadY4: number;
  spreadY5: number;
  createdAt: string;
  updatedAt: string;
  _count?: {
    selections: number;
  };
};

export type EngagementSelectionRecord = {
  id?: number;
  engagementId?: number;
  row: number;
  size: SizeOption;
  customDays: number | null;
};

export type EngagementCustomServiceRecord = {
  id?: number;
  engagementId?: number;
  scenarioRow: number;
  serviceKey: string;
  serviceId: number | null;
  serviceName: string;
  sectionName: string | null;
  days: number;
};

export type EngagementDetail = EngagementSummary & {
  selections: EngagementSelectionRecord[];
  customServices: EngagementCustomServiceRecord[];
};

export type ScenarioDrilldownSectionService = {
  id: number;
  row: number;
  name: string;
  crmId: string | null;
  defaultEffort: number | null;
  visible: boolean;
  template: {
    S: number | null;
    M: number | null;
    L: number | null;
    Custom: number | null;
    Details: string | null;
  };
  effective: {
    S: number | null;
    M: number | null;
    L: number | null;
    Custom: number | null;
    Details: string | null;
  };
  overrides: {
    S: boolean;
    M: boolean;
    L: boolean;
    Custom: boolean;
    Details: boolean;
  };
};

export type ScenarioDrilldownSection = {
  id: number;
  workbookRow: number;
  name: string;
  totals: {
    S: number;
    M: number;
    L: number;
    Custom: number;
  };
  visibleTotals: {
    S: number;
    M: number;
    L: number;
    Custom: number;
  };
  services: ScenarioDrilldownSectionService[];
};

export type ScenarioDrilldownResponse = {
  scenario: {
    id: number;
    name: string;
    layout: string;
    totalS: number | null;
    totalM: number | null;
    totalL: number | null;
    totalCustom: number | null;
    overrideCount: number;
  };
  sections: ScenarioDrilldownSection[];
};

export type ImportRunRecord = {
  id: number;
  sourcePath: string;
  status: string;
  message: string | null;
  rowsDetected: number | null;
  scenariosDetected: number | null;
  servicesDetected: number | null;
  createdAt: string;
  updatedAt: string;
  importedAt: string | null;
};
