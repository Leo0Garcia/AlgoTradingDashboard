import { NextResponse } from "next/server";
import { regenerateAlgorithmToken } from "@/lib/repo";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const updated = regenerateAlgorithmToken(id);
  if (!updated) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({
    algorithm_id: updated.id,
    api_token: updated.api_token,
  });
}
