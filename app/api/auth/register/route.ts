import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  createSession,
  hashPassword,
  isSelfSignupEnabled,
  sanitizeUser,
  setSessionCookie
} from "@/lib/auth";

function asString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export async function POST(request: NextRequest) {
  if (!isSelfSignupEnabled()) {
    return NextResponse.json(
      { error: "Self-signup is disabled in this environment." },
      { status: 403 }
    );
  }

  let payload: Record<string, unknown>;

  try {
    payload = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const email = asString(payload.email)?.toLowerCase();
  const password = asString(payload.password);
  const name = asString(payload.name);

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  }

  if (password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters." },
      { status: 400 }
    );
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "User already exists." }, { status: 409 });
  }

  const user = await prisma.user.create({
    data: {
      email,
      name,
      role: "PLANNER",
      passwordHash: hashPassword(password)
    }
  });

  const token = await createSession(prisma, user.id);

  const response = NextResponse.json({ user: sanitizeUser(user) }, { status: 201 });
  setSessionCookie(response, token);
  return response;
}
