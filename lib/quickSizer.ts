import {
  QuickSizerLineItem,
  QuickSizerResult,
  QuickSizerSelection,
  SizeOption,
  Spread
} from "@/lib/types";

const DEFAULT_SPREAD: Spread = { y1: 50, y2: 25, y3: 25, y4: 0, y5: 0 };

function toSpreadFactor(value: number): number {
  return Number.isFinite(value) ? value / 100 : 0;
}

function sanitizeSpreadValue(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }
  if (value < 0) {
    return 0;
  }
  if (value > 100) {
    return 100;
  }
  return value;
}

export function normalizeSpread(spread?: Partial<Spread>): Spread {
  const raw: Spread = {
    y1: sanitizeSpreadValue(spread?.y1 ?? DEFAULT_SPREAD.y1),
    y2: sanitizeSpreadValue(spread?.y2 ?? DEFAULT_SPREAD.y2),
    y3: sanitizeSpreadValue(spread?.y3 ?? DEFAULT_SPREAD.y3),
    y4: sanitizeSpreadValue(spread?.y4 ?? DEFAULT_SPREAD.y4),
    y5: sanitizeSpreadValue(spread?.y5 ?? DEFAULT_SPREAD.y5)
  };

  const total = raw.y1 + raw.y2 + raw.y3 + raw.y4 + raw.y5;
  if (total <= 100) {
    return raw;
  }

  const factor = 100 / total;
  return {
    y1: raw.y1 * factor,
    y2: raw.y2 * factor,
    y3: raw.y3 * factor,
    y4: raw.y4 * factor,
    y5: raw.y5 * factor
  };
}

function resolvedDays(
  item: QuickSizerLineItem,
  size: SizeOption,
  customDays?: number
): number {
  if (size === "N/A") {
    return 0;
  }

  if (size === "Custom") {
    if (typeof customDays === "number" && Number.isFinite(customDays) && customDays >= 0) {
      return customDays;
    }
    return item.daysBySize.Custom;
  }

  return item.daysBySize[size] ?? 0;
}

export function calculateQuickSizer(
  lineItems: QuickSizerLineItem[],
  selections: QuickSizerSelection[],
  spreadInput?: Partial<Spread>
): QuickSizerResult {
  const spread = normalizeSpread(spreadInput);
  const map = new Map<number, QuickSizerSelection>();

  for (const selection of selections) {
    map.set(selection.row, selection);
  }

  const rows = lineItems.map((item) => {
    const selection = map.get(item.row);
    const size = selection?.size ?? "N/A";
    const selectedDays = resolvedDays(item, size, selection?.customDays);

    const y1 = selectedDays * toSpreadFactor(spread.y1);
    const y2 = selectedDays * toSpreadFactor(spread.y2);
    const y3 = selectedDays * toSpreadFactor(spread.y3);
    const y4 = selectedDays * toSpreadFactor(spread.y4);
    const y5 = selectedDays * toSpreadFactor(spread.y5);

    return {
      row: item.row,
      name: item.name,
      size,
      selectedDays,
      y1,
      y2,
      y3,
      y4,
      y5
    };
  });

  const totals = rows.reduce(
    (acc, row) => {
      acc.selectedDays += row.selectedDays;
      acc.y1 += row.y1;
      acc.y2 += row.y2;
      acc.y3 += row.y3;
      acc.y4 += row.y4;
      acc.y5 += row.y5;
      return acc;
    },
    { selectedDays: 0, y1: 0, y2: 0, y3: 0, y4: 0, y5: 0 }
  );

  return { rows, totals };
}
