import assert from "node:assert/strict";
import test from "node:test";
import { optimizeScenarioPlan } from "../lib/scenarioOptimizer";
import { QuickSizerLineItem } from "../lib/types";

const lineItems: QuickSizerLineItem[] = [
  {
    row: 7,
    workbookId: 107,
    name: "Strategy Scenario",
    daysBySize: { S: 10, M: 20, L: 30, Custom: 30 }
  },
  {
    row: 8,
    workbookId: 108,
    name: "Cloud Scenario",
    daysBySize: { S: 12, M: 22, L: 36, Custom: 36 }
  },
  {
    row: 15,
    workbookId: 115,
    name: "Finance Scenario",
    daysBySize: { S: 8, M: 16, L: 28, Custom: 28 }
  }
];

test("optimizer respects target budget while maximizing scoped recommendations", () => {
  const result = optimizeScenarioPlan(lineItems, {
    targetDays: 35,
    strategy: "balanced",
    durationYears: 3,
    spread: { y1: 40, y2: 35, y3: 25, y4: 0, y5: 0 }
  });

  assert.ok(result.selectedScenarioCount > 0);
  assert.ok(result.totalDays <= 35.000001);
  assert.ok(result.recommendations.every((entry) => entry.days > 0));
  assert.equal(result.strategy, "balanced");
});

test("optimizer honors candidate row scoping", () => {
  const result = optimizeScenarioPlan(lineItems, {
    targetDays: 100,
    strategy: "coverage",
    candidateRows: [7, 15]
  });

  assert.ok(result.recommendations.length > 0);
  assert.ok(result.recommendations.every((entry) => entry.row === 7 || entry.row === 15));
  assert.ok(result.selections.every((entry) => entry.row === 7 || entry.row === 15));
});

test("optimizer zeroes inactive years based on duration", () => {
  const result = optimizeScenarioPlan(lineItems, {
    targetDays: 30,
    strategy: "depth",
    durationYears: 2
  });

  assert.equal(result.durationYears, 2);
  assert.equal(result.yearTotals.y3, 0);
  assert.equal(result.yearTotals.y4, 0);
  assert.equal(result.yearTotals.y5, 0);
});
