import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient, User } from "@prisma/client";
import { hashPassword, verifyPassword } from "@/lib/password";

const SESSION_COOKIE_NAME = "quicksizer_session";
const SESSION_TTL_DAYS = 30;

function nowPlusDays(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
}

export { hashPassword, verifyPassword };

export async function createSession(prisma: PrismaClient, userId: number): Promise<string> {
  const token = crypto.randomBytes(32).toString("hex");

  await prisma.session.create({
    data: {
      token,
      userId,
      expiresAt: nowPlusDays(SESSION_TTL_DAYS)
    }
  });

  return token;
}

export async function destroySession(prisma: PrismaClient, token: string): Promise<void> {
  await prisma.session.deleteMany({
    where: { token }
  });
}

export function setSessionCookie(response: NextResponse, token: string) {
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: nowPlusDays(SESSION_TTL_DAYS)
  });
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(0)
  });
}

export function getSessionToken(request: NextRequest): string | null {
  return request.cookies.get(SESSION_COOKIE_NAME)?.value ?? null;
}

export async function getSessionUser(
  prisma: PrismaClient,
  request: NextRequest
): Promise<User | null> {
  const token = getSessionToken(request);
  if (!token) {
    return null;
  }

  const session = await prisma.session.findUnique({
    where: { token },
    include: { user: true }
  });

  if (!session) {
    return null;
  }

  if (session.expiresAt <= new Date()) {
    await prisma.session.delete({ where: { id: session.id } });
    return null;
  }

  return session.user;
}

export function sanitizeUser(user: User) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}
