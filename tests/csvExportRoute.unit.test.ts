import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { GET as getEngagementExportById } from "../app/api/engagements/[id]/export/route";
import { prisma } from "../lib/prisma";

type AnyFn = (...args: any[]) => any;

function makeRequest(path: string): NextRequest {
  return new NextRequest(`http://localhost${path}`, { method: "GET" });
}

test("engagement export route returns complete csv service detail for mixed sizing", async () => {
  const previousAuthDisabled = process.env.AUTH_DISABLED;
  const previousAuthDisabledPublic = process.env.NEXT_PUBLIC_AUTH_DISABLED;
  process.env.AUTH_DISABLED = "true";
  process.env.NEXT_PUBLIC_AUTH_DISABLED = "true";

  const originalUserFindUnique = (prisma.user.findUnique as unknown) as AnyFn;
  const originalEngagementFindFirst = (prisma.engagement.findFirst as unknown) as AnyFn;
  const originalScenarioFindMany = (prisma.scenario.findMany as unknown) as AnyFn;
  const originalServiceFindMany = (prisma.service.findMany as unknown) as AnyFn;

  (prisma.user.findUnique as unknown as AnyFn) = async () => ({
    id: 5001,
    email: "demo@quicksizer.local",
    name: "Local Planner",
    role: "ADMIN",
    passwordHash: "x",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z")
  });

  (prisma.engagement.findFirst as unknown as AnyFn) = async () => ({
    id: 901,
    ownerId: 5001,
    name: "Mixed Export Plan",
    customerName: "Demo Customer",
    opportunity: "Prototype",
    spreadY1: 40,
    spreadY2: 25,
    spreadY3: 20,
    spreadY4: 10,
    spreadY5: 5,
    selections: [
      { row: 7, size: "S", customDays: null },
      { row: 8, size: "M", customDays: null },
      { row: 18, size: "L", customDays: null },
      { row: 21, size: "M", customDays: null },
      { row: 28, size: "S", customDays: null },
      { row: 16, size: "Custom", customDays: 44 }
    ],
    customServices: [
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
    ]
  });

  // Force route to use template fallback service allocation for preset rows.
  (prisma.scenario.findMany as unknown as AnyFn) = async () => [];

  (prisma.service.findMany as unknown as AnyFn) = async () => [
    {
      id: 1,
      name: "Template Service A",
      row: 5,
      templateS: 10,
      templateM: 20,
      templateL: 30,
      section: { name: "Template Section 1" }
    },
    {
      id: 2,
      name: "Template Service B",
      row: 6,
      templateS: 5,
      templateM: 10,
      templateL: 15,
      section: { name: "Template Section 2" }
    }
  ];

  try {
    const csvResponse = await getEngagementExportById(
      makeRequest("/api/engagements/901/export?format=csv"),
      { params: Promise.resolve({ id: "901" }) }
    );

    assert.equal(csvResponse.status, 200);
    assert.match(csvResponse.headers.get("content-type") ?? "", /text\/csv/i);

    const csv = await csvResponse.text();
    assert.match(csv, /SCENARIO SUMMARY/);
    assert.match(csv, /SERVICE ALLOCATION DETAIL/);
    assert.match(csv, /Template Service A/);
    assert.match(csv, /Template Service B/);
    assert.match(csv, /Custom Service 16 A/);
    assert.match(csv, /Custom Service 16 B/);
    assert.doesNotMatch(csv, /Preset package/);

    const pdfResponse = await getEngagementExportById(
      makeRequest("/api/engagements/901/export?format=pdf"),
      { params: Promise.resolve({ id: "901" }) }
    );
    assert.equal(pdfResponse.status, 400);
  } finally {
    process.env.AUTH_DISABLED = previousAuthDisabled;
    process.env.NEXT_PUBLIC_AUTH_DISABLED = previousAuthDisabledPublic;
    (prisma.user.findUnique as unknown as AnyFn) = originalUserFindUnique;
    (prisma.engagement.findFirst as unknown as AnyFn) = originalEngagementFindFirst;
    (prisma.scenario.findMany as unknown as AnyFn) = originalScenarioFindMany;
    (prisma.service.findMany as unknown as AnyFn) = originalServiceFindMany;
  }
});
