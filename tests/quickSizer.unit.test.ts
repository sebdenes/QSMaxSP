import assert from "node:assert/strict";
import test from "node:test";
import { calculateQuickSizer, normalizeSpread } from "../lib/quickSizer";
import { QuickSizerLineItem, QuickSizerSelection } from "../lib/types";

test("normalizeSpread clamps invalid values and rescales totals above 100", () => {
  const spread = normalizeSpread({ y1: 150, y2: -20, y3: 40, y4: 30, y5: 20 });
  const total = spread.y1 + spread.y2 + spread.y3 + spread.y4 + spread.y5;

  assert.ok(Math.abs(total - 100) < 1e-9);
  assert.ok(spread.y1 > spread.y3);
  assert.equal(spread.y2, 0);
});

test("calculateQuickSizer supports per-row mixed sizes and custom days", () => {
  const items: QuickSizerLineItem[] = [
    {
      row: 1,
      workbookId: 101,
      name: "Scenario A",
      daysBySize: { S: 10, M: 20, L: 30, Custom: 40 }
    },
    {
      row: 2,
      workbookId: 102,
      name: "Scenario B",
      daysBySize: { S: 15, M: 25, L: 35, Custom: 45 }
    },
    {
      row: 3,
      workbookId: 103,
      name: "Scenario C",
      daysBySize: { S: 12, M: 22, L: 32, Custom: 42 }
    }
  ];

  const selections: QuickSizerSelection[] = [
    { row: 1, size: "L" },
    { row: 2, size: "S" },
    { row: 3, size: "Custom", customDays: 18 }
  ];

  const result = calculateQuickSizer(items, selections, {
    y1: 50,
    y2: 30,
    y3: 20,
    y4: 0,
    y5: 0
  });

  assert.equal(result.rows[0].selectedDays, 30);
  assert.equal(result.rows[1].selectedDays, 15);
  assert.equal(result.rows[2].selectedDays, 18);
  assert.equal(result.totals.selectedDays, 63);
  assert.equal(result.totals.y1, 31.5);
  assert.equal(result.totals.y2, 18.9);
  assert.equal(result.totals.y3, 12.6);
});
