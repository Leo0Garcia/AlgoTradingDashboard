import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authenticateAlgorithm } from "@/lib/auth";
import {
  insertEvent,
  upsertAlert,
  setAlertFilled,
  setAlertExit,
} from "@/lib/repo";
import { publishEvent } from "@/lib/sse";
import { broadcastAlert } from "@/lib/telegram";
import type {
  AlertPayload,
  TradeFilledPayload,
  TradeExitPayload,
} from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const Body = z.object({
  event_type: z.enum([
    "alert",
    "rejection",
    "trade_filled",
    "trade_exit",
    "error",
    "heartbeat",
  ]),
  payload: z.record(z.string(), z.unknown()),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = authenticateAlgorithm(req, id);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation failed", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { event_type, payload } = parsed.data;
  const { received_at } = insertEvent(id, event_type, payload);

  // Materialize known event types
  try {
    if (event_type === "alert") {
      const p = payload as unknown as AlertPayload;
      upsertAlert(id, p, received_at);
      if (p.approved) {
        // fire and forget; we don't want to block algorithm
        void broadcastAlert(auth.algorithm, p);
      }
    } else if (event_type === "trade_filled") {
      const p = payload as unknown as TradeFilledPayload;
      setAlertFilled(id, p.external_id, p.fill_ts, p.fill_px);
    } else if (event_type === "trade_exit") {
      const p = payload as unknown as TradeExitPayload;
      setAlertExit(id, p.external_id, p.status, p.exit_ts, p.exit_px, p.r_outcome);
    }
  } catch (err) {
    // Don't fail the request — event was still persisted to event log
    console.error("[events] materialization error", err);
  }

  publishEvent({
    kind: "event",
    algorithm_id: id,
    event_type,
    payload,
    received_at,
  });

  return NextResponse.json({ ok: true, received_at });
}
