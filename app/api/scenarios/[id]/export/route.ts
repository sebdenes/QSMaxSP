import { NextRequest, NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/auth";
import {
  buildScenarioCsv,
  buildScenarioPdfLines,
  buildSimplePdf
} from "@/lib/exporters";
import { prisma } from "@/lib/prisma";
import { getScenarioDrilldown } from "@/lib/scenarioDrilldown";

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

function parseBool(value: string | null | undefined): boolean {
  if (!value) {
    return false;
  }
  const normalized = value.toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireSessionUser(prisma, request);
  if (auth.response) {
    return auth.response;
  }

  const { id } = await context.params;
  const scenarioId = toId(id);
  if (!scenarioId) {
    return NextResponse.json({ error: "Invalid scenario id." }, { status: 400 });
  }

  const drilldown = await getScenarioDrilldown(prisma, scenarioId);
  if (!drilldown) {
    return NextResponse.json({ error: "Scenario not found." }, { status: 404 });
  }

  const includeHiddenRows = parseBool(request.nextUrl.searchParams.get("showHidden"));
  const format = request.nextUrl.searchParams.get("format")?.toLowerCase() ?? "csv";
  const nameSlug = safeFileName(drilldown.scenario.name || `scenario-${scenarioId}`);

  if (format === "pdf") {
    const lines = buildScenarioPdfLines(drilldown, includeHiddenRows);
    const pdfBytes = await buildSimplePdf(
      `Scenario Export: ${drilldown.scenario.name}`,
      lines
    );

    return new NextResponse(pdfBytes, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename=\"${nameSlug}.pdf\"`
      }
    });
  }

  const csv = buildScenarioCsv(drilldown, includeHiddenRows);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename=\"${nameSlug}.csv\"`
    }
  });
}
