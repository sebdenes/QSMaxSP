import { NextRequest, NextResponse } from "next/server";
import { requireSessionUser, sanitizeUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const auth = await requireSessionUser(prisma, request);
  if (auth.response) {
    return auth.response;
  }

  return NextResponse.json({ user: sanitizeUser(auth.user) });
}
