import { NextRequest, NextResponse } from "next/server";
import { sendTestMessage } from "@/lib/telegram";
import { listSubscribers } from "@/lib/repo";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const target = sp.get("chat_id");
  const targets = target
    ? [target]
    : listSubscribers().filter((s) => s.enabled).map((s) => s.chat_id);
  if (targets.length === 0) {
    return NextResponse.json({ error: "no subscribers configured" }, { status: 400 });
  }
  const results = await Promise.all(
    targets.map(async (id) => {
      const r = await sendTestMessage(id);
      return { chat_id: id, ...r };
    }),
  );
  return NextResponse.json({ results });
}
