import { NextRequest, NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/auth";
import { optimizeScenarioPlan } from "@/lib/scenarioOptimizer";
import { OptimizerStrategy, Spread } from "@/lib/types";
import { prisma } from "@/lib/prisma";
import { getWorkbookSnapshot } from "@/lib/workbookData";

type OptimizerPayload = {
  targetDays?: unknown;
  durationYears?: unknown;
  spread?: Partial<Spread>;
  strategy?: unknown;
  candidateRows?: unknown;
};

function asFinite(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return 0;
}

function parseStrategy(value: unknown): OptimizerStrategy {
  if (value === "balanced" || value === "coverage" || value === "depth") {
    return value;
  }
  return "balanced";
}

function parseCandidateRows(value: unknown): number[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const rows = value
    .map((entry) => Number(entry))
    .filter((entry) => Number.isInteger(entry) && entry > 0);

  if (!rows.length) {
    return undefined;
  }

  return Array.from(new Set(rows));
}

export async function POST(request: NextRequest) {
  const auth = await requireSessionUser(prisma, request);
  if (auth.response) {
    return auth.response;
  }

  let payload: OptimizerPayload;

  try {
    payload = (await request.json()) as OptimizerPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const targetDays = asFinite(payload.targetDays);
  if (targetDays <= 0) {
    return NextResponse.json(
      { error: "targetDays must be a positive number." },
      { status: 400 }
    );
  }

  const snapshot = getWorkbookSnapshot();
  const result = optimizeScenarioPlan(snapshot.lineItems, {
    targetDays,
    durationYears: asFinite(payload.durationYears),
    spread: payload.spread,
    strategy: parseStrategy(payload.strategy),
    candidateRows: parseCandidateRows(payload.candidateRows)
  });

  return NextResponse.json(result);
}
