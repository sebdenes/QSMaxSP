import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { buildEngagementCsv, buildEngagementReportPdf } from "@/lib/exporters";
import { prisma } from "@/lib/prisma";
import { calculateQuickSizer } from "@/lib/quickSizer";
import { getScenarioDrilldown } from "@/lib/scenarioDrilldown";
import { QuickSizerLineItem, QuickSizerSelection, SizeOption } from "@/lib/types";
import { getWorkbookSnapshot } from "@/lib/workbookData";

const VALID_SIZES: SizeOption[] = ["N/A", "S", "M", "L", "Custom"];

type BaselineSize = "S" | "M" | "L";

type ScenarioIndexEntry = {
  id: number;
  name: string;
  totalS: number | null;
  totalM: number | null;
  totalL: number | null;
};

type ServiceDetail = {
  serviceName: string;
  sectionName: string | null;
  days: number;
};

function toId(value: string): number | null {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function safeFileName(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 64);
}

function normalizeSize(value: string): SizeOption {
  return (VALID_SIZES.includes(value as SizeOption) ? value : "N/A") as SizeOption;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function normalizeScenarioKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function isSameDays(left: number | null | undefined, right: number): boolean {
  if (typeof left !== "number" || !Number.isFinite(left)) {
    return false;
  }

  return Math.abs(left - right) < 0.0001;
}

function asBaselineSize(size: SizeOption): BaselineSize | null {
  if (size === "S" || size === "M" || size === "L") {
    return size;
  }

  return null;
}

function daysForBaselineSize(
  effective: { S: number | null; M: number | null; L: number | null; Custom: number | null },
  size: BaselineSize
): number {
  const value = effective[size];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, value);
}

function buildScenarioIdByRow(
  lineItems: QuickSizerLineItem[],
  scenarios: ScenarioIndexEntry[]
): Map<number, number> {
  const map = new Map<number, number>();

  const scenarioBucketsByKey = new Map<string, ScenarioIndexEntry[]>();
  for (const scenario of scenarios) {
    const key = normalizeScenarioKey(scenario.name);
    const list = scenarioBucketsByKey.get(key) ?? [];
    list.push(scenario);
    scenarioBucketsByKey.set(key, list);
  }

  for (const lineItem of lineItems) {
    let matchedScenario: ScenarioIndexEntry | null = null;

    if (lineItem.scenarioLabel) {
      const candidates =
        scenarioBucketsByKey.get(normalizeScenarioKey(lineItem.scenarioLabel)) ?? [];

      if (candidates.length === 1) {
        matchedScenario = candidates[0];
      } else if (candidates.length > 1) {
        const narrowed = candidates.filter(
          (scenario) =>
            isSameDays(scenario.totalS, lineItem.daysBySize.S) &&
            isSameDays(scenario.totalM, lineItem.daysBySize.M) &&
            isSameDays(scenario.totalL, lineItem.daysBySize.L)
        );

        if (narrowed.length === 1) {
          matchedScenario = narrowed[0];
        }
      }
    }

    if (!matchedScenario) {
      const totalMatches = scenarios.filter(
        (scenario) =>
          isSameDays(scenario.totalS, lineItem.daysBySize.S) &&
          isSameDays(scenario.totalM, lineItem.daysBySize.M) &&
          isSameDays(scenario.totalL, lineItem.daysBySize.L)
      );

      if (totalMatches.length === 1) {
        matchedScenario = totalMatches[0];
      }
    }

    if (matchedScenario) {
      map.set(lineItem.row, matchedScenario.id);
    }
  }

  return map;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser(prisma, request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const engagementId = toId(id);
  if (!engagementId) {
    return NextResponse.json({ error: "Invalid engagement id." }, { status: 400 });
  }

  const engagement = await prisma.engagement.findFirst({
    where: { id: engagementId, ownerId: user.id },
    include: { selections: true, customServices: true }
  });

  if (!engagement) {
    return NextResponse.json({ error: "Engagement not found." }, { status: 404 });
  }

  const snapshot = getWorkbookSnapshot();
  const selections: QuickSizerSelection[] = engagement.selections.map((entry) => ({
    row: entry.row,
    size: normalizeSize(entry.size),
    customDays: entry.customDays ?? undefined
  }));

  const spread = {
    y1: engagement.spreadY1,
    y2: engagement.spreadY2,
    y3: engagement.spreadY3,
    y4: engagement.spreadY4,
    y5: engagement.spreadY5
  };

  const result = calculateQuickSizer(snapshot.lineItems, selections, spread);
  const exportRows = result.rows.filter((row) => row.size !== "N/A" && row.selectedDays > 0);
  const exportResult = {
    ...result,
    rows: exportRows
  };

  const scenariosForMatching = await prisma.scenario.findMany({
    select: {
      id: true,
      name: true,
      totalS: true,
      totalM: true,
      totalL: true
    }
  });

  const scenarioIdByRow = buildScenarioIdByRow(snapshot.lineItems, scenariosForMatching);

  const customServicesByRow = new Map<number, ServiceDetail[]>();
  const sortedCustomServices = [...engagement.customServices].sort((a, b) => {
    if (a.scenarioRow !== b.scenarioRow) {
      return a.scenarioRow - b.scenarioRow;
    }

    const sectionCompare = (a.sectionName ?? "").localeCompare(b.sectionName ?? "");
    if (sectionCompare !== 0) {
      return sectionCompare;
    }

    return a.serviceName.localeCompare(b.serviceName);
  });

  for (const service of sortedCustomServices) {
    const list = customServicesByRow.get(service.scenarioRow) ?? [];
    list.push({
      serviceName: service.serviceName,
      sectionName: service.sectionName,
      days: round2(service.days)
    });
    customServicesByRow.set(service.scenarioRow, list);
  }

  const drilldownByScenarioId = new Map<
    number,
    Awaited<ReturnType<typeof getScenarioDrilldown>>
  >();

  const scenarioIdsToLoad = Array.from(
    new Set(
      exportRows.flatMap((row) => {
        const baselineSize = asBaselineSize(row.size);
        const scenarioId = scenarioIdByRow.get(row.row);
        return baselineSize && scenarioId ? [scenarioId] : [];
      })
    )
  );

  await Promise.all(
    scenarioIdsToLoad.map(async (scenarioId) => {
      const drilldown = await getScenarioDrilldown(prisma, scenarioId);
      drilldownByScenarioId.set(scenarioId, drilldown);
    })
  );

  const serviceSummaryByRow: Record<number, string> = {};
  const serviceDetailsByRow: Record<number, ServiceDetail[]> = {};

  for (const row of exportRows) {
    let details: ServiceDetail[] = [];

    if (row.size === "Custom") {
      details = customServicesByRow.get(row.row) ?? [];
    } else {
      const baselineSize = asBaselineSize(row.size);
      const scenarioId = scenarioIdByRow.get(row.row);

      if (baselineSize && scenarioId) {
        const drilldown = drilldownByScenarioId.get(scenarioId);

        if (drilldown) {
          for (const section of drilldown.sections) {
            for (const service of section.services) {
              if (!service.visible) {
                continue;
              }

              const days = daysForBaselineSize(service.effective, baselineSize);
              if (days <= 0) {
                continue;
              }

              details.push({
                serviceName: service.name,
                sectionName: section.name,
                days: round2(days)
              });
            }
          }
        }
      }
    }

    const sortedDetails = [...details].sort((a, b) => {
      const sectionCompare = (a.sectionName ?? "").localeCompare(b.sectionName ?? "");
      if (sectionCompare !== 0) {
        return sectionCompare;
      }

      return a.serviceName.localeCompare(b.serviceName);
    });

    serviceDetailsByRow[row.row] = sortedDetails;
    serviceSummaryByRow[row.row] = sortedDetails.length
      ? sortedDetails.map((service) => `${service.serviceName} (${round2(service.days)}d)`).join("; ")
      : row.size === "Custom"
        ? "Custom service allocation"
        : "Preset package";
  }

  const format = request.nextUrl.searchParams.get("format")?.toLowerCase() ?? "csv";
  const nameSlug = safeFileName(engagement.name || `engagement-${engagement.id}`);

  if (format === "pdf") {
    const pdfBytes = await buildEngagementReportPdf({
      engagementName: engagement.name,
      customerName: engagement.customerName,
      opportunity: engagement.opportunity,
      spread,
      result: exportResult,
      serviceSummaryByRow,
      serviceDetailsByRow
    });

    return new NextResponse(pdfBytes, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${nameSlug}.pdf"`
      }
    });
  }

  const csv = buildEngagementCsv({
    engagementName: engagement.name,
    customerName: engagement.customerName,
    opportunity: engagement.opportunity,
    spread,
    result: exportResult,
    serviceSummaryByRow,
    serviceDetailsByRow
  });

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${nameSlug}.csv"`
    }
  });
}
