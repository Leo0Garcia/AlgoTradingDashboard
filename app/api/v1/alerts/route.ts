import { NextRequest, NextResponse } from "next/server";
import { listAlerts, type AlertFilters } from "@/lib/repo";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const f: AlertFilters = {};
  const algo = sp.get("algo") || sp.get("algorithm_id");
  if (algo) f.algorithm_id = algo;
  const from = sp.get("from");
  if (from) f.from = from;
  const to = sp.get("to");
  if (to) f.to = to;
  const sym = sp.get("symbol");
  if (sym) f.symbol = sym;
  const dir = sp.get("direction");
  if (dir) f.direction = dir;
  const grade = sp.get("grade");
  if (grade) f.grade = grade;
  const status = sp.get("status");
  if (status) f.status = status;
  const approved = sp.get("approved");
  if (approved !== null) f.approved = approved === "true" || approved === "1";
  const limit = sp.get("limit");
  if (limit) f.limit = Math.min(2000, Math.max(1, Number(limit)));
  return NextResponse.json({ alerts: listAlerts(f) });
}
