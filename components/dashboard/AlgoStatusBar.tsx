"use client";

import { useEffect, useState, useCallback } from "react";
import { useStream } from "@/hooks/useStream";
import { Button } from "@/components/ui/button";
import { fmtR, relativeTime } from "@/lib/utils";
import { Play, Square } from "lucide-react";
import { SessionBadge, SessionBanner } from "./SessionBadge";
import type { SessionState } from "@/lib/types";

interface AlgorithmEntry {
  id: string;
  name: string;
  type: string;
  status: "running" | "stopped" | "errored";
  last_heartbeat: string | null;
  last_session: SessionState | null;
  symbols: string[];
  launch_cmd: string | null;
  stats_today: {
    total_alerts: number;
    approved_count: number;
    wins: number;
    losses: number;
    r_sum: number;
  };
}

export function AlgoStatusBar() {
  const [algos, setAlgos] = useState<AlgorithmEntry[]>([]);
  const [, force] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const r = await fetch("/api/v1/algorithms", { cache: "no-store" });
      const j = await r.json();
      setAlgos(j.algorithms ?? []);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(() => force((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, [refresh]);

  useStream((e) => {
    if (e.kind === "heartbeat" || e.event_type === "trade_exit" || e.event_type === "alert") {
      refresh();
    }
  });

  const control = async (id: string, action: "start" | "stop") => {
    await fetch(`/api/v1/algorithms/${id}/control`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action }),
    });
    refresh();
  };

  if (algos.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-zinc-800 p-6 text-center text-sm text-zinc-500">
        No algorithms registered yet. Register one from the{" "}
        <span className="text-zinc-300">Algorithms</span> tab, or via{" "}
        <code className="num text-zinc-400">POST /api/v1/algorithms/register</code>.
      </div>
    );
  }

  const pausedAlgos = algos.filter(
    (a) => a.status === "running" && a.last_session && !a.last_session.active,
  );

  return (
    <div className="space-y-3">
      {pausedAlgos.length > 0 ? (
        <div className="space-y-2">
          {pausedAlgos.map((a) => (
            <SessionBanner key={a.id} algoName={a.name} session={a.last_session} />
          ))}
        </div>
      ) : null}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
      {algos.map((a) => (
        <div
          key={a.id}
          className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-3.5"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className={`pulse-dot ${a.status}`} />
              <div className="min-w-0">
                <div className="text-sm font-medium text-zinc-100 truncate">{a.name}</div>
                <div className="text-[10px] uppercase tracking-wider text-zinc-500">
                  {a.type}
                </div>
              </div>
            </div>
            <div>
              {a.status === "running" ? (
                <Button size="sm" variant="danger" onClick={() => control(a.id, "stop")}>
                  <Square className="h-3 w-3" /> Stop
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => control(a.id, "start")}
                  disabled={!a.launch_cmd}
                  title={a.launch_cmd ?? "No launch command configured"}
                >
                  <Play className="h-3 w-3" /> Start
                </Button>
              )}
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs">
            <span className="text-zinc-500">
              Heartbeat {relativeTime(a.last_heartbeat)}
            </span>
            <span className="num text-zinc-400">
              {a.symbols.join(" · ") || "—"}
            </span>
          </div>
          {a.last_session ? (
            <div className="mt-2">
              <SessionBadge session={a.last_session} compact />
            </div>
          ) : null}
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <Stat label="Alerts" value={String(a.stats_today.total_alerts)} />
            <Stat
              label="W / L"
              value={`${a.stats_today.wins} / ${a.stats_today.losses}`}
            />
            <Stat
              label="R total"
              value={fmtR(a.stats_today.r_sum)}
              tone={
                a.stats_today.r_sum > 0
                  ? "green"
                  : a.stats_today.r_sum < 0
                    ? "red"
                    : "default"
              }
            />
          </div>
        </div>
      ))}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "green" | "red";
}) {
  const cls =
    tone === "green" ? "text-green-400" : tone === "red" ? "text-red-400" : "text-zinc-200";
  return (
    <div className="rounded-md bg-zinc-900/60 px-2 py-1.5">
      <div className={`num text-sm font-medium ${cls}`}>{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</div>
    </div>
  );
}
