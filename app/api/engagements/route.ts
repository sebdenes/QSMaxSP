import { NextRequest, NextResponse } from "next/server";
import { EDITOR_ROLES, requireSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type SpreadValues = {
  y1: number;
  y2: number;
  y3: number;
  y4: number;
  y5: number;
};

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

function asSpreadValue(value: unknown, fallback: number): number {
  const parsed = asNumber(value);
  if (parsed === null) {
    return fallback;
  }

  if (parsed < 0) {
    return 0;
  }

  if (parsed > 100) {
    return 100;
  }

  return parsed;
}

function buildDefaultSpread(durationYears: number): SpreadValues {
  const values = [0, 0, 0, 0, 0];
  const base = Math.floor(10000 / durationYears) / 100;
  let remaining = 100;

  for (let idx = 0; idx < durationYears; idx += 1) {
    const value = idx === durationYears - 1 ? remaining : base;
    values[idx] = Math.round(value * 100) / 100;
    remaining = Math.round((remaining - values[idx]) * 100) / 100;
  }

  return {
    y1: values[0],
    y2: values[1],
    y3: values[2],
    y4: values[3],
    y5: values[4]
  };
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

export async function GET(request: NextRequest) {
  const auth = await requireSessionUser(prisma, request);
  if (auth.response) {
    return auth.response;
  }

  const engagements = await prisma.engagement.findMany({
    where: { ownerId: auth.user.id },
    orderBy: { updatedAt: "desc" },
    include: {
      _count: {
        select: { selections: true }
      }
    }
  });

  return NextResponse.json(engagements);
}

export async function POST(request: NextRequest) {
  const auth = await requireSessionUser(prisma, request, EDITOR_ROLES);
  if (auth.response) {
    return auth.response;
  }

  let payload: Record<string, unknown>;

  try {
    payload = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const customerName = asString(payload.customerName);
  if (!customerName) {
    return NextResponse.json({ error: "Customer name is required." }, { status: 400 });
  }

  const durationYears = asDurationYears(payload.durationYears);
  if (!durationYears) {
    return NextResponse.json(
      { error: "Duration is required and must be an integer from 1 to 5 years." },
      { status: 400 }
    );
  }

  const explicitName = asString(payload.name);
  const name = explicitName ?? `${customerName} - ${durationYears}Y Engagement`;

  const baseSpread = buildDefaultSpread(durationYears);
  const spread = coerceSpreadToDuration(
    {
      y1: asSpreadValue(payload.spreadY1, baseSpread.y1),
      y2: asSpreadValue(payload.spreadY2, baseSpread.y2),
      y3: asSpreadValue(payload.spreadY3, baseSpread.y3),
      y4: asSpreadValue(payload.spreadY4, baseSpread.y4),
      y5: asSpreadValue(payload.spreadY5, baseSpread.y5)
    },
    durationYears
  );

  if (spreadTotal(spread) > 100.000001) {
    return NextResponse.json(
      { error: "Total spread across years cannot exceed 100%." },
      { status: 400 }
    );
  }

  const created = await prisma.engagement.create({
    data: {
      ownerId: auth.user.id,
      name,
      customerName,
      opportunity: asString(payload.opportunity),
      notes: asString(payload.notes),
      durationYears,
      spreadY1: spread.y1,
      spreadY2: spread.y2,
      spreadY3: spread.y3,
      spreadY4: spread.y4,
      spreadY5: spread.y5
    }
  });

  return NextResponse.json(created, { status: 201 });
}
