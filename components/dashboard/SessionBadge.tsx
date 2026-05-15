"use client";

import { useEffect, useState } from "react";
import type { SessionState } from "@/lib/types";

const SESSION_LABELS: Record<string, string> = {
  london: "LONDON",
  ny: "NY",
  newyork: "NY",
  ny_open: "NY OPEN",
  ny_close: "NY CLOSE",
  asia: "ASIA",
  tokyo: "TOKYO",
  outside: "OUTSIDE",
};

function labelFor(name: string | undefined | null): string {
  if (!name) return "—";
  return SESSION_LABELS[name.toLowerCase()] ?? name.toUpperCase().replace(/_/g, " ");
}

function fmtDuration(ms: number): string {
  if (ms <= 0) return "NOW";
  const sec = Math.floor(ms / 1000);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}H ${m}M`;
  if (m > 0) return `${m}M ${s}S`;
  return `${s}S`;
}

function useCountdown(unixSeconds: number | null | undefined, run: boolean): number | null {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!run) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [run]);
  if (!unixSeconds) return null;
  return unixSeconds * 1000 - now;
}

/** Inline session badge used in the algo status row. ☼ LONDON / ☾ OUTSIDE. */
export function SessionInline({ session }: { session: SessionState | null }) {
  const remaining = useCountdown(
    session?.next_window_start_unix,
    !!session && !session.active,
  );
  if (!session) return null;
  if (session.active) {
    return (
      <span className="text-green text-[10px] tracking-[0.06em]">
        ☼ {labelFor(session.name)} SESSION
      </span>
    );
  }
  const nextLabel = labelFor(session.next_window_name ?? null);
  return (
    <span className="inline-flex items-center gap-2">
      <span className="text-amber text-[10px] tracking-[0.06em]">☾ OUTSIDE</span>
      {remaining !== null ? (
        <span className="text-dim text-[10px]">
          {nextLabel !== "—" ? `${nextLabel} ` : ""}IN {fmtDuration(remaining)}
        </span>
      ) : null}
    </span>
  );
}

/** Tiny compact badge for table cells. */
export function SessionBadge({
  session,
  compact = false,
}: {
  session: SessionState | null;
  compact?: boolean;
}) {
  void compact;
  return <SessionInline session={session} />;
}

export function SessionBanner({
  algoName,
  session,
}: {
  algoName: string;
  session: SessionState | null;
}) {
  const remaining = useCountdown(
    session?.next_window_start_unix,
    !!session && !session.active,
  );
  if (!session || session.active) return null;
  const next = session.next_window_start_unix
    ? session.next_window_start_unix * 1000
    : null;
  const nextLabel = labelFor(session.next_window_name ?? null);

  return (
    <div className="bg-bg-el border-l-[3px] border-l-amber px-[18px] py-5 flex items-center gap-3 text-[11px]">
      <span className="text-amber text-[12px]">☾</span>
      <div className="leading-relaxed text-text">
        <span className="text-bright">{algoName.toUpperCase()}</span> PAUSED —
        OUTSIDE TRADING SESSION
        {next ? (
          <>
            {" · "}NEXT:{" "}
            <span className="text-bright">
              {nextLabel !== "—" ? `${nextLabel} OPEN` : "SESSION"}
            </span>{" "}
            AT{" "}
            <span className="text-bright">
              {new Date(next).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
            {remaining !== null ? (
              <>
                {" "}<span className="text-dim">(IN {fmtDuration(remaining)})</span>
              </>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}
