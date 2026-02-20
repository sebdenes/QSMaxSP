import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const VALID_SIZES = new Set(["N/A", "S", "M", "L", "Custom"]);

type SelectionInput = {
  row: number;
  size: string;
  customDays?: number | null;
};

type CustomServiceInput = {
  scenarioRow: number;
  serviceKey: string;
  serviceId: number | null;
  serviceName: string;
  sectionName: string | null;
  days: number;
};

type SpreadValues = {
  y1: number;
  y2: number;
  y3: number;
  y4: number;
  y5: number;
};

function toId(value: string): number | null {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function asString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

function asDurationYears(value: unknown): number | null {
  const parsed = asNumber(value);
  if (parsed === null || !Number.isInteger(parsed)) {
    return null;
  }

  if (parsed < 1 || parsed > 5) {
    return null;
  }

  return parsed;
}

function asSpreadValue(value: unknown, fallback: number): number | null {
  if (value === undefined) {
    return fallback;
  }

  const parsed = asNumber(value);
  if (parsed === null) {
    return null;
  }

  if (parsed < 0) {
    return 0;
  }

  if (parsed > 100) {
    return 100;
  }

  return parsed;
}

function coerceSpreadToDuration(spread: SpreadValues, durationYears: number): SpreadValues {
  const values = [spread.y1, spread.y2, spread.y3, spread.y4, spread.y5];
  for (let idx = durationYears; idx < values.length; idx += 1) {
    values[idx] = 0;
  }

  return {
    y1: values[0],
    y2: values[1],
    y3: values[2],
    y4: values[3],
    y5: values[4]
  };
}

function spreadTotal(spread: SpreadValues): number {
  return spread.y1 + spread.y2 + spread.y3 + spread.y4 + spread.y5;
}

function normalizeSelections(value: unknown): SelectionInput[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const normalized: SelectionInput[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") {
      continue;
    }

    const row = asNumber((entry as Record<string, unknown>).row);
    const size = asString((entry as Record<string, unknown>).size);
    const customDays = asNumber((entry as Record<string, unknown>).customDays);

    if (!row || !size || !VALID_SIZES.has(size)) {
      continue;
    }

    normalized.push({
      row: Math.round(row),
      size,
      customDays
    });
  }

  return normalized;
}

function normalizeCustomServices(value: unknown): CustomServiceInput[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const normalized: CustomServiceInput[] = [];

  for (const entry of value) {
    if (!entry || typeof entry !== "object") {
      continue;
    }

    const row = asNumber((entry as Record<string, unknown>).scenarioRow);
    const serviceKey = asString((entry as Record<string, unknown>).serviceKey);
    const serviceIdRaw = asNumber((entry as Record<string, unknown>).serviceId);
    const serviceName = asString((entry as Record<string, unknown>).serviceName);
    const sectionNameRaw = (entry as Record<string, unknown>).sectionName;
    const sectionName = sectionNameRaw === null ? null : asString(sectionNameRaw);
    const daysRaw = asNumber((entry as Record<string, unknown>).days);

    if (
      !row ||
      !Number.isInteger(row) ||
      !serviceKey ||
      !serviceName ||
      !daysRaw ||
      !Number.isFinite(daysRaw)
    ) {
      continue;
    }

    const serviceId =
      serviceIdRaw && Number.isInteger(serviceIdRaw) && serviceIdRaw > 0
        ? Math.round(serviceIdRaw)
        : null;

    normalized.push({
      scenarioRow: Math.round(row),
      serviceKey,
      serviceId,
      serviceName,
      sectionName,
      days: Math.max(10, daysRaw)
    });
  }

  return normalized;
}

async function findOwnedEngagement(engagementId: number, ownerId: number) {
  return prisma.engagement.findFirst({
    where: {
      id: engagementId,
      ownerId
    }
  });
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

  const owned = await findOwnedEngagement(engagementId, user.id);
  if (!owned) {
    return NextResponse.json({ error: "Engagement not found." }, { status: 404 });
  }

  const engagement = await prisma.engagement.findUnique({
    where: { id: engagementId },
    include: {
      selections: {
        orderBy: { row: "asc" }
      },
      customServices: {
        orderBy: [{ scenarioRow: "asc" }, { serviceName: "asc" }]
      }
    }
  });

  return NextResponse.json(engagement);
}

export async function PUT(
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

  const owned = await findOwnedEngagement(engagementId, user.id);
  if (!owned) {
    return NextResponse.json({ error: "Engagement not found." }, { status: 404 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const durationYears =
    payload.durationYears === undefined ? owned.durationYears : asDurationYears(payload.durationYears);
  if (!durationYears) {
    return NextResponse.json(
      { error: "Duration must be an integer from 1 to 5 years." },
      { status: 400 }
    );
  }

  const spreadY1 = asSpreadValue(payload.spreadY1, owned.spreadY1);
  const spreadY2 = asSpreadValue(payload.spreadY2, owned.spreadY2);
  const spreadY3 = asSpreadValue(payload.spreadY3, owned.spreadY3);
  const spreadY4 = asSpreadValue(payload.spreadY4, owned.spreadY4);
  const spreadY5 = asSpreadValue(payload.spreadY5, owned.spreadY5);

  if (
    spreadY1 === null ||
    spreadY2 === null ||
    spreadY3 === null ||
    spreadY4 === null ||
    spreadY5 === null
  ) {
    return NextResponse.json({ error: "Spread values must be valid numbers." }, { status: 400 });
  }

  const spread = coerceSpreadToDuration(
    {
      y1: spreadY1,
      y2: spreadY2,
      y3: spreadY3,
      y4: spreadY4,
      y5: spreadY5
    },
    durationYears
  );

  if (spreadTotal(spread) > 100.000001) {
    return NextResponse.json(
      { error: "Total spread across years cannot exceed 100%." },
      { status: 400 }
    );
  }

  const selections = normalizeSelections(payload.selections);
  if (payload.selections !== undefined && selections === null) {
    return NextResponse.json({ error: "Selections payload must be an array." }, { status: 400 });
  }

  const customServices = normalizeCustomServices(payload.customServices);
  if (payload.customServices !== undefined && customServices === null) {
    return NextResponse.json(
      { error: "Custom services payload must be an array." },
      { status: 400 }
    );
  }

  const updated = await prisma.$transaction(async (tx) => {
    const engagement = await tx.engagement.update({
      where: { id: engagementId },
      data: {
        name: asString(payload.name) ?? undefined,
        customerName: payload.customerName === null ? null : asString(payload.customerName),
        opportunity: payload.opportunity === null ? null : asString(payload.opportunity),
        notes: payload.notes === null ? null : asString(payload.notes),
        durationYears,
        spreadY1: spread.y1,
        spreadY2: spread.y2,
        spreadY3: spread.y3,
        spreadY4: spread.y4,
        spreadY5: spread.y5
      }
    });

    if (selections) {
      await tx.engagementSelection.deleteMany({ where: { engagementId } });
      if (selections.length > 0) {
        await tx.engagementSelection.createMany({
          data: selections.map((selection) => ({
            engagementId,
            row: selection.row,
            size: selection.size,
            customDays: selection.customDays ?? null
          }))
        });
      }
    }

    if (customServices) {
      await tx.engagementScenarioService.deleteMany({ where: { engagementId } });
      if (customServices.length > 0) {
        await tx.engagementScenarioService.createMany({
          data: customServices.map((entry) => ({
            engagementId,
            scenarioRow: entry.scenarioRow,
            serviceKey: entry.serviceKey,
            serviceId: entry.serviceId,
            serviceName: entry.serviceName,
            sectionName: entry.sectionName,
            days: entry.days
          }))
        });
      }
    }

    return engagement;
  });

  const hydrated = await prisma.engagement.findUnique({
    where: { id: updated.id },
    include: {
      selections: {
        orderBy: { row: "asc" }
      },
      customServices: {
        orderBy: [{ scenarioRow: "asc" }, { serviceName: "asc" }]
      }
    }
  });

  return NextResponse.json(hydrated);
}

export async function DELETE(
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

  const owned = await findOwnedEngagement(engagementId, user.id);
  if (!owned) {
    return NextResponse.json({ error: "Engagement not found." }, { status: 404 });
  }

  await prisma.engagement.delete({ where: { id: engagementId } });
  return NextResponse.json({ ok: true });
}
