import { NextResponse } from "next/server";
import { listAlgorithms, algorithmStats } from "@/lib/repo";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function todayStartIso(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export async function GET() {
  const since = todayStartIso();
  const algos = listAlgorithms().map((a) => {
    const stats = algorithmStats(a.id, since);
    return {
      ...a,
      api_token: undefined,
      stats_today: stats,
    };
  });
  return NextResponse.json({ algorithms: algos });
}
