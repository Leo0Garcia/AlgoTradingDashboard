"use client";

import { cn } from "@/lib/utils";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "default" | "ghost" | "outline" | "danger" | "primary";
type Size = "sm" | "md";

const variants: Record<Variant, string> = {
  default:
    "bg-zinc-800 text-zinc-100 hover:bg-zinc-700 active:bg-zinc-700/80 border border-zinc-700",
  primary:
    "bg-zinc-100 text-zinc-900 hover:bg-white border border-zinc-200",
  ghost:
    "bg-transparent text-zinc-300 hover:bg-zinc-800/60 border border-transparent",
  outline:
    "bg-transparent text-zinc-200 hover:bg-zinc-800/60 border border-zinc-700",
  danger:
    "bg-red-500/15 text-red-300 hover:bg-red-500/25 border border-red-500/30",
};

const sizes: Record<Size, string> = {
  sm: "h-7 px-2.5 text-xs gap-1.5",
  md: "h-9 px-3 text-sm gap-2",
};

export function Button({
  variant = "default",
  size = "md",
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
}) {
  return (
    <button
      {...rest}
      className={cn(
        "inline-flex items-center justify-center rounded-md font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-500",
        variants[variant],
        sizes[size],
        className,
      )}
    >
      {children}
    </button>
  );
}
