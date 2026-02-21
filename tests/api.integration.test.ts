import assert from "node:assert/strict";
import { after, beforeEach, test } from "node:test";
import { PrismaClient, UserRole } from "@prisma/client";
import { NextRequest } from "next/server";
import { createSession } from "../lib/auth";
import { hashPassword } from "../lib/password";
import { GET as getMe } from "../app/api/auth/me/route";
import { POST as postLogin } from "../app/api/auth/login/route";
import { POST as postRegister } from "../app/api/auth/register/route";
import { GET as getEngagements, POST as postEngagements } from "../app/api/engagements/route";
import { PUT as putEngagementById } from "../app/api/engagements/[id]/route";
import { GET as getEngagementExportById } from "../app/api/engagements/[id]/export/route";
import { GET as getImportWorkbook } from "../app/api/import-workbook/route";
import { getWorkbookSnapshot } from "../lib/workbookData";

const prisma = new PrismaClient();
const RUN_INTEGRATION = process.env.RUN_INTEGRATION_TESTS === "1";

function makeRequest(args: {
  path: string;
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  sessionToken?: string;
}): NextRequest {
  const headers = new Headers();

  if (args.body !== undefined) {
    headers.set("content-type", "application/json");
  }

  if (args.sessionToken) {
    headers.set("cookie", `quicksizer_session=${args.sessionToken}`);
  }

  return new NextRequest(`http://localhost${args.path}`, {
    method: args.method ?? "GET",
    headers,
    body: args.body === undefined ? undefined : JSON.stringify(args.body)
  });
}

async function parseJson<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

function extractSessionTokenFromSetCookie(response: Response): string | null {
  const cookie = response.headers.get("set-cookie");
  if (!cookie) {
    return null;
  }

  const match = cookie.match(/quicksizer_session=([^;]+)/);
  return match ? match[1] : null;
}

async function createUser(role: UserRole, email?: string) {
  const userEmail = email ?? `user.${role.toLowerCase()}.${Date.now()}@example.test`;
  return prisma.user.create({
    data: {
      email: userEmail,
      name: `${role} User`,
      role,
      passwordHash: hashPassword("Password123!")
    }
  });
}

async function clearAuthAndEngagementData() {
  await prisma.session.deleteMany();
  await prisma.engagementSelection.deleteMany();
  await prisma.engagementScenarioService.deleteMany();
  await prisma.engagement.deleteMany();
  await prisma.importRun.deleteMany();
  await prisma.user.deleteMany();
}

beforeEach(async () => {
  if (!RUN_INTEGRATION) {
    return;
  }

  await clearAuthAndEngagementData();
});

after(async () => {
  await prisma.$disconnect();
});

test(
  "register endpoint blocks self-signup when policy is disabled",
  { skip: !RUN_INTEGRATION },
  async () => {
    const previous = process.env.ALLOW_SELF_SIGNUP;
    process.env.ALLOW_SELF_SIGNUP = "false";

    try {
      const response = await postRegister(
        makeRequest({
          path: "/api/auth/register",
          method: "POST",
          body: {
            email: "blocked-signup@example.test",
            password: "Password123!",
            name: "Blocked Signup"
          }
        })
      );

      assert.equal(response.status, 403);
      const body = await parseJson<{ error: string }>(response);
      assert.match(body.error, /Self-signup is disabled/i);
    } finally {
      process.env.ALLOW_SELF_SIGNUP = previous;
    }
  }
);

test(
  "demo login can be disabled while other auth remains active",
  { skip: !RUN_INTEGRATION },
  async () => {
    await prisma.user.create({
      data: {
        email: "demo@quicksizer.local",
        name: "Demo User",
        role: "ADMIN",
        passwordHash: hashPassword("demo1234")
      }
    });

    const previous = process.env.ALLOW_DEMO_LOGIN;

    try {
      process.env.ALLOW_DEMO_LOGIN = "false";
      const blocked = await postLogin(
        makeRequest({
          path: "/api/auth/login",
          method: "POST",
          body: { email: "demo@quicksizer.local", password: "demo1234" }
        })
      );

      assert.equal(blocked.status, 403);

      process.env.ALLOW_DEMO_LOGIN = "true";
      const allowed = await postLogin(
        makeRequest({
          path: "/api/auth/login",
          method: "POST",
          body: { email: "demo@quicksizer.local", password: "demo1234" }
        })
      );

      assert.equal(allowed.status, 200);
      assert.ok(extractSessionTokenFromSetCookie(allowed));
    } finally {
      process.env.ALLOW_DEMO_LOGIN = previous;
    }
  }
);

test(
  "viewer role is read-only for engagement APIs",
  { skip: !RUN_INTEGRATION },
  async () => {
    const viewer = await createUser("VIEWER");
    const viewerSession = await createSession(prisma, viewer.id);

    const listResponse = await getEngagements(
      makeRequest({ path: "/api/engagements", sessionToken: viewerSession })
    );
    assert.equal(listResponse.status, 200);

    const createResponse = await postEngagements(
      makeRequest({
        path: "/api/engagements",
        method: "POST",
        sessionToken: viewerSession,
        body: {
          customerName: "Viewer Customer",
          durationYears: 3
        }
      })
    );

    assert.equal(createResponse.status, 403);
  }
);

test(
  "planner can create, update, and export own engagement",
  { skip: !RUN_INTEGRATION },
  async () => {
    const planner = await createUser("PLANNER");
    const sessionToken = await createSession(prisma, planner.id);

    const created = await postEngagements(
      makeRequest({
        path: "/api/engagements",
        method: "POST",
        sessionToken,
        body: {
          customerName: "ACME Corp",
          durationYears: 4,
          spreadY1: 40,
          spreadY2: 30,
          spreadY3: 20,
          spreadY4: 10,
          spreadY5: 0
        }
      })
    );

    assert.equal(created.status, 201);
    const createdBody = await parseJson<{ id: number }>(created);
    assert.ok(createdBody.id > 0);

    const updated = await putEngagementById(
      makeRequest({
        path: `/api/engagements/${createdBody.id}`,
        method: "PUT",
        sessionToken,
        body: {
          name: "ACME Corp Plan",
          selections: [
            { row: 8, size: "M" },
            { row: 15, size: "S" }
          ]
        }
      }),
      { params: Promise.resolve({ id: String(createdBody.id) }) }
    );

    assert.equal(updated.status, 200);

    const exportResponse = await getEngagementExportById(
      makeRequest({
        path: `/api/engagements/${createdBody.id}/export?format=csv`,
        sessionToken
      }),
      { params: Promise.resolve({ id: String(createdBody.id) }) }
    );

    assert.equal(exportResponse.status, 200);
    assert.match(exportResponse.headers.get("content-type") ?? "", /text\/csv/i);

    const csv = await exportResponse.text();
    assert.match(csv, /SCENARIO SUMMARY/);
    assert.match(csv, /SERVICE ALLOCATION DETAIL/);
  }
);

test(
  "csv export includes full service rows for mixed scenario sizes and rejects pdf export",
  { skip: !RUN_INTEGRATION },
  async () => {
    const planner = await createUser("PLANNER", "planner-mixed-export@example.test");
    const sessionToken = await createSession(prisma, planner.id);

    const created = await postEngagements(
      makeRequest({
        path: "/api/engagements",
        method: "POST",
        sessionToken,
        body: {
          customerName: "Mixed Export Customer",
          durationYears: 5,
          spreadY1: 40,
          spreadY2: 25,
          spreadY3: 20,
          spreadY4: 10,
          spreadY5: 5
        }
      })
    );

    assert.equal(created.status, 201);
    const createdBody = await parseJson<{ id: number }>(created);
    assert.ok(createdBody.id > 0);

    const selections = [
      { row: 7, size: "S" },
      { row: 8, size: "M" },
      { row: 18, size: "L" },
      { row: 21, size: "M" },
      { row: 28, size: "S" },
      { row: 16, size: "Custom", customDays: 44 }
    ];

    const customServices = [
      {
        scenarioRow: 16,
        serviceKey: "custom-16-a",
        serviceId: null,
        serviceName: "Custom Service 16 A",
        sectionName: "Custom Section",
        days: 20
      },
      {
        scenarioRow: 16,
        serviceKey: "custom-16-b",
        serviceId: null,
        serviceName: "Custom Service 16 B",
        sectionName: "Custom Section",
        days: 24
      }
    ];

    const updated = await putEngagementById(
      makeRequest({
        path: `/api/engagements/${createdBody.id}`,
        method: "PUT",
        sessionToken,
        body: {
          name: "Mixed Export Plan",
          selections,
          customServices
        }
      }),
      { params: Promise.resolve({ id: String(createdBody.id) }) }
    );
    assert.equal(updated.status, 200);

    const exportCsvResponse = await getEngagementExportById(
      makeRequest({
        path: `/api/engagements/${createdBody.id}/export?format=csv`,
        sessionToken
      }),
      { params: Promise.resolve({ id: String(createdBody.id) }) }
    );

    assert.equal(exportCsvResponse.status, 200);
    assert.match(exportCsvResponse.headers.get("content-type") ?? "", /text\/csv/i);

    const csv = await exportCsvResponse.text();
    assert.match(csv, /SCENARIO SUMMARY/);
    assert.match(csv, /SERVICE ALLOCATION DETAIL/);
    assert.match(csv, /Custom Service 16 A/);
    assert.match(csv, /Custom Service 16 B/);
    assert.doesNotMatch(csv, /Preset package/);

    const workbook = getWorkbookSnapshot();
    const selectedRows = [7, 8, 16, 18, 21, 28];
    const selectedNames = selectedRows
      .map((row) => workbook.lineItems.find((item) => item.row === row)?.name)
      .filter((value): value is string => Boolean(value));

    for (const row of selectedRows) {
      assert.match(csv, new RegExp(`\\n${row},`));
    }

    for (const name of selectedNames) {
      assert.match(csv, new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    }

    const exportPdfResponse = await getEngagementExportById(
      makeRequest({
        path: `/api/engagements/${createdBody.id}/export?format=pdf`,
        sessionToken
      }),
      { params: Promise.resolve({ id: String(createdBody.id) }) }
    );

    assert.equal(exportPdfResponse.status, 400);
    const pdfBody = await parseJson<{ error: string }>(exportPdfResponse);
    assert.match(pdfBody.error, /Only CSV export is supported/i);
  }
);

test(
  "admin-only workbook import endpoints reject planner and allow admin",
  { skip: !RUN_INTEGRATION },
  async () => {
    const planner = await createUser("PLANNER", "planner-only@example.test");
    const plannerToken = await createSession(prisma, planner.id);

    const plannerAttempt = await getImportWorkbook(
      makeRequest({ path: "/api/import-workbook", sessionToken: plannerToken })
    );
    assert.equal(plannerAttempt.status, 403);

    const admin = await createUser("ADMIN", "admin-user@example.test");
    const adminToken = await createSession(prisma, admin.id);

    const adminAttempt = await getImportWorkbook(
      makeRequest({ path: "/api/import-workbook", sessionToken: adminToken })
    );
    assert.equal(adminAttempt.status, 200);

    const meResponse = await getMe(
      makeRequest({ path: "/api/auth/me", sessionToken: adminToken })
    );
    assert.equal(meResponse.status, 200);

    const meBody = await parseJson<{ user: { role: UserRole } }>(meResponse);
    assert.equal(meBody.user.role, "ADMIN");
  }
);

test(
  "health endpoints return expected liveness and readiness states",
  { skip: !RUN_INTEGRATION },
  async () => {
    const { GET: getHealthLive } = await import("../app/api/health/live/route");
    const { GET: getHealthReady } = await import("../app/api/health/ready/route");

    const liveResponse = await getHealthLive();
    assert.equal(liveResponse.status, 200);
    const liveBody = await parseJson<{ status: string; mode: string }>(liveResponse);
    assert.equal(liveBody.status, "ok");
    assert.equal(liveBody.mode, "live");

    const readyResponse = await getHealthReady();
    assert.equal(readyResponse.status, 200);
    const readyBody = await parseJson<{ status: string; mode: string; database: string }>(readyResponse);
    assert.equal(readyBody.status, "ok");
    assert.equal(readyBody.mode, "ready");
    assert.equal(readyBody.database, "ok");
  }
);
