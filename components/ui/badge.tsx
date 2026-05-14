import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type Variant =
  | "default"
  | "green"
  | "red"
  | "amber"
  | "blue"
  | "outline"
  | "muted"
  | "grade-aplus"
  | "grade-a"
  | "grade-b";

const variants: Record<Variant, string> = {
  default: "bg-bg-el-2 text-text border border-div",
  green: "bg-[rgba(0,212,154,0.08)] text-green border border-[rgba(0,212,154,0.25)]",
  red: "bg-[rgba(255,82,82,0.08)] text-red border border-[rgba(255,82,82,0.25)]",
  amber: "bg-[rgba(255,170,51,0.08)] text-amber border border-[rgba(255,170,51,0.25)]",
  blue: "bg-[rgba(91,138,248,0.08)] text-blue border border-[rgba(91,138,248,0.25)]",
  outline: "bg-transparent text-text border border-div",
  muted: "bg-transparent text-dim border border-transparent",
  "grade-aplus": "bg-[rgba(255,170,51,0.08)] text-amber border border-[rgba(255,170,51,0.25)]",
  "grade-a": "bg-transparent text-text border border-div",
  "grade-b": "bg-transparent text-muted border border-div",
};

export function Badge({
  variant = "default",
  className,
  children,
}: {
  variant?: Variant;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        // Terminal Pro: square corners, uppercase, tight letter-spacing
        "inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] tracking-[0.06em] uppercase",
        variants[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function GradeBadge({ grade }: { grade: string }) {
  const v: Variant =
    grade === "A+" ? "grade-aplus" : grade === "A" ? "grade-a" : "grade-b";
  return <Badge variant={v}>{grade}</Badge>;
}

export function DirectionBadge({ dir }: { dir: string }) {
  const long = dir === "long";
  return (
    <span
      className={cn(
        "inline-flex items-center text-[10px] tracking-[0.06em] uppercase",
        long ? "text-green" : "text-red",
      )}
    >
      {long ? "▲ LONG" : "▼ SHORT"}
    </span>
  );
}

const STATUS_LABELS: Record<string, string> = {
  pending: "PENDING",
  filled: "FILLED",
  tp1: "TP1",
  tp2: "TP2",
  tp3: "TP3",
  be_after_tp1: "BE",
  stopped: "STOPPED",
  expired: "EXPIRED",
};

export function StatusBadge({ status }: { status: string }) {
  const label = STATUS_LABELS[status] ?? status.toUpperCase();
  const cls =
    status === "stopped"
      ? "text-red"
      : ["tp1", "tp2", "tp3"].includes(status)
        ? "text-green"
        : status === "be_after_tp1"
          ? "text-dim"
          : status === "filled"
            ? "text-blue"
            : status === "pending"
              ? "text-muted"
              : "text-dim";
  return (
    <span className={cn("text-[10px] tracking-[0.06em]", cls)}>{label}</span>
  );
}
