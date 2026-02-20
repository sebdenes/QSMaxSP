export type DomainSection = {
  header_row: number;
  name: string;
  crm_id?: string | null;
  start_row: number;
  end_row: number;
};

export type DomainServiceItem = {
  row: number;
  section: string;
  service_name: string;
  crm_id?: string | null;
  default_effort?: string | number | null;
  template_S?: string | number | null;
  template_M?: string | number | null;
  template_L?: string | number | null;
  template_Custom?: string | number | null;
  template_Details?: string | null;
};

export type DomainScenarioOverride = {
  row: number;
  service_name?: string;
  changes: {
    S?: string | number | null;
    M?: string | number | null;
    L?: string | number | null;
    Custom?: string | number | null;
    Details?: string | null;
  };
};

export type DomainScenario = {
  name: string;
  override_count: number;
  overrides: DomainScenarioOverride[];
  totals_row2: {
    S: string | number | null;
    M: string | number | null;
    L: string | number | null;
    Custom: string | number | null;
    layout: "standard" | "extended";
    custom_total_cell: string;
    totals_total_cell?: string | null;
  };
};

export type DomainModel = {
  sections: DomainSection[];
  section_count: number;
  service_count: number;
  service_items: DomainServiceItem[];
  scenarios: DomainScenario[];
  scenario_count: number;
};

export type VisibilityEntry = {
  name: string;
  hidden_rows_count: number;
  visible_service_rows: number;
  visible_sections: string[];
  hidden_sections: string[];
  hidden_rows_sorted: number[];
};

export type TotalsCell = {
  ref: string;
  formula?: string;
  shared_si?: string | null;
  value: string | number | null;
};

export type TotalsScenarioEntry = {
  scenario: string;
  E2?: TotalsCell | null;
  F2?: TotalsCell | null;
  G2?: TotalsCell | null;
  H2?: TotalsCell | null;
  I2?: TotalsCell | null;
  J2?: TotalsCell | null;
  visible_rows?: number;
};

export type TotalsMainRow = {
  row: number;
  [key: string]: TotalsCell | number | undefined;
};

export type TotalsData = {
  scenario_totals: TotalsScenarioEntry[];
  main_sheet_rows: TotalsMainRow[];
};

export type WorkbookProfile = {
  sheet_count: number;
  sheet_names: string[];
  defined_names: Array<{ name: string; localSheetId?: string | null; text: string }>;
  sheets: Array<{
    name: string;
    dimension?: string;
    formula_cells: number;
    comment_count: number;
    data_validation_count: number;
    hidden_rows_count: number;
  }>;
};
