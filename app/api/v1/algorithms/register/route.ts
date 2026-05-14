import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { registerAlgorithm } from "@/lib/repo";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const Body = z.object({
  name: z.string().min(1).max(120),
  type: z.enum(["hybrid", "rules", "llm", "custom"]),
  description: z.string().optional(),
  symbols: z.array(z.string()).optional(),
  db_path: z.string().optional(),
  launch_cmd: z.string().optional(),
  working_dir: z.string().optional(),
  account_id: z.string().nullable().optional(),
});

export async function POST(req: NextRequest) {
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
  const { algorithm, created } = registerAlgorithm({
    name: parsed.data.name,
    type: parsed.data.type,
    description: parsed.data.description,
    symbols: parsed.data.symbols,
    db_path: parsed.data.db_path,
    launch_cmd: parsed.data.launch_cmd,
    working_dir: parsed.data.working_dir,
    account_id: parsed.data.account_id ?? undefined,
  });
  return NextResponse.json(
    {
      algorithm_id: algorithm.id,
      api_token: algorithm.api_token,
      created,
    },
    { status: created ? 201 : 200 },
  );
}
