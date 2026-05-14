"use client";

import { useCallback, useEffect, useState } from "react";
import { useStream } from "@/hooks/useStream";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { fmtR, todayStartIso } from "@/lib/utils";

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
  const tone = total > 0 ? "green" : total < 0 ? "red" : "muted";

  return (
    <Card>
      <CardHeader
        title="Today's equity curve"
        subtitle="cumulative R across all algorithms"
        right={<Badge variant={tone}>{fmtR(total)}</Badge>}
      />
      <div className="h-44">
        {points.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-zinc-500">
            No closed trades yet today
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={points} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="eqGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={total >= 0 ? "#22c55e" : "#ef4444"} stopOpacity={0.4} />
                  <stop offset="95%" stopColor={total >= 0 ? "#22c55e" : "#ef4444"} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="ts"
                tick={{ fill: "#71717a", fontSize: 10 }}
                tickFormatter={(t) => new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                stroke="#27272a"
              />
              <YAxis
                tick={{ fill: "#71717a", fontSize: 10 }}
                stroke="#27272a"
                tickFormatter={(v) => `${v}R`}
                width={40}
              />
              <Tooltip
                contentStyle={{ background: "#18181b", border: "1px solid #27272a", fontSize: 12 }}
                labelFormatter={(l) => new Date(l).toLocaleTimeString()}
                formatter={(v: unknown) => [`${Number(v).toFixed(2)}R`, "cum"]}
              />
              <Area
                type="monotone"
                dataKey="cumulative"
                stroke={total >= 0 ? "#22c55e" : "#ef4444"}
                strokeWidth={1.6}
                fill="url(#eqGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  );
}
