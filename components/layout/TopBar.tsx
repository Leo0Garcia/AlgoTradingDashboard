"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useStream } from "@/hooks/useStream";

const PAGES = [
  { href: "/", label: "LIVE" },
  { href: "/journal", label: "JOURNAL" },
  { href: "/analytics", label: "ANALYTICS" },
  { href: "/backtest", label: "BACKTEST" },
  { href: "/algos", label: "ALGORITHMS" },
];

function pad2(n: number) {
  return String(n).padStart(2, "0");
}
function fmtClock(d: Date) {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

export function TopBar() {
  const pathname = usePathname();
  const { connected, lastEventAt } = useStream();
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <header className="h-11 border-b border-div flex items-stretch pl-6 flex-shrink-0">
      <Link
        href="/"
        className="flex items-center gap-2.5 pr-8 border-r border-div"
      >
        <span className="text-green text-[15px] leading-none">◈</span>
        <span className="text-bright font-semibold tracking-[0.05em] text-[13px]">
          ALGOMANAGER
        </span>
        <span className="text-dim text-[11px]">/</span>
        <span className="text-dim text-[10px] tracking-[0.06em]">CMD</span>
      </Link>

      <nav className="flex items-stretch">
        {PAGES.map((p) => {
          const active = isActive(p.href);
          return (
            <Link
              key={p.href}
              href={p.href}
              className={[
                "flex items-center px-4 text-[10px] tracking-[0.1em] uppercase border-b-2 border-transparent transition-colors",
                active
                  ? "text-green border-b-green"
                  : "text-dim hover:text-text",
              ].join(" ")}
            >
              {p.label}
            </Link>
          );
        })}
      </nav>

      <div className="ml-auto flex items-center gap-5 pr-6 text-[10px] tracking-[0.04em]">
        <span className="flex items-center gap-1.5">
          <span
            className={`pulse-dot ${connected ? "" : "stopped"} !w-1.5 !h-1.5`}
            aria-hidden
          />
          <span className={connected ? "text-green" : "text-dim"}>
            {connected ? "STREAM_LIVE" : "STREAM_OFFLINE"}
          </span>
        </span>
        <span className="text-[#333]">
          LAST_EVT{" "}
          {lastEventAt
            ? fmtClock(new Date(lastEventAt))
            : "—:—:—"}
        </span>
        <span className="text-muted">{now ? fmtClock(now) : "—:—:—"}</span>
      </div>
    </header>
  );
}
