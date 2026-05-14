"use client";

import { useCallback, useEffect, useState } from "react";
import { useStream } from "@/hooks/useStream";
import { Button } from "@/components/ui/button";
import { fmtR } from "@/lib/utils";
import { Play, Square } from "lucide-react";
import { SessionBanner, SessionInline } from "./SessionBadge";
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

function hbAgo(iso: string | null): string {
  if (!iso) return "—";
  const sec = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  return `${Math.floor(sec / 3600)}h ago`;
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
    if (
      e.kind === "heartbeat" ||
      e.event_type === "trade_exit" ||
      e.event_type === "alert"
    ) {
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
      <div className="bg-bg-el border-l-[3px] border-l-div px-[18px] py-3 text-[11px] text-dim">
        NO_ALGORITHMS_REGISTERED — register one from the{" "}
        <span className="text-text">Algorithms</span> tab, or via{" "}
        <code className="text-text">POST /api/v1/algorithms/register</code>.
      </div>
    );
  }

  const pausedAlgos = algos.filter(
    (a) => a.status === "running" && a.last_session && !a.last_session.active,
  );

  return (
    <div className="flex flex-col gap-3.5">
      {pausedAlgos.length > 0 ? (
        <div className="space-y-2">
          {pausedAlgos.map((a) => (
            <SessionBanner key={a.id} algoName={a.name} session={a.last_session} />
          ))}
        </div>
      ) : null}

      {algos.map((a) => (
        <StatusRow key={a.id} algo={a} onControl={control} />
      ))}
    </div>
  );
}

function StatusRow({
  algo: a,
  onControl,
}: {
  algo: AlgorithmEntry;
  onControl: (id: string, action: "start" | "stop") => void;
}) {
  const accent =
    a.status === "running"
      ? "border-l-green"
      : a.status === "errored"
        ? "border-l-red"
        : "border-l-div";

  return (
    <div
      className={`bg-bg-el border-l-[3px] ${accent} px-[18px] py-3 flex items-center gap-7`}
    >
      <span className={`pulse-dot ${a.status} flex-shrink-0`} />

      <div className="min-w-0">
        <div className="text-bright font-semibold text-[14px] tracking-[0.02em] uppercase truncate">
          {a.name}
        </div>
        <div className="text-dim text-[10px] mt-0.5 tracking-[0.06em]">
          <span className="uppercase">{a.type}</span> · HB {hbAgo(a.last_heartbeat)}
        </div>
      </div>

      <div className="border-l border-div pl-7 flex items-center gap-5">
        <span className="text-text text-[12px]">{a.symbols.join(" · ") || "—"}</span>
        <SessionInline session={a.last_session} />
      </div>

      <div className="ml-auto flex items-center gap-9">
        <Stat label="ALERTS" value={String(a.stats_today.total_alerts)} />
        <Stat
          label="W / L"
          value={`${a.stats_today.wins} / ${a.stats_today.losses}`}
        />
        <Stat
          label="Σ R"
          value={fmtR(a.stats_today.r_sum)}
          tone={a.stats_today.r_sum >= 0 ? "green" : "red"}
        />
      </div>

      <div className="flex">
        {a.status === "running" ? (
          <Button size="sm" variant="danger" onClick={() => onControl(a.id, "stop")}>
            ■ STOP
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            disabled={!a.launch_cmd}
            title={a.launch_cmd ?? "No launch command configured"}
            onClick={() => onControl(a.id, "start")}
          >
            <Play className="h-3 w-3" /> START
          </Button>
        )}
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
    tone === "green" ? "text-green" : tone === "red" ? "text-red" : "text-text";
  return (
    <div className="text-right">
      <div className="text-[9px] tracking-[0.1em] text-dim uppercase">{label}</div>
      <div className={`text-[18px] font-semibold mt-0.5 ${cls}`}>{value}</div>
    </div>
  );
}
