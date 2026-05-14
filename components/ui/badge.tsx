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
  default: "bg-zinc-800 text-zinc-100",
  green: "bg-green-500/10 text-green-400 ring-1 ring-inset ring-green-500/20",
  red: "bg-red-500/10 text-red-400 ring-1 ring-inset ring-red-500/20",
  amber: "bg-amber-500/10 text-amber-400 ring-1 ring-inset ring-amber-500/20",
  blue: "bg-blue-500/10 text-blue-400 ring-1 ring-inset ring-blue-500/20",
  outline: "border border-zinc-700 text-zinc-300",
  muted: "bg-zinc-800/60 text-zinc-400",
  "grade-aplus": "bg-emerald-500/15 text-emerald-300 ring-1 ring-inset ring-emerald-500/25",
  "grade-a": "bg-cyan-500/15 text-cyan-300 ring-1 ring-inset ring-cyan-500/25",
  "grade-b": "bg-zinc-700/40 text-zinc-300 ring-1 ring-inset ring-zinc-600/40",
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
        "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium",
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
  return (
    <Badge variant={dir === "long" ? "green" : "red"}>{dir.toUpperCase()}</Badge>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const win = ["tp1", "tp2", "tp3", "be_after_tp1"].includes(status);
  const lose = status === "stopped";
  const v: Variant = win ? "green" : lose ? "red" : status === "filled" ? "blue" : "muted";
  return <Badge variant={v}>{status}</Badge>;
}
