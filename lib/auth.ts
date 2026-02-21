import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient, User, UserRole } from "@prisma/client";
import { hashPassword, verifyPassword } from "@/lib/password";

const SESSION_COOKIE_NAME = "quicksizer_session";
const SESSION_TTL_DAYS = 30;
const DEMO_LOGIN_EMAIL = "demo@quicksizer.local";

export const READ_ONLY_ROLES: ReadonlyArray<UserRole> = ["ADMIN", "PLANNER", "VIEWER"];
export const EDITOR_ROLES: ReadonlyArray<UserRole> = ["ADMIN", "PLANNER"];
export const ADMIN_ROLES: ReadonlyArray<UserRole> = ["ADMIN"];

function nowPlusDays(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
}

function parseBooleanEnv(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }

  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }

  return fallback;
}

export function isSelfSignupEnabled(): boolean {
  return parseBooleanEnv(process.env.ALLOW_SELF_SIGNUP, process.env.NODE_ENV !== "production");
}

export function isDemoLoginEnabled(): boolean {
  return parseBooleanEnv(process.env.ALLOW_DEMO_LOGIN, process.env.NODE_ENV !== "production");
}

export function isDemoLoginEmail(email: string): boolean {
  return email.trim().toLowerCase() === DEMO_LOGIN_EMAIL;
}

function isSecureCookieEnabled(): boolean {
  return parseBooleanEnv(
    process.env.SESSION_COOKIE_SECURE,
    process.env.NODE_ENV === "production"
  );
}

function isRoleAllowed(userRole: UserRole, allowedRoles: ReadonlyArray<UserRole>): boolean {
  return allowedRoles.length === 0 || allowedRoles.includes(userRole);
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
    secure: isSecureCookieEnabled(),
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
    secure: isSecureCookieEnabled(),
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

export async function requireSessionUser(
  prisma: PrismaClient,
  request: NextRequest,
  allowedRoles: ReadonlyArray<UserRole> = READ_ONLY_ROLES
): Promise<{ user: User; response: null } | { user: null; response: NextResponse }> {
  const user = await getSessionUser(prisma, request);

  if (!user) {
    return {
      user: null,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    };
  }

  if (!isRoleAllowed(user.role, allowedRoles)) {
    return {
      user: null,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 })
    };
  }

  return { user, response: null };
}

export function sanitizeUser(user: User) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}
