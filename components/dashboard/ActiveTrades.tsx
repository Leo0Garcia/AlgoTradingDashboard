"use client";

import { useEffect, useState, useCallback } from "react";
import { useStream } from "@/hooks/useStream";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge, DirectionBadge, GradeBadge } from "@/components/ui/badge";
import { fmtNum, fmtTime, relativeTime } from "@/lib/utils";
import type { Alert } from "@/lib/types";

export function ActiveTrades() {
  const [trades, setTrades] = useState<Alert[]>([]);

  const refresh = useCallback(async () => {
    try {
      const r = await fetch("/api/v1/active-trades", { cache: "no-store" });
      const j = await r.json();
      setTrades(j.active ?? []);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useStream((e) => {
    if (
      e.event_type === "alert" ||
      e.event_type === "trade_filled" ||
      e.event_type === "trade_exit"
    ) {
      refresh();
    }
  });

  return (
    <Card>
      <CardHeader
        title="Active trades"
        subtitle="positions currently in market"
        right={<Badge variant="muted">{trades.length}</Badge>}
      />
      <div className="max-h-[640px] overflow-auto">
        {trades.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-zinc-500">
            No active trades
          </div>
        ) : (
          <ul className="divide-y divide-zinc-900">
            {trades.map((t) => (
              <li key={t.id} className="px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="num text-sm font-medium text-zinc-100">{t.symbol}</span>
                    <DirectionBadge dir={t.direction} />
                    <GradeBadge grade={t.grade} />
                  </div>
                  <Badge variant="blue">{t.status}</Badge>
                </div>
                <div className="mt-2 grid grid-cols-4 gap-2 text-[11px]">
                  <Cell label="fill" value={fmtNum(t.fill_px)} tone="default" />
                  <Cell label="stop" value={fmtNum(t.stop)} tone="red" />
                  <Cell label="tp1" value={fmtNum(t.tp1)} tone="green" />
                  <Cell label="tp2" value={fmtNum(t.tp2)} tone="green" />
                </div>
                <div className="mt-2 text-[11px] text-zinc-500 flex items-center justify-between">
                  <span>filled {fmtTime(t.fill_ts)}</span>
                  <span>since {relativeTime(t.fill_ts ?? t.received_at)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}

function Cell({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "default" | "red" | "green";
}) {
  const cls =
    tone === "red"
      ? "text-red-400"
      : tone === "green"
        ? "text-green-400"
        : "text-zinc-200";
  return (
    <div className="rounded bg-zinc-900/60 px-2 py-1">
      <div className={`num ${cls}`}>{value}</div>
      <div className="text-[9px] uppercase tracking-wider text-zinc-500">{label}</div>
    </div>
  );
}
