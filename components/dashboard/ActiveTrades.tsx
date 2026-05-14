"use client";

import { useCallback, useEffect, useState } from "react";
import { useStream } from "@/hooks/useStream";
import { Card } from "@/components/ui/card";
import { SectionHeader } from "@/components/ui/section-header";
import { fmtNum } from "@/lib/utils";
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
    <Card className="flex flex-col">
      <SectionHeader title="Active trades" right={`${trades.length} open`} />
      <div className="max-h-[640px] overflow-auto">
        {trades.length === 0 ? (
          <div className="px-10 py-10 text-center text-[11px] text-dim">
            NO_ACTIVE_TRADES
          </div>
        ) : (
          <ul>
            {trades.map((t) => (
              <TradeRow key={t.id} trade={t} />
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}

function TradeRow({ trade: t }: { trade: Alert }) {
  // The dashboard doesn't yet track a live spot per active trade, so we can't
  // compute true unrealized R. Display "—" with the UNREALIZED label so the
  // layout matches the design; the value will populate once live ticks land.
  const fill = t.fill_px;
  const current = fill; // placeholder until a live spot feed exists
  const r = t.r_outcome;
  const rDisplay =
    r == null
      ? "—"
      : `${r > 0 ? "+" : ""}${r.toFixed(2)}R`;
  const rTone = r == null ? "text-dim" : r >= 0 ? "text-green" : "text-red";
  return (
    <li className="px-[18px] py-4 border-b border-bg-el-2">
      <div className="flex justify-between items-start mb-3">
        <div>
          <div className="text-bright font-semibold text-[15px]">{t.symbol}</div>
          <div className="flex gap-2.5 mt-1 text-[10px] tracking-[0.06em]">
            <span className={t.direction === "long" ? "text-green" : "text-red"}>
              {t.direction === "long" ? "▲ LONG" : "▼ SHORT"}
            </span>
            <span className="text-amber">{t.grade}</span>
          </div>
        </div>
        <div className="text-right">
          <div className={`font-semibold text-[18px] ${rTone}`}>{rDisplay}</div>
          <div className="text-dim text-[9px] mt-0.5 tracking-[0.06em]">
            UNREALIZED
          </div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2.5">
        {[
          ["ENTRY", fmtNum((t.entry_lo + t.entry_hi) / 2)],
          ["STOP", fmtNum(t.stop)],
          ["CURRENT", fmtNum(current)],
        ].map(([label, value]) => (
          <div key={label}>
            <div className="text-dim text-[9px] tracking-[0.08em] mb-1">
              {label}
            </div>
            <div
              className={`text-[11px] ${
                label === "STOP"
                  ? "text-red"
                  : label === "CURRENT"
                    ? "text-bright"
                    : "text-text"
              }`}
            >
              {value}
            </div>
          </div>
        ))}
      </div>
    </li>
  );
}
