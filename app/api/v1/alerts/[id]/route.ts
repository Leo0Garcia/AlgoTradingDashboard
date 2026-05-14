import { NextResponse } from "next/server";
import { getAlertById } from "@/lib/repo";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const n = Number(id);
  if (!Number.isFinite(n)) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }
  const alert = getAlertById(n);
  if (!alert) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ alert });
}
