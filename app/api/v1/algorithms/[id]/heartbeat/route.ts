import { NextRequest, NextResponse } from "next/server";
import { authenticateAlgorithm } from "@/lib/auth";
import {
  insertEvent,
  updateAlgorithmHeartbeat,
  pidFromHeartbeat,
  sessionFromHeartbeat,
} from "@/lib/repo";
import { publishEvent } from "@/lib/sse";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = authenticateAlgorithm(req, id);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const { received_at } = insertEvent(id, "heartbeat", body);
  const pid = pidFromHeartbeat(body);
  const session = sessionFromHeartbeat(body);
  updateAlgorithmHeartbeat(id, received_at, pid, session);
  publishEvent({
    kind: "heartbeat",
    algorithm_id: id,
    event_type: "heartbeat",
    payload: body,
    received_at,
  });
  return NextResponse.json({ ok: true, received_at });
}
