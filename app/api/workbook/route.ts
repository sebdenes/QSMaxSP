import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getWorkbookSnapshot } from "@/lib/workbookData";

export async function GET(request: NextRequest) {
  const user = await getSessionUser(prisma, request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const snapshot = getWorkbookSnapshot();
  return NextResponse.json(snapshot);
}
