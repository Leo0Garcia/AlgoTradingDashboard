import { NextResponse } from "next/server";
import { discoverChats } from "@/lib/telegram";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const r = await discoverChats();
  if (!r.ok) {
    return NextResponse.json(r, { status: 400 });
  }
  return NextResponse.json(r);
}
