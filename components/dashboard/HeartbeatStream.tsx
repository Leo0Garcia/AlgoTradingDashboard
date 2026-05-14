"use client";

import { useEffect, useState } from "react";
import { useStream } from "@/hooks/useStream";
import { Card } from "@/components/ui/card";
import { SectionHeader } from "@/components/ui/section-header";
import type { StreamEvent } from "@/lib/types";

type EventTone = "alert" | "heartbeat" | "fill" | "exit" | "rejection" | "error";

interface Row {
  id: string;
  ts: string;
  algo: string;
  tone: EventTone;
  kind: string;
  detail: string;
  bright?: boolean;
}

const TONE_COLOR: Record<EventTone, string> = {
  alert: "text-amber",
  heartbeat: "text-dim",
  fill: "text-blue",
  exit: "text-green",
  rejection: "text-amber",
  error: "text-red",
};

function fmtTime(iso: string): string {
  try {
    const d = new Date(iso);
    const p = (n: number) => String(n).padStart(2, "0");
    return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
  } catch {
    return iso;
  }
}

function summarize(e: StreamEvent, algoName: string): Row | null {
  if (!e || !("algorithm_id" in e)) return null;
  const ts = fmtTime(e.received_at);
  const payload = (e.payload ?? {}) as Record<string, unknown>;

  if (e.kind === "heartbeat" || e.event_type === "heartbeat") {
    const symbols = (payload?.symbols as Record<string, { status: string }>) || {};
    const parts = Object.entries(symbols)
      .map(([s, v]) => `${s} ${v?.status ?? "?"}`)
      .join("  ·  ");
    return {
      id: `${e.algorithm_id}-${e.received_at}`,
      ts,
      algo: algoName,
      tone: "heartbeat",
      kind: "heartbeat",
      detail: parts || "tick",
    };
  }
  if (e.event_type === "alert") {
    const p = payload as { symbol?: string; direction?: string; grade?: string };
    return {
      id: `${e.algorithm_id}-${e.received_at}-alert`,
      ts,
      algo: algoName,
      tone: "alert",
      kind: "alert",
      detail: `${p.symbol ?? ""} ${(p.direction || "").toUpperCase()} ${p.grade ?? ""}`,
      bright: true,
    };
  }
  if (e.event_type === "trade_filled") {
    const p = payload as { external_id?: string; fill_px?: number };
    return {
      id: `${e.algorithm_id}-${e.received_at}-fill`,
      ts,
      algo: algoName,
      tone: "fill",
      kind: "fill",
      detail: `${p.external_id ?? ""} @ ${p.fill_px ?? "—"}`,
    };
  }
  if (e.event_type === "trade_exit") {
    const p = payload as { status?: string; r_outcome?: number };
    const r = typeof p.r_outcome === "number" ? p.r_outcome.toFixed(2) : "—";
    return {
      id: `${e.algorithm_id}-${e.received_at}-exit`,
      ts,
      algo: algoName,
      tone: "exit",
      kind: `exit ${(p.status ?? "").toUpperCase()}`.trim(),
      detail: `${r}R`,
    };
  }
  if (e.event_type === "rejection") {
    const p = payload as { symbol?: string; reason?: string };
    return {
      id: `${e.algorithm_id}-${e.received_at}-rej`,
      ts,
      algo: algoName,
      tone: "rejection",
      kind: "rejected",
      detail: `${p.symbol ?? ""} — ${p.reason ?? "no reason"}`,
    };
  }
  if (e.event_type === "error") {
    const p = payload as { message?: string };
    return {
      id: `${e.algorithm_id}-${e.received_at}-err`,
      ts,
      algo: algoName,
      tone: "error",
      kind: "error",
      detail: p.message ?? "unknown",
    };
  }
  return null;
}

const MAX_ROWS = 200;

export function HeartbeatStream() {
  const [rows, setRows] = useState<Row[]>([]);
  const [nameMap, setNameMap] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch("/api/v1/algorithms", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        const m: Record<string, string> = {};
        for (const a of j.algorithms ?? []) m[a.id] = a.name;
        setNameMap(m);
      })
      .catch(() => {});
  }, []);

  useStream((e) => {
    const name = nameMap[e.algorithm_id] || e.algorithm_id.slice(0, 10);
    const row = summarize(e, name);
    if (!row) return;
    setRows((rs) => [row, ...rs].slice(0, MAX_ROWS));
  });

  return (
    <Card>
      <SectionHeader
        title="Live event stream"
        right={`${rows.length} events · newest first`}
      />
      <div className="max-h-[420px] overflow-auto">
        {rows.length === 0 ? (
          <div className="px-[18px] py-10 text-center text-[11px] text-dim">
            WAITING_FOR_ALGORITHM_ACTIVITY
          </div>
        ) : (
          <ul>
            {rows.map((r) => (
              <li
                key={r.id}
                className="px-[18px] py-1.5 flex items-center gap-3.5 border-b border-bg-el-2 text-[11px]"
              >
                <span className="w-14 flex-shrink-0 text-dim">{r.ts}</span>
                <span className="w-32 flex-shrink-0 text-text text-[10px] truncate">
                  {r.algo}
                </span>
                <span
                  className={`w-[72px] flex-shrink-0 text-[10px] tracking-[0.08em] uppercase ${TONE_COLOR[r.tone]}`}
                >
                  {r.kind}
                </span>
                <span
                  className={`flex-1 truncate ${r.bright ? "text-bright" : "text-dim"}`}
                >
                  {r.detail}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
