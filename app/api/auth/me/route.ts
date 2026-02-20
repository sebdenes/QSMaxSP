import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, sanitizeUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const user = await getSessionUser(prisma, request);

  if (!user) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  return NextResponse.json({ user: sanitizeUser(user) });
}
