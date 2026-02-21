import { NextRequest, NextResponse } from "next/server";
import {
  clearSessionCookie,
  destroySession,
  getSessionToken,
  isAuthDisabled
} from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  if (isAuthDisabled()) {
    return NextResponse.json({ ok: true });
  }

  const token = getSessionToken(request);
  if (token) {
    await destroySession(prisma, token);
  }

  const response = NextResponse.json({ ok: true });
  clearSessionCookie(response);
  return response;
}
