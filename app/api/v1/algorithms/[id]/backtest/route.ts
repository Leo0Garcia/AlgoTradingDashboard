import { NextRequest } from "next/server";
import { spawn } from "node:child_process";
import path from "node:path";
import os from "node:os";
import { getAlgorithm } from "@/lib/repo";
import type { Algorithm } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/* ─────────────────────────────────────────────────────────────────────────
   Backtest spawn endpoint.

   Streams progress via SSE. The algo binary is whatever's registered as
   `launch_cmd` — we append `backtest --algorithm-id … --symbol … --from …
   --to …` and run it through `bash -lc` so login profile bits (uv, pyenv,
   pipx) resolve the same way the live spawn does.

   Algo contract (from the agreed prompt):
     - stdout → exactly one JSON document matching Results
     - stderr → `PROGRESS <pct> <message>` lines (plus other diagnostics);
                on failure, optionally a single JSON line `{"error":"…"}`
     - non-zero exit = failure

   SSE events:
     - progress: { pct: number, message: string }     // matched PROGRESS line
     - log:      { line: string }                     // unmatched stderr line
     - result:   <Results JSON>                       // success terminator
     - error:    { message, detail?, exit_code?, tail? }   // failure
   ───────────────────────────────────────────────────────────────────────── */

function resolveWorkingDir(algo: Algorithm): string | null {
  if (algo.working_dir) return algo.working_dir;
  if (algo.db_path) return path.dirname(path.dirname(algo.db_path));
  return null;
}

function buildEnv(): NodeJS.ProcessEnv {
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

function shellQuote(s: string): string {
  return `'${s.replace(/'/g, "'\\''")}'`;
}

function normalizeIso(s: string): string {
  // datetime-local gives `YYYY-MM-DDTHH:MM` (no seconds, no zone).
  // The algo wants strict ISO 8601 with Z. Append `:00Z` when needed.
  if (/Z$|[+-]\d{2}:?\d{2}$/.test(s)) return s;
  if (/T\d{2}:\d{2}$/.test(s)) return `${s}:00Z`;
  if (/T\d{2}:\d{2}:\d{2}$/.test(s)) return `${s}Z`;
  return s;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const algo = getAlgorithm(id);

  const url = new URL(req.url);
  const symbol = (url.searchParams.get("symbol") ?? "ALL").trim();
  const from = normalizeIso((url.searchParams.get("from") ?? "").trim());
  const to = normalizeIso((url.searchParams.get("to") ?? "").trim());

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: string, data: unknown) => {
        try {
          controller.enqueue(
            encoder.encode(
              `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`,
            ),
          );
        } catch {
          // controller already closed
        }
      };

      const close = () => {
        try {
          controller.close();
        } catch {
          // already closed
        }
      };

      if (!algo) {
        send("error", { message: "algorithm not found" });
        close();
        return;
      }
      const launch = (algo.launch_cmd ?? "").trim();
      if (!launch) {
        send("error", {
          message: "No launch command configured for this algorithm.",
        });
        close();
        return;
      }
      const cwd = resolveWorkingDir(algo);
      if (!cwd) {
        send("error", {
          message:
            "Could not resolve a working directory. Set `working_dir` on the algorithm.",
        });
        close();
        return;
      }
      if (!from || !to) {
        send("error", { message: "Missing `from` or `to` parameter." });
        close();
        return;
      }

      const fullCmd =
        `${launch} backtest ` +
        [
          "--algorithm-id",
          algo.id,
          "--symbol",
          symbol,
          "--from",
          from,
          "--to",
          to,
        ]
          .map(shellQuote)
          .join(" ");

      let child;
      try {
        child = spawn("bash", ["-lc", fullCmd], {
          cwd,
          detached: true,
          stdio: ["ignore", "pipe", "pipe"],
          env: buildEnv(),
        });
      } catch (e) {
        send("error", { message: `spawn failed: ${(e as Error).message}` });
        close();
        return;
      }

      let stdoutBuf = "";
      let stderrLineBuf = "";
      const stderrTail: string[] = [];

      child.stdout?.on("data", (chunk: Buffer) => {
        stdoutBuf += chunk.toString();
      });

      child.stderr?.on("data", (chunk: Buffer) => {
        stderrLineBuf += chunk.toString();
        const parts = stderrLineBuf.split("\n");
        stderrLineBuf = parts.pop() ?? "";
        for (const line of parts) {
          if (line.length === 0) continue;
          stderrTail.push(line);
          if (stderrTail.length > 100) stderrTail.shift();
          const m = line.match(/^PROGRESS (\d+)\s+(.*)$/);
          if (m) {
            send("progress", { pct: parseInt(m[1], 10), message: m[2] });
          } else {
            send("log", { line });
          }
        }
      });

      // If the client navigates away or hits RESET, kill the subprocess
      // group so we don't leak long backtests.
      const onAbort = () => {
        if (child.pid && !child.killed) {
          try {
            process.kill(-child.pid, "SIGTERM");
          } catch {
            try {
              process.kill(child.pid, "SIGTERM");
            } catch {
              // already dead
            }
          }
        }
      };
      req.signal.addEventListener("abort", onAbort);

      child.on("error", (err: Error) => {
        send("error", { message: `spawn error: ${err.message}` });
        close();
      });

      child.on("exit", (code, signal) => {
        req.signal.removeEventListener("abort", onAbort);

        if (code === 0) {
          try {
            const result = JSON.parse(stdoutBuf);
            send("result", result);
          } catch (e) {
            send("error", {
              message: "Failed to parse result JSON from stdout",
              detail: (e as Error).message,
              tail: stdoutBuf.slice(-500),
            });
          }
        } else {
          // Algo's error envelope is a single JSON line on stderr — search
          // backwards through the tail for it.
          let parsed: { error?: string; detail?: string } | null = null;
          for (let i = stderrTail.length - 1; i >= 0; i--) {
            const line = stderrTail[i].trim();
            if (line.startsWith("{") && line.endsWith("}")) {
              try {
                parsed = JSON.parse(line);
                break;
              } catch {
                // keep scanning
              }
            }
          }
          send("error", {
            message:
              parsed?.error ??
              `Backtest exited with code ${code}${signal ? ` (signal ${signal})` : ""}`,
            detail: parsed?.detail,
            exit_code: code,
            tail: stderrTail.slice(-20).join("\n"),
          });
        }
        close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
