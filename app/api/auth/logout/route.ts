import { NextRequest, NextResponse } from "next/server";
import { clearSessionCookie, destroySession, getSessionToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const token = getSessionToken(request);
  if (token) {
    await destroySession(prisma, token);
  }

  const response = NextResponse.json({ ok: true });
  clearSessionCookie(response);
  return response;
}
