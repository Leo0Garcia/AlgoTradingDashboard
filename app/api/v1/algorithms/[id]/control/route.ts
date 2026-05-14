import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { spawn } from "node:child_process";
import { getAlgorithm, setAlgorithmStatus } from "@/lib/repo";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const Body = z.object({ action: z.enum(["start", "stop"]) });

const childPids = new Map<string, number>();

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const algo = getAlgorithm(id);
  if (!algo) return NextResponse.json({ error: "not found" }, { status: 404 });
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

  if (parsed.data.action === "start") {
    if (!algo.launch_cmd) {
      return NextResponse.json(
        { error: "no launch_cmd configured for this algorithm" },
        { status: 400 },
      );
    }
    const child = spawn(algo.launch_cmd, {
      shell: true,
      detached: true,
      stdio: "ignore",
    });
    child.unref();
    if (child.pid) {
      childPids.set(id, child.pid);
      setAlgorithmStatus(id, "running", child.pid);
    } else {
      setAlgorithmStatus(id, "errored");
      return NextResponse.json({ error: "failed to spawn process" }, { status: 500 });
    }
    return NextResponse.json({ ok: true, pid: child.pid });
  } else {
    const pid = childPids.get(id) ?? algo.pid;
    if (pid) {
      try {
        process.kill(-pid, "SIGTERM");
      } catch {
        try {
          process.kill(pid, "SIGTERM");
        } catch {
          // already dead
        }
      }
    }
    childPids.delete(id);
    setAlgorithmStatus(id, "stopped", null);
    return NextResponse.json({ ok: true });
  }
}
