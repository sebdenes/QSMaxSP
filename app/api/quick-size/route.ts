import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { calculateQuickSizer } from "@/lib/quickSizer";
import { prisma } from "@/lib/prisma";
import { QuickSizerSelection, Spread } from "@/lib/types";
import { getWorkbookSnapshot } from "@/lib/workbookData";

type RequestPayload = {
  selections?: QuickSizerSelection[];
  spread?: Partial<Spread>;
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

function spreadTotal(spread?: Partial<Spread>): number {
  if (!spread) {
    return 0;
  }

  return (
    Math.max(0, asFinite(spread.y1)) +
    Math.max(0, asFinite(spread.y2)) +
    Math.max(0, asFinite(spread.y3)) +
    Math.max(0, asFinite(spread.y4)) +
    Math.max(0, asFinite(spread.y5))
  );
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser(prisma, request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: RequestPayload;

  try {
    payload = (await request.json()) as RequestPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  if (spreadTotal(payload.spread) > 100.000001) {
    return NextResponse.json(
      { error: "Total spread across years cannot exceed 100%." },
      { status: 400 }
    );
  }

  const snapshot = getWorkbookSnapshot();
  const selections = Array.isArray(payload.selections) ? payload.selections : [];
  const result = calculateQuickSizer(snapshot.lineItems, selections, payload.spread);

  return NextResponse.json(result);
}
