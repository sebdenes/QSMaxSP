import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { buildEngagementCsv, buildEngagementReportPdf } from "@/lib/exporters";
import { prisma } from "@/lib/prisma";
import { calculateQuickSizer } from "@/lib/quickSizer";
import { QuickSizerSelection, SizeOption } from "@/lib/types";
import { getWorkbookSnapshot } from "@/lib/workbookData";

const VALID_SIZES: SizeOption[] = ["N/A", "S", "M", "L", "Custom"];

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

  const format = request.nextUrl.searchParams.get("format")?.toLowerCase() ?? "csv";
  const nameSlug = safeFileName(engagement.name || `engagement-${engagement.id}`);

  if (format === "pdf") {
    const customServicesByRow = new Map<number, string[]>();
    const sortedServices = [...engagement.customServices].sort((a, b) => {
      if (a.scenarioRow !== b.scenarioRow) {
        return a.scenarioRow - b.scenarioRow;
      }
      return a.serviceName.localeCompare(b.serviceName);
    });

    for (const service of sortedServices) {
      const list = customServicesByRow.get(service.scenarioRow) ?? [];
      list.push(`${service.serviceName} (${service.days}d)`);
      customServicesByRow.set(service.scenarioRow, list);
    }

    const serviceSummaryByRow: Record<number, string> = {};
    for (const [row, services] of customServicesByRow.entries()) {
      serviceSummaryByRow[row] = services.join("; ");
    }

    const pdfBytes = await buildEngagementReportPdf({
      engagementName: engagement.name,
      customerName: engagement.customerName,
      opportunity: engagement.opportunity,
      spread,
      result: exportResult,
      serviceSummaryByRow
    });

    return new NextResponse(pdfBytes, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename=\"${nameSlug}.pdf\"`
      }
    });
  }

  const csv = buildEngagementCsv({
    engagementName: engagement.name,
    customerName: engagement.customerName,
    opportunity: engagement.opportunity,
    spread,
    result: exportResult
  });

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename=\"${nameSlug}.csv\"`
    }
  });
}
