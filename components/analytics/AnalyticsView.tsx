"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardHeader } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { fmtR } from "@/lib/utils";
import type { Alert } from "@/lib/types";

type Window = "today" | "7d" | "30d" | "all";

function sinceFor(w: Window): string | undefined {
  if (w === "all") return undefined;
  const d = new Date();
  if (w === "today") d.setHours(0, 0, 0, 0);
  else if (w === "7d") d.setDate(d.getDate() - 7);
  else if (w === "30d") d.setDate(d.getDate() - 30);
  return d.toISOString();
}

interface AlgoLite {
  id: string;
  name: string;
}

interface Point {
  ts: string;
  cumulative: number;
}

export function AnalyticsView() {
  const [w, setW] = useState<Window>("7d");
  const [algoId, setAlgoId] = useState<string>("");
  const [algos, setAlgos] = useState<AlgoLite[]>([]);
  const [points, setPoints] = useState<Point[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);

  useEffect(() => {
    fetch("/api/v1/algorithms", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) =>
        setAlgos(
          (j.algorithms ?? []).map((a: AlgoLite) => ({ id: a.id, name: a.name })),
        ),
      )
      .catch(() => {});
  }, []);

  const load = useCallback(async () => {
    const since = sinceFor(w);
    const sp = new URLSearchParams();
    if (since) sp.set("since", since);
    if (algoId) sp.set("algo", algoId);
    const [eq, al] = await Promise.all([
      fetch(`/api/v1/equity?${sp.toString()}`, { cache: "no-store" }).then((r) => r.json()),
      (async () => {
        const sp2 = new URLSearchParams();
        if (since) sp2.set("from", since);
        if (algoId) sp2.set("algo", algoId);
        sp2.set("limit", "2000");
        const r = await fetch(`/api/v1/alerts?${sp2.toString()}`, { cache: "no-store" });
        return r.json();
      })(),
    ]);
    setPoints(eq.points ?? []);
    setAlerts(al.alerts ?? []);
  }, [w, algoId]);

  useEffect(() => {
    load();
  }, [load]);

  const total = points.length ? points[points.length - 1].cumulative : 0;

  const breakdownBy = (key: keyof Alert) => {
    const m = new Map<string, { wins: number; losses: number; r: number; total: number }>();
    for (const a of alerts) {
      const k = String(a[key] ?? "—");
      const e = m.get(k) ?? { wins: 0, losses: 0, r: 0, total: 0 };
      e.total += 1;
      if (["tp1", "tp2", "tp3", "be_after_tp1"].includes(a.status)) e.wins += 1;
      if (a.status === "stopped") e.losses += 1;
      e.r += a.r_outcome ?? 0;
      m.set(k, e);
    }
    return Array.from(m.entries())
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.r - a.r);
  };

  const bySymbol = useMemo(() => breakdownBy("symbol"), [alerts]);
  const byGrade = useMemo(() => breakdownBy("grade"), [alerts]);
  const byRecipe = useMemo(
    () => breakdownBy("recipe" as keyof Alert).slice(0, 12),
    [alerts],
  );

  const rDist = useMemo(() => {
    const bins = new Map<string, number>();
    for (const a of alerts) {
      if (a.r_outcome == null) continue;
      const bucket = Math.floor(a.r_outcome * 2) / 2;
      const key = bucket.toFixed(1);
      bins.set(key, (bins.get(key) ?? 0) + 1);
    }
    return Array.from(bins.entries())
      .map(([r, n]) => ({ r: Number(r), n }))
      .sort((a, b) => a.r - b.r);
  }, [alerts]);

  const byHour = useMemo(() => {
    const m = new Map<number, number>();
    for (const a of alerts) {
      if (a.r_outcome == null) continue;
      const h = new Date(a.received_at).getHours();
      m.set(h, (m.get(h) ?? 0) + a.r_outcome);
    }
    return Array.from({ length: 24 }, (_, h) => ({ h, r: m.get(h) ?? 0 }));
  }, [alerts]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Select value={w} onChange={(e) => setW(e.target.value as Window)}>
          <option value="today">today</option>
          <option value="7d">7d</option>
          <option value="30d">30d</option>
          <option value="all">all</option>
        </Select>
        <Select value={algoId} onChange={(e) => setAlgoId(e.target.value)}>
          <option value="">all algorithms</option>
          {algos.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </Select>
        <Badge variant={total >= 0 ? "green" : "red"} className="ml-auto">
          window Σ {fmtR(total)}
        </Badge>
      </div>

      <Card>
        <CardHeader title="Cumulative equity" subtitle="closed trades only" />
        <div className="h-72 px-2">
          {points.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-zinc-500">
              No closed trades in this window.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={points} margin={{ top: 16, right: 24, left: 0, bottom: 8 }}>
                <CartesianGrid stroke="#27272a" strokeDasharray="3 3" />
                <defs>
                  <linearGradient id="eq2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={total >= 0 ? "#22c55e" : "#ef4444"} stopOpacity={0.4} />
                    <stop offset="95%" stopColor={total >= 0 ? "#22c55e" : "#ef4444"} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="ts"
                  tick={{ fill: "#71717a", fontSize: 10 }}
                  tickFormatter={(t) => new Date(t).toLocaleDateString()}
                  stroke="#27272a"
                />
                <YAxis
                  tick={{ fill: "#71717a", fontSize: 10 }}
                  stroke="#27272a"
                  tickFormatter={(v) => `${v}R`}
                  width={50}
                />
                <Tooltip
                  contentStyle={{ background: "#18181b", border: "1px solid #27272a", fontSize: 12 }}
                  labelFormatter={(l) => new Date(l).toLocaleString()}
                  formatter={(v: unknown) => [`${Number(v).toFixed(2)}R`, "cum"]}
                />
                <Area
                  type="monotone"
                  dataKey="cumulative"
                  stroke={total >= 0 ? "#22c55e" : "#ef4444"}
                  strokeWidth={1.8}
                  fill="url(#eq2)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <BreakdownCard title="By symbol" rows={bySymbol} />
        <BreakdownCard title="By grade" rows={byGrade} />
        <BreakdownCard title="By recipe" rows={byRecipe} />

        <Card>
          <CardHeader title="R-outcome distribution" />
          <div className="h-60">
            {rDist.length === 0 ? (
              <Empty />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={rDist} margin={{ top: 16, right: 16, left: 0, bottom: 8 }}>
                  <CartesianGrid stroke="#27272a" strokeDasharray="3 3" />
                  <XAxis
                    dataKey="r"
                    tick={{ fill: "#71717a", fontSize: 10 }}
                    stroke="#27272a"
                    tickFormatter={(v) => `${v}R`}
                  />
                  <YAxis tick={{ fill: "#71717a", fontSize: 10 }} stroke="#27272a" width={30} />
                  <Tooltip
                    contentStyle={{ background: "#18181b", border: "1px solid #27272a", fontSize: 12 }}
                    formatter={(v, _n, c) => [`${v} trades`, `${(c as { payload: { r: number } }).payload.r}R`]}
                  />
                  <Bar dataKey="n">
                    {rDist.map((d) => (
                      <Cell key={d.r} fill={d.r >= 0 ? "#22c55e" : "#ef4444"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title="P&L by hour of day" subtitle="sum of R per hour bucket" />
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byHour} margin={{ top: 16, right: 16, left: 0, bottom: 8 }}>
                <CartesianGrid stroke="#27272a" strokeDasharray="3 3" />
                <XAxis dataKey="h" tick={{ fill: "#71717a", fontSize: 10 }} stroke="#27272a" />
                <YAxis
                  tick={{ fill: "#71717a", fontSize: 10 }}
                  stroke="#27272a"
                  tickFormatter={(v) => `${v}R`}
                  width={50}
                />
                <Tooltip
                  contentStyle={{ background: "#18181b", border: "1px solid #27272a", fontSize: 12 }}
                  formatter={(v: unknown) => [`${Number(v).toFixed(2)}R`, "R"]}
                  labelFormatter={(l) => `${l}:00`}
                />
                <Bar dataKey="r">
                  {byHour.map((d) => (
                    <Cell key={d.h} fill={d.r >= 0 ? "#22c55e" : "#ef4444"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  );
}

function Empty() {
  return (
    <div className="flex h-full items-center justify-center text-sm text-zinc-500">
      No data.
    </div>
  );
}

function BreakdownCard({
  title,
  rows,
}: {
  title: string;
  rows: { name: string; wins: number; losses: number; r: number; total: number }[];
}) {
  return (
    <Card>
      <CardHeader title={title} />
      <div className="max-h-72 overflow-auto">
        {rows.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-zinc-500">No data</div>
        ) : (
          <table className="w-full text-xs">
            <thead className="text-[10px] uppercase tracking-wider text-zinc-500">
              <tr className="border-b border-zinc-800">
                <th className="text-left px-3 py-2">name</th>
                <th className="text-right px-3 py-2">n</th>
                <th className="text-right px-3 py-2">w/l</th>
                <th className="text-right px-3 py-2">Σ R</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.name} className="border-b border-zinc-900">
                  <td className="px-3 py-1.5 text-zinc-200 truncate max-w-[260px]">
                    {r.name}
                  </td>
                  <td className="num px-3 py-1.5 text-right text-zinc-400">{r.total}</td>
                  <td className="num px-3 py-1.5 text-right text-zinc-300">
                    {r.wins}/{r.losses}
                  </td>
                  <td
                    className={`num px-3 py-1.5 text-right ${
                      r.r >= 0 ? "text-green-400" : "text-red-400"
                    }`}
                  >
                    {fmtR(r.r)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Card>
  );
}
