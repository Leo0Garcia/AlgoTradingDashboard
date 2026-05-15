"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { SectionHeader } from "@/components/ui/section-header";
import { T } from "@/lib/theme";
import {
  TerminalEquityCurve,
  TerminalRDist,
  TerminalHourly,
} from "@/components/charts/TerminalCharts";

interface AlgoLite {
  id: string;
  name: string;
  symbols: string[];
}

interface Trade {
  id: string;
  time: string;
  symbol: string;
  dir: "long" | "short";
  grade: "A+" | "A" | "B";
  entry: number;
  stop: number;
  r: number;
  status: "tp1" | "tp2" | "tp3" | "stopped";
  cum: number;
}

interface Results {
  trades: Trade[];
  totalTrades: number;
  wins: number;
  losses: number;
  totalR: number;
  winRatePct: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  maxDD: number;
  expectancy: number;
}

type Phase = "idle" | "running" | "done";

function makeRand(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 4294967295;
  };
}

function generateResults(
  cfg: {
    algoId: string;
    symbol: string;
    fromDt: string;
    toDt: string;
  },
  algos: AlgoLite[],
): Results {
  const seed = (cfg.fromDt + cfg.toDt + cfg.algoId)
    .split("")
    .reduce((a, c) => a + c.charCodeAt(0), 0);
  const rand = makeRand(seed);
  const from = new Date(cfg.fromDt);
  const to = new Date(cfg.toDt);
  const days = Math.max(1, Math.round((+to - +from) / 86400000));
  const target = Math.min(200, Math.max(50, Math.floor(days * 0.85)));
  const winRate = 0.54 + rand() * 0.16;
  const algo = algos.find((a) => a.id === cfg.algoId) ?? algos[0];
  const algoSymbols = algo?.symbols?.length ? algo.symbols : ["SYM"];
  const syms = cfg.symbol === "ALL" ? algoSymbols : [cfg.symbol];

  const trades: Trade[] = [];
  for (let i = 0; i < Math.ceil(target * 1.4); i++) {
    if (trades.length >= target) break;
    const dayOff = Math.floor(rand() * days);
    const d = new Date(from.getTime() + dayOff * 86400000);
    if (d.getDay() === 0 || d.getDay() === 6) continue;
    d.setHours(9 + Math.floor(rand() * 7), Math.floor(rand() * 60), 0, 0);
    const isWin = rand() < winRate;
    const grade: Trade["grade"] = rand() < 0.25 ? "A+" : rand() < 0.65 ? "A" : "B";
    let r = isWin
      ? grade === "A+"
        ? 2 + rand() * 1.5
        : grade === "A"
          ? 1 + rand() * 1.2
          : 0.8 + rand() * 0.7
      : -(0.8 + rand() * 0.4);
    r = parseFloat(r.toFixed(2));
    const sym = syms[Math.floor(rand() * syms.length)];
    const dir: Trade["dir"] = rand() > 0.5 ? "long" : "short";
    const status: Trade["status"] = isWin
      ? r >= 3
        ? "tp3"
        : r >= 2
          ? "tp2"
          : "tp1"
      : "stopped";
    const base = sym.includes("NQ")
      ? 21000 + rand() * 600
      : sym.includes("MES") || sym.includes("ES")
        ? 5700 + rand() * 200
        : sym.includes("YM")
          ? 39000 + rand() * 1000
          : sym.includes("RTY")
            ? 2000 + rand() * 150
            : sym.includes("CL")
              ? 70 + rand() * 15
              : sym.includes("GC")
                ? 2300 + rand() * 200
                : 100 + rand() * 50;
    trades.push({
      id: `bt${i}`,
      time: d.toISOString(),
      symbol: sym,
      dir,
      grade,
      entry: parseFloat(base.toFixed(2)),
      stop: parseFloat(
        (dir === "long"
          ? base - 18 - rand() * 10
          : base + 18 + rand() * 10
        ).toFixed(2),
      ),
      r,
      status,
      cum: 0,
    });
  }

  trades.sort((a, b) => a.time.localeCompare(b.time));
  let cum = 0;
  let peak = 0;
  let maxDD = 0;
  for (const t of trades) {
    cum = parseFloat((cum + t.r).toFixed(2));
    t.cum = cum;
    if (cum > peak) peak = cum;
    const dd = parseFloat((peak - cum).toFixed(2));
    if (dd > maxDD) maxDD = dd;
  }

  const wins = trades.filter((t) => t.r > 0);
  const losses = trades.filter((t) => t.r <= 0);
  const n = trades.length || 1;
  const avgWin = wins.length
    ? parseFloat((wins.reduce((s, t) => s + t.r, 0) / wins.length).toFixed(2))
    : 0;
  const avgLoss = losses.length
    ? parseFloat(
        (losses.reduce((s, t) => s + t.r, 0) / losses.length).toFixed(2),
      )
    : 0;
  const pf =
    losses.length && avgLoss !== 0
      ? parseFloat(
          Math.abs(
            (avgWin * wins.length) / (avgLoss * losses.length),
          ).toFixed(2),
        )
      : 0;
  const expectancy = parseFloat(
    ((wins.length / n) * avgWin + (losses.length / n) * avgLoss).toFixed(2),
  );

  return {
    trades,
    totalTrades: trades.length,
    wins: wins.length,
    losses: losses.length,
    totalR: cum,
    winRatePct: parseFloat(((wins.length / n) * 100).toFixed(1)),
    avgWin,
    avgLoss,
    profitFactor: pf,
    maxDD: parseFloat(maxDD.toFixed(2)),
    expectancy,
  };
}

const RUN_LINES = (cfg: {
  algoName: string;
  fromDt: string;
  toDt: string;
  symbol: string;
}): string[] => [
  `> INIT backtest engine v2.4.1`,
  `> ALGORITHM  : ${cfg.algoName.toUpperCase()}`,
  `> DATE RANGE : ${cfg.fromDt.replace("T", " ")} → ${cfg.toDt.replace("T", " ")}`,
  `> SYMBOL     : ${cfg.symbol}`,
  `> FETCHING historical bars...`,
  `> BARS LOADED: ${(12000 + Math.floor(Math.random() * 4000)).toLocaleString()} candles`,
  `> RUNNING signal detection pass...`,
  `> APPLYING entry / exit rules...`,
  `> CALCULATING position sizing...`,
  `> COMPUTING drawdown series...`,
  `> BUILDING trade log...`,
  `> ─────────────────────────────────────────`,
  `> BACKTEST COMPLETE ✓`,
];

export function BacktestView() {
  const [algos, setAlgos] = useState<AlgoLite[]>([]);
  const [algoId, setAlgoId] = useState<string>("");
  const [symbol, setSymbol] = useState<string>("ALL");
  const [fromDt, setFromDt] = useState<string>("2026-01-01T09:30");
  const [toDt, setToDt] = useState<string>("2026-05-14T16:00");

  const [phase, setPhase] = useState<Phase>("idle");
  const [logLines, setLogLines] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<Results | null>(null);
  const [logPage, setLogPage] = useState(0);

  useEffect(() => {
    fetch("/api/v1/algorithms", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        const list: AlgoLite[] = (j.algorithms ?? []).map(
          (a: { id: string; name: string; symbols: string[] }) => ({
            id: a.id,
            name: a.name,
            symbols: a.symbols ?? [],
          }),
        );
        setAlgos(list);
        if (list.length > 0) {
          setAlgoId(list[0].id);
          setSymbol("ALL");
        }
      })
      .catch(() => {});
  }, []);

  const selectedAlgo = useMemo(
    () => algos.find((a) => a.id === algoId) ?? algos[0],
    [algos, algoId],
  );

  useEffect(() => {
    if (selectedAlgo) setSymbol("ALL");
  }, [algoId, selectedAlgo]);

  const runBacktest = useCallback(() => {
    if (!selectedAlgo) return;
    const cfg = {
      algoId,
      symbol,
      fromDt,
      toDt,
      algoName: selectedAlgo.name,
    };
    setPhase("running");
    setLogLines([]);
    setProgress(0);
    setLogPage(0);
    setResults(null);

    const lines = RUN_LINES(cfg);
    let i = 0;
    const iv = setInterval(() => {
      if (i < lines.length) {
        const line = lines[i];
        setLogLines((prev) => [...prev, line]);
        setProgress(Math.round(((i + 1) / lines.length) * 100));
        i++;
      } else {
        clearInterval(iv);
        const res = generateResults(cfg, algos);
        setResults(res);
        setPhase("done");
      }
    }, 160);
  }, [algoId, symbol, fromDt, toDt, selectedAlgo, algos]);

  return (
    <main className="flex-1 overflow-auto">
      <div className="px-6 py-[18px] flex flex-col gap-3.5">
        {/* Config */}
        <Card>
          <SectionHeader
            title="Backtest configuration"
            right={
              phase === "done" && results
                ? `${results.totalTrades} trades simulated`
                : undefined
            }
          />
          <div className="px-[18px] py-4 flex flex-wrap items-end gap-2.5">
            <Field label="ALGORITHM">
              <BtSelect
                value={algoId}
                onChange={(e) => setAlgoId(e.target.value)}
                disabled={phase === "running"}
                minWidth={190}
              >
                {algos.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name.toUpperCase()}
                  </option>
                ))}
                {algos.length === 0 ? (
                  <option value="">NO ALGORITHMS REGISTERED</option>
                ) : null}
              </BtSelect>
            </Field>

            <Field label="SYMBOL">
              <BtSelect
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                disabled={phase === "running"}
                minWidth={110}
              >
                <option value="ALL">ALL</option>
                {(selectedAlgo?.symbols ?? []).map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </BtSelect>
            </Field>

            <Field label="FROM">
              <BtInput
                type="datetime-local"
                value={fromDt}
                onChange={(e) => setFromDt(e.target.value)}
                disabled={phase === "running"}
                minWidth={175}
              />
            </Field>

            <Field label="TO">
              <BtInput
                type="datetime-local"
                value={toDt}
                onChange={(e) => setToDt(e.target.value)}
                disabled={phase === "running"}
                minWidth={175}
              />
            </Field>

            <button
              onClick={runBacktest}
              disabled={phase === "running" || !selectedAlgo}
              className="h-[30px] px-5 text-[11px] tracking-[0.08em] font-mono uppercase cursor-pointer disabled:cursor-not-allowed"
              style={{
                background:
                  phase === "running"
                    ? "transparent"
                    : "rgba(0,212,154,0.08)",
                border: `1px solid ${phase === "running" ? T.div : T.green}`,
                color: phase === "running" ? T.dim : T.green,
              }}
            >
              {phase === "running" ? "▶ RUNNING..." : "▶ RUN BACKTEST"}
            </button>

            {phase === "done" ? (
              <button
                onClick={() => {
                  setPhase("idle");
                  setResults(null);
                }}
                className="h-[30px] px-3.5 text-[11px] tracking-[0.08em] font-mono uppercase cursor-pointer"
                style={{
                  background: "transparent",
                  border: `1px solid ${T.div}`,
                  color: T.dim,
                }}
              >
                ↺ RESET
              </button>
            ) : null}
          </div>
        </Card>

        {/* Running phase */}
        {phase === "running" ? (
          <Card>
            <SectionHeader title="Running" right={`${progress}%`} />
            <div className="px-[18px] py-3.5">
              <div className="h-[3px] bg-bg-el-2 mb-4">
                <div
                  style={{
                    width: `${progress}%`,
                    background: T.green,
                    transition: "width 0.15s linear",
                  }}
                  className="h-full"
                />
              </div>
              {logLines.map((line, i) => (
                <div
                  key={i}
                  className="text-[11px] mb-1 tracking-[0.02em]"
                  style={{
                    color: line.includes("COMPLETE") ? T.green : T.text,
                  }}
                >
                  {line}
                </div>
              ))}
            </div>
          </Card>
        ) : null}

        {/* Results */}
        {phase === "done" && results && selectedAlgo ? (
          <BTResults
            results={results}
            algoName={selectedAlgo.name}
            fromDt={fromDt}
            toDt={toDt}
            symbol={symbol}
            logPage={logPage}
            setLogPage={setLogPage}
          />
        ) : null}
      </div>
    </main>
  );
}

/* ── Form helpers ─────────────────────────────────────────────────────── */

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[9px] text-dim tracking-[0.1em]">{label}</label>
      {children}
    </div>
  );
}

function BtSelect({
  value,
  onChange,
  disabled,
  minWidth,
  children,
}: {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  disabled?: boolean;
  minWidth: number;
  children: React.ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={onChange}
      disabled={disabled}
      style={{
        height: 30,
        background: T.bgEl,
        border: `1px solid ${T.div}`,
        color: T.text,
        padding: "0 8px",
        fontSize: 11,
        fontFamily: T.mono,
        outline: "none",
        cursor: disabled ? "not-allowed" : "pointer",
        colorScheme: "dark",
        minWidth,
      }}
    >
      {children}
    </select>
  );
}

function BtInput({
  type,
  value,
  onChange,
  disabled,
  minWidth,
}: {
  type: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  disabled?: boolean;
  minWidth: number;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={onChange}
      disabled={disabled}
      style={{
        height: 30,
        background: T.bgEl,
        border: `1px solid ${T.div}`,
        color: T.text,
        padding: "0 8px",
        fontSize: 11,
        fontFamily: T.mono,
        outline: "none",
        cursor: disabled ? "not-allowed" : "pointer",
        colorScheme: "dark",
        minWidth,
      }}
    />
  );
}

/* ── Results panel ────────────────────────────────────────────────────── */

function BTResults({
  results,
  algoName,
  fromDt,
  toDt,
  symbol,
  logPage,
  setLogPage,
}: {
  results: Results;
  algoName: string;
  fromDt: string;
  toDt: string;
  symbol: string;
  logPage: number;
  setLogPage: (fn: (p: number) => number) => void;
}) {
  const PAGE_SIZE = 20;
  const totalPages = Math.max(1, Math.ceil(results.totalTrades / PAGE_SIZE));
  const rc = (v: number) => (v >= 0 ? T.green : T.red);
  const fmt = (v: number) => (v > 0 ? "+" : "") + v.toFixed(2) + "R";

  const equityPoints = useMemo(
    () =>
      results.trades.map((t) => ({
        ts: t.time,
        cumulative: t.cum,
      })),
    [results.trades],
  );

  const rValues = useMemo(
    () => results.trades.map((t) => t.r),
    [results.trades],
  );

  const hourlyData = useMemo(() => {
    const m = new Map<number, number>();
    for (const t of results.trades) {
      const h = new Date(t.time).getHours();
      m.set(h, (m.get(h) ?? 0) + t.r);
    }
    const out: { hour: number; r: number }[] = [];
    for (let h = 9; h <= 16; h++)
      out.push({ hour: h, r: parseFloat((m.get(h) ?? 0).toFixed(2)) });
    return out;
  }, [results.trades]);

  return (
    <div className="flex flex-col gap-3.5">
      {/* Summary bar */}
      <div
        className="flex items-center gap-5 flex-wrap"
        style={{
          background: T.bgEl,
          borderLeft: `3px solid ${T.green}`,
          padding: "10px 18px",
        }}
      >
        <span
          className="tracking-[0.08em]"
          style={{ color: T.green, fontSize: 10 }}
        >
          ▸ RESULT
        </span>
        <span
          className="font-semibold"
          style={{ color: T.bright, fontSize: 12 }}
        >
          {algoName.toUpperCase()}
        </span>
        <span style={{ color: T.div }}>│</span>
        <span style={{ color: T.text, fontSize: 11 }}>
          {`${fromDt.replace("T", " ")} → ${toDt.replace("T", " ")}`}
        </span>
        <span style={{ color: T.dim, fontSize: 10 }}>{symbol}</span>
        <span
          className="ml-auto font-semibold"
          style={{ color: rc(results.totalR), fontSize: 15 }}
        >
          {fmt(results.totalR)}
        </span>
      </div>

      {/* Metrics strip */}
      <div className="flex flex-wrap" style={{ gap: 3 }}>
        <BTMetric label="TOTAL TRADES" value={String(results.totalTrades)} />
        <BTMetric
          label="WIN RATE"
          value={results.winRatePct + "%"}
          color={results.winRatePct >= 50 ? T.green : T.red}
        />
        <BTMetric
          label="Σ R"
          value={fmt(results.totalR)}
          color={rc(results.totalR)}
        />
        <BTMetric
          label="PROFIT FACTOR"
          value={results.profitFactor.toFixed(2)}
          color={
            results.profitFactor >= 1.5
              ? T.green
              : results.profitFactor >= 1
                ? T.amber
                : T.red
          }
        />
        <BTMetric
          label="MAX DRAWDOWN"
          value={"-" + results.maxDD.toFixed(2) + "R"}
          color={T.red}
        />
        <BTMetric
          label="AVG WIN"
          value={"+" + results.avgWin.toFixed(2) + "R"}
          color={T.green}
        />
        <BTMetric
          label="AVG LOSS"
          value={results.avgLoss.toFixed(2) + "R"}
          color={T.red}
        />
        <BTMetric
          label="EXPECTANCY"
          value={fmt(results.expectancy)}
          color={rc(results.expectancy)}
        />
      </div>

      {/* Equity curve */}
      <Card>
        <SectionHeader
          title="Equity curve"
          right={`${results.totalTrades} closed trades · ${results.wins}W / ${results.losses}L`}
        />
        <div className="px-3 pt-3 pb-1.5">
          <TerminalEquityCurve points={equityPoints} height={200} />
        </div>
      </Card>

      {/* 2x2 chart grid */}
      <div
        className="grid"
        style={{ gridTemplateColumns: "1fr 1fr", gap: 14 }}
      >
        <Card>
          <SectionHeader title="R-outcome distribution" />
          <div className="px-3 pt-3 pb-1.5">
            <TerminalRDist values={rValues} />
          </div>
        </Card>
        <Card>
          <SectionHeader title="P&L by hour of day" />
          <div className="px-3 pt-3 pb-1.5">
            <TerminalHourly data={hourlyData} />
          </div>
        </Card>
        <Card>
          <SectionHeader title="P&L by day of week" />
          <BTDayChart trades={results.trades} />
        </Card>
        <Card>
          <SectionHeader title="Drawdown series" />
          <BTDrawdownChart trades={results.trades} />
        </Card>
      </div>

      {/* Trade log */}
      <Card>
        <SectionHeader
          title="Trade log"
          right={`page ${logPage + 1} / ${totalPages}`}
        />
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {[
                  "#",
                  "TIME",
                  "SYMBOL",
                  "DIR",
                  "GRADE",
                  "ENTRY",
                  "STOP",
                  "R",
                  "STATUS",
                  "CUM R",
                ].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: "7px 12px",
                      fontSize: 9,
                      letterSpacing: "0.1em",
                      color: T.dim,
                      fontWeight: 400,
                      borderBottom: `1px solid ${T.div}`,
                      textAlign: ["#", "R", "CUM R"].includes(h)
                        ? "right"
                        : "left",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {results.trades
                .slice(logPage * PAGE_SIZE, (logPage + 1) * PAGE_SIZE)
                .map((t, i) => {
                  const idx = logPage * PAGE_SIZE + i + 1;
                  const win = t.r > 0;
                  const stCol =
                    t.status === "stopped"
                      ? T.red
                      : t.status.startsWith("tp")
                        ? T.green
                        : T.dim;
                  const cells: [string, string, number, boolean, number][] = [
                    [String(idx), T.dim, 9, true, 400],
                    [t.time.replace("T", " ").slice(0, 16), T.muted, 10, false, 400],
                    [t.symbol, T.bright, 11, false, 500],
                    [
                      t.dir.toUpperCase(),
                      t.dir === "long" ? T.green : T.red,
                      10,
                      false,
                      400,
                    ],
                    [t.grade, T.amber, 10, false, 400],
                    [t.entry.toFixed(2), T.text, 10, false, 400],
                    [t.stop.toFixed(2), T.text, 10, false, 400],
                    [
                      (win ? "+" : "") + t.r.toFixed(2) + "R",
                      win ? T.green : T.red,
                      11,
                      true,
                      600,
                    ],
                    [t.status.toUpperCase(), stCol, 10, false, 400],
                    [
                      (t.cum >= 0 ? "+" : "") + t.cum.toFixed(2) + "R",
                      t.cum >= 0 ? T.green : T.red,
                      11,
                      true,
                      600,
                    ],
                  ];
                  return (
                    <tr
                      key={t.id}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.background = T.bgEl2)
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.background = "transparent")
                      }
                    >
                      {cells.map(([val, col, size, right, fw], ci) => (
                        <td
                          key={ci}
                          style={{
                            padding: "8px 12px",
                            fontSize: size,
                            color: col,
                            textAlign: right ? "right" : "left",
                            borderBottom: `1px solid ${T.bgEl2}`,
                            fontWeight: fw,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {val}
                        </td>
                      ))}
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
        <div
          className="flex items-center justify-between"
          style={{
            padding: "10px 18px",
            borderTop: `1px solid ${T.div}`,
          }}
        >
          <button
            onClick={() => setLogPage((p) => Math.max(0, p - 1))}
            disabled={logPage === 0}
            style={{
              background: "transparent",
              border: `1px solid ${T.div}`,
              color: logPage === 0 ? T.dim : T.text,
              padding: "4px 14px",
              fontSize: 10,
              cursor: logPage === 0 ? "default" : "pointer",
              fontFamily: T.mono,
              letterSpacing: "0.06em",
            }}
          >
            ← PREV
          </button>
          <span style={{ fontSize: 10, color: T.dim }}>
            {logPage * PAGE_SIZE + 1}–
            {Math.min((logPage + 1) * PAGE_SIZE, results.totalTrades)} of{" "}
            {results.totalTrades}
          </span>
          <button
            onClick={() =>
              setLogPage((p) => Math.min(totalPages - 1, p + 1))
            }
            disabled={logPage + 1 >= totalPages}
            style={{
              background: "transparent",
              border: `1px solid ${T.div}`,
              color: logPage + 1 >= totalPages ? T.dim : T.text,
              padding: "4px 14px",
              fontSize: 10,
              cursor: logPage + 1 >= totalPages ? "default" : "pointer",
              fontFamily: T.mono,
              letterSpacing: "0.06em",
            }}
          >
            NEXT →
          </button>
        </div>
      </Card>
    </div>
  );
}

/* ── Metric tile ──────────────────────────────────────────────────────── */

function BTMetric({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div
      style={{
        background: T.bgEl,
        border: "1px solid #1c1c1c",
        padding: "14px 18px",
        flex: 1,
        minWidth: 0,
      }}
    >
      <div
        style={{
          fontSize: 9,
          color: T.dim,
          letterSpacing: "0.1em",
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 22,
          fontWeight: 600,
          color: color || T.bright,
          whiteSpace: "nowrap",
        }}
      >
        {value}
      </div>
    </div>
  );
}

/* ── Day-of-week bar chart ────────────────────────────────────────────── */

function BTDayChart({ trades }: { trades: Trade[] }) {
  const names = ["Mon", "Tue", "Wed", "Thu", "Fri"] as const;
  const dayMap: Record<number, (typeof names)[number]> = {
    1: "Mon",
    2: "Tue",
    3: "Wed",
    4: "Thu",
    5: "Fri",
  };
  const sums: Record<(typeof names)[number], number> = {
    Mon: 0,
    Tue: 0,
    Wed: 0,
    Thu: 0,
    Fri: 0,
  };
  for (const t of trades) {
    const k = dayMap[new Date(t.time).getDay()];
    if (k) sums[k] += t.r;
  }
  const vals = names.map((n) => sums[n]);
  const absMax = Math.max(...vals.map(Math.abs), 0.1);
  const W = 400;
  const H = 128;
  const pad = { l: 28, r: 8, t: 10, b: 22 };
  const bw = (W - pad.l - pad.r) / 5;
  const midY = pad.t + (H - pad.t - pad.b) / 2;

  return (
    <div style={{ padding: "12px 12px 8px" }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height={H}
        style={{ display: "block" }}
      >
        <line
          x1={pad.l}
          y1={midY}
          x2={W - pad.r}
          y2={midY}
          stroke={T.muted}
          strokeWidth={1}
          strokeDasharray="3 3"
        />
        {names.map((name, i) => {
          const v = vals[i];
          const half = (H - pad.t - pad.b) / 2 - 4;
          const bh = Math.max(0, (Math.abs(v) / absMax) * half);
          const x = pad.l + i * bw + bw * 0.15;
          const col = v >= 0 ? "rgba(0,212,154,0.45)" : "rgba(255,82,82,0.45)";
          return (
            <g key={name}>
              {bh > 0.5 ? (
                <rect
                  x={x}
                  y={v >= 0 ? midY - bh : midY}
                  width={bw * 0.7}
                  height={bh}
                  fill={col}
                />
              ) : null}
              <text
                x={x + bw * 0.35}
                y={H - pad.b + 13}
                textAnchor="middle"
                fontSize={9}
                fill={T.dim}
                fontFamily={T.mono}
              >
                {name}
              </text>
              {Math.abs(v) > 0.05 ? (
                <text
                  x={x + bw * 0.35}
                  y={v >= 0 ? midY - bh - 3 : midY + bh + 11}
                  textAnchor="middle"
                  fontSize={9}
                  fill={v >= 0 ? T.green : T.red}
                  fontFamily={T.mono}
                >
                  {(v > 0 ? "+" : "") + v.toFixed(1)}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/* ── Drawdown series ──────────────────────────────────────────────────── */

function BTDrawdownChart({ trades }: { trades: Trade[] }) {
  if (trades.length === 0) {
    return (
      <div className="px-[18px] py-6 text-[12px] text-dim text-center">
        NO_DATA
      </div>
    );
  }
  let peak = 0;
  const pts = trades.map((t) => {
    if (t.cum > peak) peak = t.cum;
    return parseFloat((peak - t.cum).toFixed(2));
  });
  const maxDD = Math.max(...pts, 0.01);
  const W = 560;
  const H = 128;
  const pad = { l: 36, r: 16, t: 10, b: 18 };
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const px = (i: number) =>
    pad.l + (i / Math.max(pts.length - 1, 1)) * iw;
  const py = (v: number) => pad.t + (v / maxDD) * ih;
  const poly = pts.map((v, i) => `${px(i)},${py(v)}`).join(" ");
  const fill = `${px(0)},${pad.t + ih} ${poly} ${px(pts.length - 1)},${pad.t + ih}`;

  return (
    <div style={{ padding: "12px 12px 8px" }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height={H}
        style={{ display: "block" }}
      >
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <line
            key={f}
            x1={pad.l}
            y1={pad.t + ih * f}
            x2={W - pad.r}
            y2={pad.t + ih * f}
            stroke={T.div}
            strokeWidth={1}
          />
        ))}
        <polygon points={fill} fill="rgba(255,82,82,0.08)" />
        <polyline
          points={poly}
          fill="none"
          stroke={T.red}
          strokeWidth={1.5}
          strokeLinejoin="round"
        />
        <text
          x={pad.l - 4}
          y={pad.t + 4}
          textAnchor="end"
          fontSize={9}
          fill={T.red}
          fontFamily={T.mono}
        >
          {`-${maxDD.toFixed(1)}R`}
        </text>
        <text
          x={pad.l - 4}
          y={pad.t + ih + 4}
          textAnchor="end"
          fontSize={9}
          fill={T.dim}
          fontFamily={T.mono}
        >
          0
        </text>
      </svg>
    </div>
  );
}
