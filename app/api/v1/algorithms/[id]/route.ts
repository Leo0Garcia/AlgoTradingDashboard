import { NextResponse } from "next/server";
import { getAlgorithm, algorithmStats, heartbeatPayloadFor } from "@/lib/repo";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const algo = getAlgorithm(id);
  if (!algo) return NextResponse.json({ error: "not found" }, { status: 404 });
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  return NextResponse.json({
    algorithm: { ...algo, api_token: undefined },
    stats_today: algorithmStats(id, since.toISOString()),
    last_heartbeat_payload: heartbeatPayloadFor(id),
  });
}
