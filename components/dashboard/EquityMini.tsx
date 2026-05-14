"use client";

import { useCallback, useEffect, useState } from "react";
import { useStream } from "@/hooks/useStream";
import { Card } from "@/components/ui/card";
import { SectionHeader } from "@/components/ui/section-header";
import { TerminalEquityCurve } from "@/components/charts/TerminalCharts";
import { todayStartIso } from "@/lib/utils";

interface Point {
  ts: string;
  cumulative: number;
}

export function EquityMini() {
  const [points, setPoints] = useState<Point[]>([]);

  const load = useCallback(async () => {
    const since = todayStartIso();
    const r = await fetch(`/api/v1/equity?since=${encodeURIComponent(since)}`, {
      cache: "no-store",
    });
    const j = await r.json();
    setPoints(j.points ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useStream((e) => {
    if (e.event_type === "trade_exit") load();
  });

  const total = points.length ? points[points.length - 1].cumulative : 0;
  const sign = total >= 0 ? "+" : "";

  return (
    <Card>
      <SectionHeader
        title="Today's equity curve"
        right={`${sign}${total.toFixed(2)}R · closed trades`}
      />
      <div className="px-3 py-3 pb-1">
        <TerminalEquityCurve
          points={points}
          height={148}
          tickFormatter={(t) =>
            new Date(t).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })
          }
        />
      </div>
    </Card>
  );
}
