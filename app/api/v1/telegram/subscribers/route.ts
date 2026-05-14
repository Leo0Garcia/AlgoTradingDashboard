import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { addSubscriber, listSubscribers } from "@/lib/repo";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const Body = z.object({
  chat_id: z.string().min(1),
  name: z.string().optional(),
});

export async function GET() {
  return NextResponse.json({ subscribers: listSubscribers() });
}

export async function POST(req: NextRequest) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation failed" }, { status: 400 });
  }
  const sub = addSubscriber(parsed.data.chat_id, parsed.data.name);
  return NextResponse.json({ subscriber: sub }, { status: 201 });
}
