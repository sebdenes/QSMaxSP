import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;

    return NextResponse.json(
      {
        status: "ok",
        service: "max-success-plan-quicksizer",
        mode: "ready",
        database: "ok",
        timestamp: new Date().toISOString()
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        service: "max-success-plan-quicksizer",
        mode: "ready",
        database: "unavailable",
        message: error instanceof Error ? error.message : "Unknown readiness error",
        timestamp: new Date().toISOString()
      },
      { status: 503 }
    );
  }
}
