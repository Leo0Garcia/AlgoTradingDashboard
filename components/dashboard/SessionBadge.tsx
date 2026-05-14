"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Moon, Sun } from "lucide-react";
import type { SessionState } from "@/lib/types";

const SESSION_LABELS: Record<string, string> = {
  london: "London",
  ny: "NY",
  newyork: "NY",
  ny_open: "NY open",
  ny_close: "NY close",
  asia: "Asia",
  tokyo: "Tokyo",
  outside: "Outside session",
};

function labelFor(name: string | undefined | null): string {
  if (!name) return "—";
  return SESSION_LABELS[name.toLowerCase()] ?? prettyCase(name);
}

function prettyCase(s: string): string {
  return s
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function fmtDuration(ms: number): string {
  if (ms <= 0) return "now";
  const sec = Math.floor(ms / 1000);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export function SessionBadge({
  session,
  compact = false,
}: {
  session: SessionState | null;
  compact?: boolean;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (session?.active) return;
    if (!session?.next_window_start_unix) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [session?.active, session?.next_window_start_unix]);

  if (!session) {
    return compact ? null : (
      <Badge variant="muted">No session data</Badge>
    );
  }

  if (session.active) {
    return (
      <Badge variant="green">
        <Sun className="h-3 w-3" />
        {labelFor(session.name)} session
      </Badge>
    );
  }

  const next = session.next_window_start_unix
    ? session.next_window_start_unix * 1000
    : null;
  const remaining = next ? next - now : null;
  const nextLabel = labelFor(session.next_window_name ?? null);
  const nextStr =
    next && remaining !== null
      ? `${nextLabel === "—" ? "next session" : `${nextLabel} open`} in ${fmtDuration(remaining)}`
      : null;

  return (
    <span className="inline-flex items-center gap-1.5">
      <Badge variant="amber">
        <Moon className="h-3 w-3" />
        Outside session
      </Badge>
      {!compact && nextStr ? (
        <span className="text-[10px] text-zinc-500 num">{nextStr}</span>
      ) : null}
    </span>
  );
}

export function SessionBanner({
  algoName,
  session,
}: {
  algoName: string;
  session: SessionState | null;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (session?.active || !session?.next_window_start_unix) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [session?.active, session?.next_window_start_unix]);

  if (!session || session.active) return null;
  const next = session.next_window_start_unix
    ? session.next_window_start_unix * 1000
    : null;
  const nextLabel = labelFor(session.next_window_name ?? null);
  const remaining = next ? next - now : null;

  return (
    <div className="rounded-md border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-100/80 flex items-center gap-2">
      <Moon className="h-3.5 w-3.5 text-amber-400 shrink-0" />
      <div className="leading-relaxed">
        <span className="text-zinc-200 font-medium">{algoName}</span> is paused — outside trading
        session.{" "}
        {next ? (
          <>
            Next:{" "}
            <span className="text-zinc-200">
              {nextLabel === "—" ? "session" : `${nextLabel} open`}
            </span>{" "}
            at{" "}
            <span className="num text-zinc-200">
              {new Date(next).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
            {remaining !== null ? (
              <>
                {" "}
                <span className="text-zinc-400">(in {fmtDuration(remaining)})</span>
              </>
            ) : null}
            .
          </>
        ) : (
          <>Next window unknown.</>
        )}
      </div>
    </div>
  );
}
