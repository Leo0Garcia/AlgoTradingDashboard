import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { listAccounts, createAccount } from "@/lib/repo";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const Body = z.object({
  name: z.string().min(1),
  broker: z.string().min(1),
  balance: z.number().optional(),
  max_drawdown: z.number().optional(),
});

export async function GET() {
  return NextResponse.json({ accounts: listAccounts() });
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
  const acc = createAccount(parsed.data);
  return NextResponse.json({ account: acc }, { status: 201 });
}
