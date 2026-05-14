import { NextResponse } from "next/server";
import { listActiveAlerts } from "@/lib/repo";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ active: listActiveAlerts() });
}
