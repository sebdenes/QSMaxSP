import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    {
      status: "ok",
      service: "max-success-plan-quicksizer",
      mode: "live",
      timestamp: new Date().toISOString()
    },
    { status: 200 }
  );
}
