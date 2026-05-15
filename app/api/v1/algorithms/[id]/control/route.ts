import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  getAlgorithm,
  setAlgorithmStatus,
  setAlgorithmLaunchError,
} from "@/lib/repo";
import { publishEvent } from "@/lib/sse";
import type { Algorithm, EventType } from "@/lib/types";

function emitLifecycle(
  algorithmId: string,
  event_type: EventType,
  payload: Record<string, unknown>,
) {
  publishEvent({
    kind: "event",
    algorithm_id: algorithmId,
    event_type,
    payload,
    received_at: new Date().toISOString(),
  });
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const Body = z.object({ action: z.enum(["start", "stop"]) });

const childPids = new Map<string, number>();

/**
 * Resolve the algorithm's working directory.
 *
 * Priority:
 *   1. algo.working_dir (explicit)
 *   2. dirname(dirname(db_path)) — the convention used by Python algos
 *      whose journal sits at `<project>/trading_agent/storage/<db>.sqlite`.
 */
function resolveWorkingDir(algo: Algorithm): string | null {
  if (algo.working_dir) return algo.working_dir;
  if (algo.db_path) {
    // dirname(dirname(...)) — pop two levels: <project>/<pkg>/storage → <project>
    return path.dirname(path.dirname(algo.db_path));
  }
  return null;
}

/** Build a PATH that picks up uv / pipx / homebrew binaries even when Node was spawned from a minimal env. */
function buildSpawnEnv(): NodeJS.ProcessEnv {
  const home = os.homedir();
  const extra = [
    `${home}/.local/bin`,
    `${home}/.cargo/bin`,
    "/opt/homebrew/bin",
    "/opt/homebrew/sbin",
    "/usr/local/bin",
    "/usr/local/sbin",
  ];
  return {
    ...process.env,
    PATH: [...extra, process.env.PATH || ""].filter(Boolean).join(":"),
  };
}

function logPathFor(id: string): string {
  return `/tmp/algo-${id}.log`;
}

function tailFile(file: string, lines = 25): string {
  try {
    const content = fs.readFileSync(file, "utf8");
    return content.split("\n").slice(-lines).join("\n").trim();
  } catch {
    return "";
  }
}

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

  if (parsed.data.action === "stop") {
    const pid = childPids.get(id) ?? algo.pid;
    if (pid) {
      // Kill the entire process group (the leader's negative pid). bash -lc
      // becomes a process group leader because of detached:true, so the
      // python child gets the signal too.
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
    setAlgorithmLaunchError(id, null);
    emitLifecycle(id, "algo_stopped", { name: algo.name, pid });
    return NextResponse.json({ ok: true });
  }

  // ── START ────────────────────────────────────────────────────────────
  const cmd = (algo.launch_cmd ?? "").trim();
  if (!cmd) {
    const message = "No launch command configured for this algorithm.";
    setAlgorithmLaunchError(id, message);
    return NextResponse.json({ error: message }, { status: 400 });
  }
  const cwd = resolveWorkingDir(algo);
  if (!cwd) {
    const message =
      "Could not resolve a working directory. Set `working_dir` on the algorithm (or a `db_path` we can derive it from).";
    setAlgorithmLaunchError(id, message);
    return NextResponse.json({ error: message }, { status: 400 });
  }
  if (!fs.existsSync(cwd) || !fs.statSync(cwd).isDirectory()) {
    const message = `Working directory does not exist: ${cwd}`;
    setAlgorithmLaunchError(id, message);
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const logFile = logPathFor(id);
  const banner = `\n\n──── ${new Date().toISOString()} launching: ${cmd} (cwd=${cwd}) ────\n`;
  try {
    fs.appendFileSync(logFile, banner);
  } catch {
    // proceed even if banner write fails
  }

  let out: number;
  let err: number;
  try {
    out = fs.openSync(logFile, "a");
    err = fs.openSync(logFile, "a");
  } catch (e) {
    const message = `Failed to open log file ${logFile}: ${(e as Error).message}`;
    setAlgorithmLaunchError(id, message);
    return NextResponse.json({ error: message }, { status: 500 });
  }

  // Use `bash -lc` so the login profile is sourced — this picks up uv,
  // pyenv, pipx, etc. that live outside the minimal PATH Node inherits.
  let child;
  try {
    child = spawn("bash", ["-lc", cmd], {
      cwd,
      detached: true,
      stdio: ["ignore", out, err],
      env: buildSpawnEnv(),
    });
  } catch (e) {
    try {
      fs.closeSync(out);
    } catch {}
    try {
      fs.closeSync(err);
    } catch {}
    const message = `spawn failed: ${(e as Error).message}`;
    setAlgorithmLaunchError(id, message);
    setAlgorithmStatus(id, "errored", null);
    return NextResponse.json({ error: message }, { status: 500 });
  }

  if (!child.pid) {
    try {
      fs.closeSync(out);
    } catch {}
    try {
      fs.closeSync(err);
    } catch {}
    const message = "spawn returned no pid";
    setAlgorithmLaunchError(id, message);
    setAlgorithmStatus(id, "errored", null);
    return NextResponse.json({ error: message }, { status: 500 });
  }

  // Detach so the child outlives the dashboard process. We still listen for
  // the exit event briefly to catch immediate failures.
  child.unref();

  let exitCode: number | null = null;
  let exitSignal: NodeJS.Signals | null = null;
  let exited = false;

  const earlyExit = await new Promise<boolean>((resolve) => {
    const t = setTimeout(() => resolve(false), 1500);
    child.once("exit", (code, signal) => {
      exited = true;
      exitCode = code;
      exitSignal = signal;
      clearTimeout(t);
      resolve(true);
    });
    child.once("error", () => {
      exited = true;
      clearTimeout(t);
      resolve(true);
    });
  });

  // Our parent-side file descriptors can be released once the child has
  // dup'd them. (The OS keeps the underlying file open for the child.)
  try {
    fs.closeSync(out);
  } catch {}
  try {
    fs.closeSync(err);
  } catch {}

  if (earlyExit) {
    const tail = tailFile(logFile, 20);
    const message =
      `Process exited within 1.5s ` +
      `(code=${exitCode ?? "?"}, signal=${exitSignal ?? "?"}). ` +
      `Tail of ${logFile}:\n${tail || "(empty)"}`;
    setAlgorithmStatus(id, "errored", null);
    setAlgorithmLaunchError(id, message);
    emitLifecycle(id, "algo_errored", {
      name: algo.name,
      exit_code: exitCode,
      exit_signal: exitSignal,
      message,
    });
    return NextResponse.json(
      {
        error: "launch failed",
        exit_code: exitCode,
        exit_signal: exitSignal,
        log_path: logFile,
        log_tail: tail,
      },
      { status: 500 },
    );
  }

  childPids.set(id, child.pid);
  setAlgorithmStatus(id, "running", child.pid);
  setAlgorithmLaunchError(id, null);
  emitLifecycle(id, "algo_started", { name: algo.name, pid: child.pid, cwd });
  void exited;

  return NextResponse.json({
    ok: true,
    pid: child.pid,
    log_path: logFile,
    cwd,
  });
}
