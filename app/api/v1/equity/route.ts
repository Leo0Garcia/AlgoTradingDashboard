import { NextRequest, NextResponse } from "next/server";
import { equityCurve } from "@/lib/repo";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const algo = sp.get("algo") || undefined;
  const since = sp.get("since") || undefined;
  return NextResponse.json({ points: equityCurve(algo, since) });
}
