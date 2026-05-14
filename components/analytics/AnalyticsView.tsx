"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { SectionHeader } from "@/components/ui/section-header";
import { Select } from "@/components/ui/select";
import { fmtR } from "@/lib/utils";
import type { Alert } from "@/lib/types";
import {
  TerminalEquityCurve,
  TerminalHBar,
  TerminalRDist,
  TerminalHourly,
} from "@/components/charts/TerminalCharts";

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
      fetch(`/api/v1/equity?${sp.toString()}`, { cache: "no-store" }).then((r) =>
        r.json(),
      ),
      (async () => {
        const sp2 = new URLSearchParams();
        if (since) sp2.set("from", since);
        if (algoId) sp2.set("algo", algoId);
        sp2.set("limit", "2000");
        const r = await fetch(`/api/v1/alerts?${sp2.toString()}`, {
          cache: "no-store",
        });
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

  const bySymbol = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of alerts) {
      m.set(a.symbol, (m.get(a.symbol) ?? 0) + (a.r_outcome ?? 0));
    }
    return Array.from(m.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);
  }, [alerts]);

  const byGrade = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of alerts) {
      m.set(a.grade, (m.get(a.grade) ?? 0) + (a.r_outcome ?? 0));
    }
    return ["A+", "A", "B"]
      .filter((g) => m.has(g))
      .map((label) => ({ label, value: m.get(label) ?? 0 }));
  }, [alerts]);

  const byRecipe = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of alerts) {
      const k = (a.recipe ?? "—").toUpperCase();
      m.set(k, (m.get(k) ?? 0) + (a.r_outcome ?? 0));
    }
    return Array.from(m.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 12);
  }, [alerts]);

  const rValues = useMemo(
    () =>
      alerts
        .map((a) => a.r_outcome)
        .filter((v): v is number => v !== null && v !== undefined),
    [alerts],
  );

  const byHour = useMemo(() => {
    const m = new Map<number, number>();
    for (const a of alerts) {
      if (a.r_outcome == null) continue;
      const h = new Date(a.received_at).getHours();
      m.set(h, (m.get(h) ?? 0) + a.r_outcome);
    }
    const out: { hour: number; r: number }[] = [];
    for (let h = 9; h <= 16; h++) out.push({ hour: h, r: m.get(h) ?? 0 });
    return out;
  }, [alerts]);

  return (
    <div className="px-6 py-[18px] flex flex-col gap-3.5">
      <div className="flex items-center gap-2.5">
        <Select value={w} onChange={(e) => setW(e.target.value as Window)}>
          <option value="today">TODAY</option>
          <option value="7d">LAST 7 DAYS</option>
          <option value="30d">LAST 30 DAYS</option>
          <option value="all">ALL TIME</option>
        </Select>
        <Select value={algoId} onChange={(e) => setAlgoId(e.target.value)}>
          <option value="">ALL ALGORITHMS</option>
          {algos.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name.toUpperCase()}
            </option>
          ))}
        </Select>
        <span
          className={`ml-auto font-semibold text-[13px] tracking-[0.04em] ${
            total >= 0 ? "text-green" : "text-red"
          }`}
        >
          WINDOW Σ {fmtR(total)}
        </span>
      </div>

      <Card>
        <SectionHeader title="Cumulative equity" right="Closed trades only" />
        <div className="px-3 py-3 pb-1.5">
          <TerminalEquityCurve
            points={points}
            height={180}
            tickFormatter={(t) => new Date(t).toLocaleDateString()}
          />
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
        <Card>
          <SectionHeader title="By symbol" />
          <TerminalHBar data={bySymbol} />
        </Card>
        <Card>
          <SectionHeader title="By grade" />
          <TerminalHBar data={byGrade} />
        </Card>
        <Card>
          <SectionHeader title="By recipe" />
          <TerminalHBar data={byRecipe} />
        </Card>
        <Card>
          <SectionHeader title="R-outcome distribution" />
          <div className="px-3 py-3 pb-1.5">
            <TerminalRDist values={rValues} />
          </div>
        </Card>
        <Card className="lg:col-span-2">
          <SectionHeader title="P&L by hour of day" right="Sum of R per bucket" />
          <div className="px-3 py-3 pb-1.5">
            <TerminalHourly data={byHour} />
          </div>
        </Card>
      </div>
    </div>
  );
}
