import { NextRequest, NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const auth = await requireSessionUser(prisma, request);
  if (auth.response) {
    return auth.response;
  }

  const scenarios = await prisma.scenario.findMany({
    orderBy: { name: "asc" }
  });

  return NextResponse.json(scenarios);
}
