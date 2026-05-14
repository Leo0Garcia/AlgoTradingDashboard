"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useStream } from "@/hooks/useStream";
import { Card, CardHeader } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge, DirectionBadge, GradeBadge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { fmtNum, fmtR, fmtTime, todayStartIso } from "@/lib/utils";
import type { Alert } from "@/lib/types";
import { AlertDrawer } from "./AlertDrawer";

interface AlgoLite {
  id: string;
  name: string;
}

interface Filters {
  algo: string;
  from: string;
  to: string;
  symbol: string;
  direction: string;
  grade: string;
  status: string;
}

function emptyFilters(): Filters {
  return {
    algo: "",
    from: todayStartIso().slice(0, 16),
    to: "",
    symbol: "",
    direction: "",
    grade: "",
    status: "",
  };
}

export function JournalView() {
  const [algos, setAlgos] = useState<AlgoLite[]>([]);
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/v1/algorithms", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) =>
        setAlgos(
          (j.algorithms ?? []).map((a: { id: string; name: string }) => ({
            id: a.id,
            name: a.name,
          })),
        ),
      )
      .catch(() => {});
  }, []);

  const refresh = useCallback(async () => {
    const sp = new URLSearchParams();
    if (filters.algo) sp.set("algo", filters.algo);
    if (filters.from) sp.set("from", new Date(filters.from).toISOString());
    if (filters.to) sp.set("to", new Date(filters.to).toISOString());
    if (filters.symbol) sp.set("symbol", filters.symbol);
    if (filters.direction) sp.set("direction", filters.direction);
    if (filters.grade) sp.set("grade", filters.grade);
    if (filters.status) sp.set("status", filters.status);
    sp.set("limit", "500");
    const r = await fetch(`/api/v1/alerts?${sp.toString()}`, { cache: "no-store" });
    const j = await r.json();
    setAlerts(j.alerts ?? []);
  }, [filters]);

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

  const algoNameMap = useMemo(() => {
    const m: Record<string, string> = {};
    for (const a of algos) m[a.id] = a.name;
    return m;
  }, [algos]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title="Filters" subtitle="default: today" />
        <div className="p-4 flex flex-wrap gap-2 items-end">
          <FilterField label="algo">
            <Select
              value={filters.algo}
              onChange={(e) => setFilters({ ...filters, algo: e.target.value })}
            >
              <option value="">all</option>
              {algos.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          </FilterField>
          <FilterField label="from">
            <Input
              type="datetime-local"
              value={filters.from}
              onChange={(e) => setFilters({ ...filters, from: e.target.value })}
            />
          </FilterField>
          <FilterField label="to">
            <Input
              type="datetime-local"
              value={filters.to}
              onChange={(e) => setFilters({ ...filters, to: e.target.value })}
            />
          </FilterField>
          <FilterField label="symbol">
            <Input
              placeholder="MNQ1!"
              value={filters.symbol}
              onChange={(e) => setFilters({ ...filters, symbol: e.target.value })}
            />
          </FilterField>
          <FilterField label="direction">
            <Select
              value={filters.direction}
              onChange={(e) => setFilters({ ...filters, direction: e.target.value })}
            >
              <option value="">any</option>
              <option value="long">long</option>
              <option value="short">short</option>
            </Select>
          </FilterField>
          <FilterField label="grade">
            <Select
              value={filters.grade}
              onChange={(e) => setFilters({ ...filters, grade: e.target.value })}
            >
              <option value="">any</option>
              <option value="A+">A+</option>
              <option value="A">A</option>
              <option value="B">B</option>
            </Select>
          </FilterField>
          <FilterField label="status">
            <Select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            >
              <option value="">any</option>
              <option value="pending">pending</option>
              <option value="filled">filled</option>
              <option value="tp1">tp1</option>
              <option value="tp2">tp2</option>
              <option value="tp3">tp3</option>
              <option value="be_after_tp1">be_after_tp1</option>
              <option value="stopped">stopped</option>
              <option value="expired">expired</option>
            </Select>
          </FilterField>
          <div className="ml-auto flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setFilters(emptyFilters())}>
              reset
            </Button>
            <Button size="sm" variant="default" onClick={refresh}>
              apply
            </Button>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Alerts"
          subtitle={`${alerts.length} result${alerts.length === 1 ? "" : "s"}`}
          right={
            <Badge variant="muted">
              Σ {fmtR(alerts.reduce((s, a) => s + (a.r_outcome ?? 0), 0))}
            </Badge>
          }
        />
        <div className="overflow-auto">
          <table className="w-full text-xs">
            <thead className="text-zinc-500 uppercase text-[10px] tracking-wider">
              <tr className="border-b border-zinc-800">
                <Th>time</Th>
                <Th>algo</Th>
                <Th>symbol</Th>
                <Th>dir</Th>
                <Th>grade</Th>
                <Th className="text-right">entry</Th>
                <Th className="text-right">stop</Th>
                <Th className="text-right">tp1</Th>
                <Th className="text-right">tp2</Th>
                <Th className="text-right">tp3</Th>
                <Th>status</Th>
                <Th className="text-right">R</Th>
              </tr>
            </thead>
            <tbody>
              {alerts.map((a) => (
                <tr
                  key={a.id}
                  onClick={() => setSelectedId(a.id)}
                  className="border-b border-zinc-900 hover:bg-zinc-900/50 cursor-pointer"
                >
                  <Td className="num text-zinc-400">{fmtTime(a.received_at)}</Td>
                  <Td className="text-zinc-300 truncate max-w-[160px]">
                    {algoNameMap[a.algorithm_id] || a.algorithm_id.slice(0, 8)}
                  </Td>
                  <Td className="num text-zinc-100">{a.symbol}</Td>
                  <Td>
                    <DirectionBadge dir={a.direction} />
                  </Td>
                  <Td>
                    <GradeBadge grade={a.grade} />
                  </Td>
                  <Td className="num text-right text-zinc-300">
                    {fmtNum(a.entry_lo)}–{fmtNum(a.entry_hi)}
                  </Td>
                  <Td className="num text-right text-red-400">{fmtNum(a.stop)}</Td>
                  <Td className="num text-right text-green-400">{fmtNum(a.tp1)}</Td>
                  <Td className="num text-right text-green-400">{fmtNum(a.tp2)}</Td>
                  <Td className="num text-right text-green-400">{fmtNum(a.tp3)}</Td>
                  <Td>
                    <StatusBadge status={a.status} />
                  </Td>
                  <Td
                    className={`num text-right ${
                      (a.r_outcome ?? 0) > 0
                        ? "text-green-400"
                        : (a.r_outcome ?? 0) < 0
                          ? "text-red-400"
                          : "text-zinc-500"
                    }`}
                  >
                    {a.r_outcome == null ? "—" : `${a.r_outcome.toFixed(2)}R`}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
          {alerts.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-zinc-500">
              No alerts match the filters.
            </div>
          ) : null}
        </div>
      </Card>

      <AlertDrawer
        alertId={selectedId}
        algoNameMap={algoNameMap}
        onClose={() => setSelectedId(null)}
      />
    </div>
  );
}

function FilterField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</span>
      {children}
    </div>
  );
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={`text-left font-medium px-3 py-2 ${className ?? ""}`}>{children}</th>
  );
}
function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2 ${className ?? ""}`}>{children}</td>;
}
