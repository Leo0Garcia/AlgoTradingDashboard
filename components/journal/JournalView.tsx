"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useStream } from "@/hooks/useStream";
import { Card } from "@/components/ui/card";
import { SectionHeader } from "@/components/ui/section-header";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { fmtNum, todayStartIso } from "@/lib/utils";
import { StatusBadge } from "@/components/ui/badge";
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

const STATUS_OPTIONS: [string, string][] = [
  ["pending", "Pending"],
  ["filled", "Filled"],
  ["tp1", "TP1"],
  ["tp2", "TP2"],
  ["tp3", "TP3"],
  ["be_after_tp1", "Breakeven"],
  ["stopped", "Stopped"],
  ["expired", "Expired"],
];

export function JournalView() {
  const [algos, setAlgos] = useState<AlgoLite[]>([]);
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [applied, setApplied] = useState<Filters>(emptyFilters);
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
    if (applied.algo) sp.set("algo", applied.algo);
    if (applied.from) sp.set("from", new Date(applied.from).toISOString());
    if (applied.to) sp.set("to", new Date(applied.to).toISOString());
    if (applied.symbol) sp.set("symbol", applied.symbol);
    if (applied.direction) sp.set("direction", applied.direction);
    if (applied.grade) sp.set("grade", applied.grade);
    if (applied.status) sp.set("status", applied.status);
    sp.set("limit", "500");
    const r = await fetch(`/api/v1/alerts?${sp.toString()}`, { cache: "no-store" });
    const j = await r.json();
    setAlerts(j.alerts ?? []);
  }, [applied]);

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

  const totalR = alerts.reduce((s, a) => s + (a.r_outcome ?? 0), 0);
  const totalSign = totalR >= 0 ? "+" : "";

  return (
    <div className="px-6 py-[18px] flex flex-col gap-3.5">
      <Card>
        <SectionHeader title="Filters" right="Default: today" />
        <div className="px-[18px] py-3 flex flex-wrap gap-2.5 items-end">
          <FilterField label="ALGORITHM">
            <Select
              value={filters.algo}
              onChange={(e) => setFilters({ ...filters, algo: e.target.value })}
            >
              <option value="">All</option>
              {algos.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          </FilterField>
          <FilterField label="FROM">
            <Input
              type="datetime-local"
              className="w-40"
              value={filters.from}
              onChange={(e) => setFilters({ ...filters, from: e.target.value })}
            />
          </FilterField>
          <FilterField label="TO">
            <Input
              type="datetime-local"
              className="w-40"
              value={filters.to}
              onChange={(e) => setFilters({ ...filters, to: e.target.value })}
            />
          </FilterField>
          <FilterField label="SYMBOL">
            <Input
              placeholder="MNQ1!"
              className="w-24"
              value={filters.symbol}
              onChange={(e) => setFilters({ ...filters, symbol: e.target.value })}
            />
          </FilterField>
          <FilterField label="DIR">
            <Select
              value={filters.direction}
              onChange={(e) =>
                setFilters({ ...filters, direction: e.target.value })
              }
            >
              <option value="">Any</option>
              <option value="long">Long</option>
              <option value="short">Short</option>
            </Select>
          </FilterField>
          <FilterField label="GRADE">
            <Select
              value={filters.grade}
              onChange={(e) => setFilters({ ...filters, grade: e.target.value })}
            >
              <option value="">Any</option>
              <option value="A+">A+</option>
              <option value="A">A</option>
              <option value="B">B</option>
            </Select>
          </FilterField>
          <FilterField label="STATUS">
            <Select
              className="w-[110px]"
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            >
              <option value="">Any</option>
              {STATUS_OPTIONS.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </Select>
          </FilterField>

          <div className="ml-auto flex gap-2 items-end">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                const f = emptyFilters();
                setFilters(f);
                setApplied(f);
              }}
            >
              RESET
            </Button>
            <Button size="sm" variant="primary" onClick={() => setApplied(filters)}>
              APPLY ▸
            </Button>
          </div>
        </div>
      </Card>

      <Card>
        <SectionHeader
          title="Alerts"
          right={`${alerts.length} results · Σ ${totalSign}${totalR.toFixed(2)}R`}
        />
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[11px]">
            <thead>
              <tr>
                <Th>TIME</Th>
                <Th>ALGORITHM</Th>
                <Th>SYMBOL</Th>
                <Th>DIR</Th>
                <Th>GRADE</Th>
                <Th right>ENTRY</Th>
                <Th right>STOP</Th>
                <Th right>TP1</Th>
                <Th right>TP2</Th>
                <Th right>TP3</Th>
                <Th>STATUS</Th>
                <Th right>R</Th>
              </tr>
            </thead>
            <tbody>
              {alerts.length === 0 ? (
                <tr>
                  <td
                    colSpan={12}
                    className="px-10 py-10 text-center text-[11px] text-dim"
                  >
                    NO_RESULTS
                  </td>
                </tr>
              ) : (
                alerts.map((a) => (
                  <tr
                    key={a.id}
                    onClick={() => setSelectedId(a.id)}
                    className="cursor-pointer row-hover"
                  >
                    <Td>
                      <span className="text-dim">
                        {a.received_at.replace("T", " ").slice(0, 16)}
                      </span>
                    </Td>
                    <Td>
                      <span className="text-text uppercase tracking-[0.04em]">
                        {algoNameMap[a.algorithm_id] || a.algorithm_id.slice(0, 8)}
                      </span>
                    </Td>
                    <Td>
                      <span className="text-bright">{a.symbol}</span>
                    </Td>
                    <Td>
                      <span
                        className={`text-[10px] tracking-[0.06em] ${
                          a.direction === "long" ? "text-green" : "text-red"
                        }`}
                      >
                        {a.direction === "long" ? "▲ L" : "▼ S"}
                      </span>
                    </Td>
                    <Td>
                      <span
                        className={`font-semibold ${
                          a.grade === "A+"
                            ? "text-amber"
                            : a.grade === "A"
                              ? "text-text"
                              : "text-muted"
                        }`}
                      >
                        {a.grade}
                      </span>
                    </Td>
                    <Td right>
                      <span className="text-text">
                        {fmtNum(a.entry_lo)}–{fmtNum(a.entry_hi)}
                      </span>
                    </Td>
                    <Td right>
                      <span className="text-text">{fmtNum(a.stop)}</span>
                    </Td>
                    <Td right>
                      <span className="text-text">{fmtNum(a.tp1)}</span>
                    </Td>
                    <Td right>
                      <span className="text-text">{fmtNum(a.tp2)}</span>
                    </Td>
                    <Td right>
                      <span className="text-text">{fmtNum(a.tp3)}</span>
                    </Td>
                    <Td>
                      <StatusBadge status={a.status} />
                    </Td>
                    <Td right>
                      <span
                        className={`font-semibold ${
                          (a.r_outcome ?? 0) > 0
                            ? "text-green"
                            : (a.r_outcome ?? 0) < 0
                              ? "text-red"
                              : "text-dim"
                        }`}
                      >
                        {a.r_outcome == null
                          ? "—"
                          : `${a.r_outcome > 0 ? "+" : ""}${a.r_outcome.toFixed(1)}R`}
                      </span>
                    </Td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
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
      <span className="text-[9px] tracking-[0.1em] text-dim">{label}</span>
      {children}
    </div>
  );
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th
      className={`px-3 py-1.5 border-b border-div text-[9px] tracking-[0.1em] font-normal text-dim whitespace-nowrap ${
        right ? "text-right" : "text-left"
      }`}
    >
      {children}
    </th>
  );
}

function Td({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <td
      className={`px-3 py-1.5 border-b border-bg-el-2 text-[11px] ${
        right ? "text-right" : "text-left"
      }`}
    >
      {children}
    </td>
  );
}
