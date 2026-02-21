import { NextRequest, NextResponse } from "next/server";
import { ADMIN_ROLES, requireSessionUser } from "@/lib/auth";
import { importWorkbookFromXlsx } from "@/lib/importWorkbook";
import { prisma } from "@/lib/prisma";
import { invalidateWorkbookSnapshotCache } from "@/lib/workbookData";

function asString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export async function GET(request: NextRequest) {
  const auth = await requireSessionUser(prisma, request, ADMIN_ROLES);
  if (auth.response) {
    return auth.response;
  }

  const runs = await prisma.importRun.findMany({
    where: { userId: auth.user.id },
    orderBy: { createdAt: "desc" },
    take: 10
  });

  return NextResponse.json(runs);
}

export async function POST(request: NextRequest) {
  const auth = await requireSessionUser(prisma, request, ADMIN_ROLES);
  if (auth.response) {
    return auth.response;
  }

  let payload: Record<string, unknown>;

  try {
    payload = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const sourcePath = asString(payload.sourcePath);
  if (!sourcePath) {
    return NextResponse.json({ error: "sourcePath is required." }, { status: 400 });
  }

  const run = await prisma.importRun.create({
    data: {
      userId: auth.user.id,
      sourcePath,
      status: "RUNNING"
    }
  });

  try {
    const result = await importWorkbookFromXlsx(prisma, sourcePath);
    invalidateWorkbookSnapshotCache();

    const updated = await prisma.importRun.update({
      where: { id: run.id },
      data: {
        status: "SUCCESS",
        message: `Imported workbook and synced domain tables from ${result.sourcePath}`,
        rowsDetected: result.sections,
        scenariosDetected: result.scenarios,
        servicesDetected: result.services,
        importedAt: new Date()
      }
    });

    return NextResponse.json({ run: updated, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Import failed.";

    const failed = await prisma.importRun.update({
      where: { id: run.id },
      data: {
        status: "FAILED",
        message
      }
    });

    return NextResponse.json({ run: failed, error: message }, { status: 500 });
  }
}
