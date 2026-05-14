import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  getAlgorithm,
  algorithmStats,
  heartbeatPayloadFor,
  updateAlgorithm,
  deleteAlgorithm,
} from "@/lib/repo";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PatchBody = z.object({
  name: z.string().min(1).max(120).optional(),
  type: z.enum(["hybrid", "rules", "llm", "custom"]).optional(),
  description: z.string().nullable().optional(),
  symbols: z.array(z.string()).optional(),
  db_path: z.string().nullable().optional(),
  launch_cmd: z.string().nullable().optional(),
  account_id: z.string().nullable().optional(),
  enabled: z.boolean().optional(),
});

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

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const parsed = PatchBody.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation failed", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const updated = updateAlgorithm(id, parsed.data);
  if (!updated) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ algorithm: { ...updated, api_token: undefined } });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ok = deleteAlgorithm(id);
  if (!ok) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
