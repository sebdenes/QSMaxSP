import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getScenarioDrilldown } from "@/lib/scenarioDrilldown";

function toId(value: string): number | null {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
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
  const scenarioId = toId(id);

  if (!scenarioId) {
    return NextResponse.json({ error: "Invalid scenario id." }, { status: 400 });
  }

  const drilldown = await getScenarioDrilldown(prisma, scenarioId);

  if (!drilldown) {
    return NextResponse.json({ error: "Scenario not found." }, { status: 404 });
  }

  return NextResponse.json(drilldown);
}
