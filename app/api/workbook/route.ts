import { NextRequest, NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getWorkbookSnapshot } from "@/lib/workbookData";

export async function GET(request: NextRequest) {
  const auth = await requireSessionUser(prisma, request);
  if (auth.response) {
    return auth.response;
  }

  const snapshot = getWorkbookSnapshot();
  return NextResponse.json(snapshot);
}
