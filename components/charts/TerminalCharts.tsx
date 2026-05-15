"use client";

import { T } from "@/lib/theme";

/* ─────────────────────────────────────────────────────────────────────────
   Terminal Pro charts — thin SVG lines on a dark background, no fills.
   The exact visual idiom from the Charts-v2.jsx prototype, recreated in
   typed React so the dashboard can drop Recharts.
   ───────────────────────────────────────────────────────────────────────── */

/* ── Equity curve (line) ────────────────────────────────────────────── */

export interface EquityPoint {
  ts: string;
  cumulative: number;
}

export function TerminalEquityCurve({
  points,
  height = 220,
  tickFormatter,
}: {
  points: EquityPoint[];
  height?: number;
  tickFormatter?: (ts: string) => string;
}) {
  if (!points || points.length === 0) {
    return (
      <div
        style={{ height }}
        className="flex items-center justify-center text-[12px] text-dim"
      >
        NO_DATA
      </div>
    );
  }
  // Prepend a synthetic 0 starting point so a single trade still draws a
  // proper line from baseline → outcome (instead of a lone dot).
  const series: EquityPoint[] =
    points[0].cumulative !== 0
      ? [{ ts: points[0].ts, cumulative: 0 }, ...points]
      : points;

  const vals = series.map((p) => p.cumulative);
  const rawMin = Math.min(0, ...vals);
  const rawMax = Math.max(0, ...vals);
  const rawRange = rawMax - rawMin || 1;
  // 10% breathing room so points never sit on the chart edge.
  const padFactor = 0.1;
  const min = rawMin - rawRange * padFactor;
  const max = rawMax + rawRange * padFactor;
  const range = max - min || 1;

  const W = 580;
  const H = height - 8;
  const pad = { l: 40, r: 56, t: 12, b: 22 };
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const px = (i: number) => pad.l + (i / (series.length - 1 || 1)) * iw;
  const py = (v: number) => pad.t + ih - ((v - min) / range) * ih;
  const zero = py(0);
  const polyPts = series.map((p, i) => `${px(i)},${py(p.cumulative)}`).join(" ");
  const last = vals[vals.length - 1];
  const col = last >= 0 ? T.green : T.red;

  // Build a small set of y-axis tick labels so users can read the scale.
  const ticks = (() => {
    const out = new Set<number>([0]);
    if (rawMax > 0) out.add(rawMax);
    if (rawMin < 0) out.add(rawMin);
    return Array.from(out).sort((a, b) => a - b);
  })();

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      height={H}
      preserveAspectRatio="none"
      style={{ display: "block" }}
    >
      {/* Horizontal gridlines */}
      {[0.25, 0.5, 0.75].map((f) => (
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
      {/* Zero baseline */}
      <line
        x1={pad.l}
        y1={zero}
        x2={W - pad.r}
        y2={zero}
        stroke={T.muted}
        strokeWidth={1}
        strokeDasharray="3 3"
      />
      <polyline
        points={polyPts}
        fill="none"
        stroke={col}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      <circle cx={px(series.length - 1)} cy={py(last)} r={3} fill={col} />
      <text
        x={px(series.length - 1) + 6}
        y={py(last) + 4}
        fontSize={9}
        fill={col}
        fontFamily={T.mono}
      >
        {(last > 0 ? "+" : "") + last.toFixed(1) + "R"}
      </text>
      {/* Y-axis tick labels (min / 0 / max) */}
      {ticks.map((t) => (
        <text
          key={t}
          x={pad.l - 6}
          y={py(t) + 3}
          textAnchor="end"
          fontSize={9}
          fill={T.dim}
          fontFamily={T.mono}
        >
          {t === 0 ? "0" : (t > 0 ? "+" : "") + t.toFixed(1) + "R"}
        </text>
      ))}
      {/* X-axis ticks */}
      {tickFormatter && series.length > 1 ? (
        <>
          <text
            x={pad.l}
            y={H - 6}
            fontSize={9}
            fill={T.dim}
            fontFamily={T.mono}
          >
            {tickFormatter(series[0].ts)}
          </text>
          <text
            x={W - pad.r}
            y={H - 6}
            textAnchor="end"
            fontSize={9}
            fill={T.dim}
            fontFamily={T.mono}
          >
            {tickFormatter(series[series.length - 1].ts)}
          </text>
        </>
      ) : null}
    </svg>
  );
}

/* ── Horizontal bar chart (by symbol / grade / recipe) ───────────────── */

export interface HBarRow {
  label: string;
  value: number; // R-outcome sum
}

export function TerminalHBar({ data }: { data: HBarRow[] }) {
  if (!data || data.length === 0) {
    return <div className="px-[18px] py-6 text-[12px] text-dim">NO_DATA</div>;
  }
  const max = Math.max(...data.map((d) => Math.abs(d.value)), 0.1);
  return (
    <div className="px-[18px] py-3 flex flex-col gap-2">
      {data.map((d) => {
        const positive = d.value >= 0;
        return (
          <div key={d.label} className="flex items-center gap-2.5 text-[11px]">
            <span className="w-[64px] text-right text-dim text-[10px] tracking-[0.04em] flex-shrink-0 uppercase truncate">
              {d.label}
            </span>
            <div className="flex-1 h-3.5 bg-bg-el-2 relative">
              <div
                style={{
                  width: `${(Math.abs(d.value) / max) * 100}%`,
                  background: positive
                    ? "rgba(0,212,154,0.3)"
                    : "rgba(255,82,82,0.3)",
                }}
                className="absolute inset-y-0 left-0"
              />
            </div>
            <span
              className={`w-[58px] text-right flex-shrink-0 ${
                positive ? "text-green" : "text-red"
              }`}
            >
              {(d.value > 0 ? "+" : "") + d.value.toFixed(1)}R
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ── R-outcome distribution histogram ────────────────────────────────── */

export function TerminalRDist({ values }: { values: number[] }) {
  if (!values || values.length === 0) {
    return (
      <div className="px-[18px] py-6 text-center text-[12px] text-dim">
        NO_DATA
      </div>
    );
  }
  const buckets = new Map<number, number>();
  for (const v of values) {
    const b = Math.round(v);
    buckets.set(b, (buckets.get(b) ?? 0) + 1);
  }
  const keys = Array.from(buckets.keys()).sort((a, b) => a - b);
  const maxC = Math.max(...Array.from(buckets.values()));
  const W = 500;
  const H = 140;
  const pad = { l: 20, r: 12, t: 8, b: 24 };
  const bw = (W - pad.l - pad.r) / keys.length;
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      height={H}
      preserveAspectRatio="none"
      style={{ display: "block" }}
    >
      <line
        x1={pad.l}
        y1={H - pad.b}
        x2={W - pad.r}
        y2={H - pad.b}
        stroke={T.div}
        strokeWidth={1}
      />
      {keys.map((k, i) => {
        const count = buckets.get(k) ?? 0;
        const bh = (count / maxC) * (H - pad.t - pad.b);
        const x = pad.l + i * bw + bw * 0.15;
        const col =
          k < 0
            ? "rgba(255,82,82,0.5)"
            : k === 0
              ? "rgba(102,102,102,0.4)"
              : "rgba(0,212,154,0.5)";
        return (
          <g key={k}>
            <rect
              x={x}
              y={H - pad.b - bh}
              width={bw * 0.7}
              height={bh}
              fill={col}
            />
            <text
              x={x + bw * 0.35}
              y={H - pad.b + 13}
              textAnchor="middle"
              fontSize={9}
              fill={T.dim}
              fontFamily={T.mono}
            >
              {k}R
            </text>
            {count > 0 ? (
              <text
                x={x + bw * 0.35}
                y={H - pad.b - bh - 3}
                textAnchor="middle"
                fontSize={9}
                fill={T.muted}
                fontFamily={T.mono}
              >
                {count}
              </text>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}

/* ── Hourly P&L bars (vertical, signed) ──────────────────────────────── */

export function TerminalHourly({
  data,
}: {
  data: { hour: number; r: number }[];
}) {
  if (!data || data.length === 0) {
    return (
      <div className="px-[18px] py-6 text-center text-[12px] text-dim">
        NO_DATA
      </div>
    );
  }
  const absMax = Math.max(...data.map((d) => Math.abs(d.r)), 0.1);
  const W = 560;
  const H = 140;
  const pad = { l: 28, r: 8, t: 8, b: 22 };
  const bw = (W - pad.l - pad.r) / data.length;
  const midY = pad.t + (H - pad.t - pad.b) / 2;
  const hLabel = (h: number) =>
    h === 0
      ? "12a"
      : h < 12
        ? `${h}a`
        : h === 12
          ? "12p"
          : `${h - 12}p`;
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      height={H}
      preserveAspectRatio="none"
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
      {data.map((d, i) => {
        const bh = (Math.abs(d.r) / absMax) * ((H - pad.t - pad.b) / 2 - 4);
        const x = pad.l + i * bw + bw * 0.15;
        const col = d.r >= 0 ? "rgba(0,212,154,0.45)" : "rgba(255,82,82,0.45)";
        return (
          <g key={d.hour}>
            {bh > 0 ? (
              <rect
                x={x}
                y={d.r >= 0 ? midY - bh : midY}
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
              {hLabel(d.hour)}
            </text>
            {d.r !== 0 ? (
              <text
                x={x + bw * 0.35}
                y={d.r >= 0 ? midY - bh - 3 : midY + bh + 11}
                textAnchor="middle"
                fontSize={9}
                fill={d.r >= 0 ? T.green : T.red}
                fontFamily={T.mono}
              >
                {(d.r > 0 ? "+" : "") + d.r.toFixed(1)}
              </text>
            ) : null}
          </g>
        );
      })}
      <text
        x={pad.l - 4}
        y={midY + 4}
        textAnchor="end"
        fontSize={9}
        fill={T.dim}
        fontFamily={T.mono}
      >
        0
      </text>
    </svg>
  );
}
