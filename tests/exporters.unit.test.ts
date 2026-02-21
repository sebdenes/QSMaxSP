import assert from "node:assert/strict";
import test from "node:test";
import {
  buildEngagementCsv,
  buildEngagementReportPdf,
  buildScenarioCsv,
  buildSimplePdf
} from "../lib/exporters";
import { QuickSizerResult, ScenarioDrilldownResponse } from "../lib/types";

const resultFixture: QuickSizerResult = {
  rows: [
    {
      row: 7,
      name: "Scenario Seven",
      size: "M",
      selectedDays: 40,
      y1: 16,
      y2: 12,
      y3: 8,
      y4: 4,
      y5: 0
    }
  ],
  totals: {
    selectedDays: 40,
    y1: 16,
    y2: 12,
    y3: 8,
    y4: 4,
    y5: 0
  }
};

test("buildEngagementCsv emits metadata, detail rows, and totals", () => {
  const csv = buildEngagementCsv({
    engagementName: "Demo Plan",
    customerName: "ACME",
    opportunity: "Q1",
    spread: { y1: 40, y2: 30, y3: 20, y4: 10, y5: 0 },
    result: resultFixture,
    serviceSummaryByRow: { 7: "Preset package" },
    serviceDetailsByRow: {
      7: [
        { serviceName: "Architecture Point of View", sectionName: "SAP Architecture", days: 24 },
        { serviceName: "Design Evaluation", sectionName: "SAP Safeguarding", days: 16 }
      ]
    }
  });

  assert.match(csv, /Max Success Plan Premium Services Quicksizer Export/);
  assert.match(csv, /SCENARIO SUMMARY/);
  assert.match(csv, /SERVICE ALLOCATION DETAIL/);
  assert.match(csv, /Scenario Total/);
  assert.match(csv, /GRAND TOTAL/);
  assert.match(csv, /Architecture Point of View/);
});

test("buildEngagementCsv includes service rows for mixed S\/M\/L and Custom selections", () => {
  const mixedResult: QuickSizerResult = {
    rows: [
      {
        row: 7,
        name: "Scenario S",
        size: "S",
        selectedDays: 32,
        y1: 12.8,
        y2: 8,
        y3: 6.4,
        y4: 3.2,
        y5: 1.6
      },
      {
        row: 8,
        name: "Scenario M",
        size: "M",
        selectedDays: 40,
        y1: 16,
        y2: 10,
        y3: 8,
        y4: 4,
        y5: 2
      },
      {
        row: 9,
        name: "Scenario L",
        size: "L",
        selectedDays: 60,
        y1: 24,
        y2: 15,
        y3: 12,
        y4: 6,
        y5: 3
      },
      {
        row: 16,
        name: "Scenario Custom",
        size: "Custom",
        selectedDays: 44,
        y1: 17.6,
        y2: 11,
        y3: 8.8,
        y4: 4.4,
        y5: 2.2
      }
    ],
    totals: {
      selectedDays: 176,
      y1: 70.4,
      y2: 44,
      y3: 35.2,
      y4: 17.6,
      y5: 8.8
    }
  };

  const csv = buildEngagementCsv({
    engagementName: "Mixed Plan",
    customerName: "Contoso",
    opportunity: "Pilot",
    spread: { y1: 40, y2: 25, y3: 20, y4: 10, y5: 5 },
    result: mixedResult,
    serviceSummaryByRow: {
      7: "Service A (32d)",
      8: "Service B (40d)",
      9: "Service C (60d)",
      16: "Custom Service X (20d); Custom Service Y (24d)"
    },
    serviceDetailsByRow: {
      7: [{ serviceName: "Service A", sectionName: "Section 1", days: 32 }],
      8: [{ serviceName: "Service B", sectionName: "Section 2", days: 40 }],
      9: [{ serviceName: "Service C", sectionName: "Section 3", days: 60 }],
      16: [
        { serviceName: "Custom Service X", sectionName: "Custom Section", days: 20 },
        { serviceName: "Custom Service Y", sectionName: "Custom Section", days: 24 }
      ]
    }
  });

  assert.match(csv, /Scenario S/);
  assert.match(csv, /Scenario M/);
  assert.match(csv, /Scenario L/);
  assert.match(csv, /Scenario Custom/);
  assert.match(csv, /Custom Service X/);
  assert.match(csv, /Custom Service Y/);
  assert.match(csv, /Scenario Total/);
  assert.match(csv, /GRAND TOTAL/);
  assert.doesNotMatch(csv, /Preset package/);
});

test("buildScenarioCsv respects hidden row mode flag", () => {
  const drilldown: ScenarioDrilldownResponse = {
    scenario: {
      id: 1,
      name: "Demo Scenario",
      layout: "standard",
      totalS: 10,
      totalM: 20,
      totalL: 30,
      totalCustom: 0,
      overrideCount: 1
    },
    sections: [
      {
        id: 1,
        workbookRow: 10,
        name: "Section A",
        totals: { S: 10, M: 20, L: 30, Custom: 0 },
        visibleTotals: { S: 5, M: 10, L: 15, Custom: 0 },
        services: [
          {
            id: 1,
            row: 11,
            name: "Visible Service",
            crmId: null,
            defaultEffort: null,
            visible: true,
            template: { S: 5, M: 10, L: 15, Custom: null, Details: null },
            effective: { S: 5, M: 10, L: 15, Custom: null, Details: null },
            overrides: { S: false, M: false, L: false, Custom: false, Details: false }
          },
          {
            id: 2,
            row: 12,
            name: "Hidden Service",
            crmId: null,
            defaultEffort: null,
            visible: false,
            template: { S: 5, M: 10, L: 15, Custom: null, Details: null },
            effective: { S: 5, M: 10, L: 15, Custom: null, Details: null },
            overrides: { S: false, M: false, L: false, Custom: false, Details: false }
          }
        ]
      }
    ]
  };

  const visibleOnly = buildScenarioCsv(drilldown, false);
  const withHidden = buildScenarioCsv(drilldown, true);

  assert.match(visibleOnly, /Visible Service/);
  assert.doesNotMatch(visibleOnly, /Hidden Service/);
  assert.match(withHidden, /Hidden Service/);
});

test("PDF builders generate valid PDF content", async () => {
  const simplePdf = await buildSimplePdf("Quick Test", ["Line 1", "Line 2"]);
  const simpleText = Buffer.from(simplePdf).toString("ascii");

  assert.match(simpleText, /^%PDF-1\.4/);
  assert.match(simpleText, /Quick Test/);

  const reportPdf = await buildEngagementReportPdf({
    engagementName: "Demo Plan",
    customerName: "ACME",
    opportunity: "Q1",
    spread: { y1: 40, y2: 30, y3: 20, y4: 10, y5: 0 },
    result: resultFixture,
    serviceSummaryByRow: { 7: "Preset package" },
    serviceDetailsByRow: {
      7: [{ serviceName: "Architecture Point of View", sectionName: "SAP Architecture", days: 40 }]
    }
  });

  const reportText = Buffer.from(reportPdf).toString("ascii");
  assert.match(reportText, /^%PDF-1\.4/);
  assert.match(reportText, /Max Success Plan Premium Services Quicksizer/);
});
