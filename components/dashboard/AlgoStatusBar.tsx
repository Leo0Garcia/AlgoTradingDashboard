"use client";

import { useCallback, useEffect, useState } from "react";
import { useStream } from "@/hooks/useStream";
import { Button } from "@/components/ui/button";
import { fmtR } from "@/lib/utils";
import { Play } from "lucide-react";
import { SessionBanner } from "./SessionBadge";
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
  working_dir: string | null;
  last_launch_error: string | null;
  stats_today: {
    total_alerts: number;
    approved_count: number;
    wins: number;
    losses: number;
    r_sum: number;
  };
}

interface LaunchError {
  message: string;
  log_path?: string;
  log_tail?: string;
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
  const [errors, setErrors] = useState<Record<string, LaunchError>>({});

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
      e.event_type === "alert" ||
      e.event_type === "algo_started" ||
      e.event_type === "algo_stopped" ||
      e.event_type === "algo_errored"
    ) {
      refresh();
    }
  });

  const control = async (id: string, action: "start" | "stop") => {
    setErrors((m) => {
      const next = { ...m };
      delete next[id];
      return next;
    });
    try {
      const r = await fetch(`/api/v1/algorithms/${id}/control`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as {
          error?: string;
          log_path?: string;
          log_tail?: string;
        };
        setErrors((m) => ({
          ...m,
          [id]: {
            message: j.error ?? `${action} failed (HTTP ${r.status})`,
            log_path: j.log_path,
            log_tail: j.log_tail,
          },
        }));
      }
    } catch (e) {
      setErrors((m) => ({
        ...m,
        [id]: { message: `${action} failed: ${(e as Error).message}` },
      }));
    } finally {
      refresh();
    }
  };

  const dismissError = (id: string) =>
    setErrors((m) => {
      const next = { ...m };
      delete next[id];
      return next;
    });

  if (algos.length === 0) {
    return (
      <div className="bg-bg-el border-t-2 border-t-div px-[18px] py-3 text-[11px] text-dim">
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

      <div
        className="grid gap-2.5 justify-start"
        style={{ gridTemplateColumns: "repeat(4, 280px)" }}
      >
        {algos.map((a) => (
          <AlgoCard key={a.id} algo={a} onControl={control} />
        ))}
      </div>

      {algos.some((a) => errors[a.id] || (a.last_launch_error && a.status === "errored"))
        ? algos.map((a) => {
            const err =
              errors[a.id] ??
              (a.last_launch_error && a.status === "errored"
                ? { message: a.last_launch_error }
                : null);
            if (!err) return null;
            return (
              <LaunchErrorBanner
                key={`err-${a.id}`}
                algoName={a.name}
                error={err}
                onDismiss={() => dismissError(a.id)}
              />
            );
          })
        : null}
    </div>
  );
}

function LaunchErrorBanner({
  algoName,
  error,
  onDismiss,
}: {
  algoName: string;
  error: LaunchError;
  onDismiss: () => void;
}) {
  return (
    <div className="bg-bg-el border-l-[3px] border-l-red px-[18px] py-2.5 text-[11px]">
      <div className="flex items-start gap-3">
        <span className="text-red text-[10px] tracking-[0.06em] flex-shrink-0">
          ▸ {algoName.toUpperCase()} · LAUNCH FAILED
        </span>
        <div className="flex-1 text-text whitespace-pre-wrap leading-relaxed">
          {error.message}
        </div>
        <button
          onClick={onDismiss}
          className="text-dim text-[10px] tracking-[0.06em] hover:text-text cursor-pointer"
        >
          DISMISS
        </button>
      </div>
      {error.log_tail ? (
        <pre className="mt-2 ml-[88px] text-[10px] text-dim whitespace-pre-wrap leading-snug max-h-40 overflow-auto">
          {error.log_tail}
        </pre>
      ) : null}
      {error.log_path ? (
        <div className="mt-1.5 ml-[88px] text-[10px] text-dim">
          Tail: <span className="text-text">tail -f {error.log_path}</span>
        </div>
      ) : null}
    </div>
  );
}

function AlgoCard({
  algo: a,
  onControl,
}: {
  algo: AlgorithmEntry;
  onControl: (id: string, action: "start" | "stop") => void;
}) {
  const accent =
    a.status === "running"
      ? "border-t-green"
      : a.status === "errored"
        ? "border-t-red"
        : "border-t-div";

  const sessionLabel = a.last_session?.name
    ? `${a.last_session.name.toUpperCase()} SESSION`
    : null;

  return (
    <div
      className={`bg-bg-el border border-bg-el-2 border-t-2 ${accent} flex flex-col`}
    >
      {/* Header */}
      <div className="px-3.5 pt-3 pb-2.5 flex items-start gap-2.5">
        <span className={`pulse-dot ${a.status} flex-shrink-0 mt-1.5`} />
        <div className="min-w-0 flex-1">
          <div className="text-bright font-semibold text-[13px] tracking-[0.02em] uppercase truncate">
            {a.name}
          </div>
          <div className="text-dim text-[9px] mt-1 tracking-[0.06em] uppercase truncate">
            {[a.type, ...a.symbols].filter(Boolean).join(" · ") || "—"}
          </div>
        </div>
        <div className="flex-shrink-0">
          {a.status === "running" ? (
            <Button
              size="sm"
              variant="danger"
              onClick={() => onControl(a.id, "stop")}
            >
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

      <div className="h-px bg-bg-el-2" />

      {/* Stats */}
      <div className="px-3.5 pt-3.5 pb-3 grid grid-cols-3 gap-2">
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

      {/* Footer */}
      <div className="px-3.5 pb-2.5 pt-0 flex items-center justify-between text-[9px] tracking-[0.06em]">
        <span className="text-green truncate">{sessionLabel ?? ""}</span>
        <span className="text-dim flex-shrink-0">HB {hbAgo(a.last_heartbeat)}</span>
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
    <div>
      <div className="text-[9px] tracking-[0.1em] text-dim uppercase">{label}</div>
      <div className={`text-[20px] font-semibold leading-tight mt-1.5 ${cls}`}>
        {value}
      </div>
    </div>
  );
}
