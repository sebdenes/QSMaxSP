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
