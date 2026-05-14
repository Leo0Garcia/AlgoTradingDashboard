"use client";

import { useState, useRef, useEffect } from "react";
import { useStream } from "@/hooks/useStream";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { StreamEvent } from "@/lib/types";

interface Row {
  id: string;
  ts: string;
  algo: string;
  kind: string;
  detail: string;
  tone: "muted" | "green" | "red" | "amber" | "blue";
}

function nameFor(map: Record<string, string>, id: string): string {
  return map[id] || id.slice(0, 10);
}

function summarize(e: StreamEvent, algoName: string): Row | null {
  const ts = new Date(e.received_at).toLocaleTimeString();
  const payload = e.payload as Record<string, unknown>;
  if (e.kind === "heartbeat" || e.event_type === "heartbeat") {
    const symbols = (payload?.symbols as Record<string, { status: string }>) || {};
    const parts = Object.entries(symbols)
      .map(([s, v]) => `${s} ${v?.status ?? "?"}`)
      .join("  ·  ");
    return {
      id: `${e.algorithm_id}-${e.received_at}`,
      ts,
      algo: algoName,
      kind: "Heartbeat",
      detail: parts || "tick",
      tone: "muted",
    };
  }
  if (e.event_type === "alert") {
    const p = payload as { symbol?: string; direction?: string; grade?: string };
    return {
      id: `${e.algorithm_id}-${e.received_at}-alert`,
      ts,
      algo: algoName,
      kind: "Alert",
      detail: `${p.symbol ?? ""} ${(p.direction || "").toUpperCase()} ${p.grade ?? ""}`,
      tone: p.direction === "long" ? "green" : "red",
    };
  }
  if (e.event_type === "trade_filled") {
    const p = payload as { external_id?: string; fill_px?: number };
    return {
      id: `${e.algorithm_id}-${e.received_at}-fill`,
      ts,
      algo: algoName,
      kind: "Filled",
      detail: `${p.external_id ?? ""} @ ${p.fill_px ?? "—"}`,
      tone: "blue",
    };
  }
  if (e.event_type === "trade_exit") {
    const p = payload as { status?: string; r_outcome?: number };
    const r = typeof p.r_outcome === "number" ? p.r_outcome.toFixed(2) : "—";
    const statusLabel = (p.status ?? "").toUpperCase();
    return {
      id: `${e.algorithm_id}-${e.received_at}-exit`,
      ts,
      algo: algoName,
      kind: `Exit ${statusLabel}`.trim(),
      detail: `${r}R`,
      tone: (p.r_outcome ?? 0) >= 0 ? "green" : "red",
    };
  }
  if (e.event_type === "rejection") {
    const p = payload as { symbol?: string; reason?: string };
    return {
      id: `${e.algorithm_id}-${e.received_at}-rej`,
      ts,
      algo: algoName,
      kind: "Rejected",
      detail: `${p.symbol ?? ""} — ${p.reason ?? "no reason"}`,
      tone: "amber",
    };
  }
  if (e.event_type === "error") {
    const p = payload as { message?: string };
    return {
      id: `${e.algorithm_id}-${e.received_at}-err`,
      ts,
      algo: algoName,
      kind: "Error",
      detail: p.message ?? "unknown",
      tone: "red",
    };
  }
  return null;
}

const MAX_ROWS = 200;

export function HeartbeatStream() {
  const [rows, setRows] = useState<Row[]>([]);
  const [nameMap, setNameMap] = useState<Record<string, string>>({});
  const scrollRef = useRef<HTMLDivElement>(null);

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
    if (!e || typeof e !== "object") return;
    if (!("algorithm_id" in e)) return;
    const row = summarize(e, nameFor(nameMap, e.algorithm_id));
    if (!row) return;
    setRows((rs) => {
      const next = [row, ...rs];
      return next.slice(0, MAX_ROWS);
    });
  });

  return (
    <Card>
      <CardHeader
        title="Live event stream"
        subtitle="Heartbeats, alerts, fills, exits — newest first"
        right={
          <Badge variant="muted">
            {rows.length} {rows.length === 1 ? "event" : "events"}
          </Badge>
        }
      />
      <div ref={scrollRef} className="max-h-[420px] overflow-auto">
        {rows.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-zinc-500">
            Waiting for algorithm activity…
          </div>
        ) : (
          <ul className="divide-y divide-zinc-900">
            {rows.map((r) => (
              <li
                key={r.id}
                className="px-4 py-2 flex items-center gap-3 text-xs hover:bg-zinc-900/40"
              >
                <span className="num text-zinc-500 w-20 shrink-0">{r.ts}</span>
                <span className="text-zinc-300 w-32 shrink-0 truncate">{r.algo}</span>
                <Badge variant={r.tone}>{r.kind}</Badge>
                <span className="num text-zinc-400 truncate flex-1">{r.detail}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
