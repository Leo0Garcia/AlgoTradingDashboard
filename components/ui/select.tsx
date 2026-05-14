"use client";

import { cn } from "@/lib/utils";
import type { SelectHTMLAttributes } from "react";

export function Select({
  className,
  children,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...rest}
      className={cn(
        "h-8 rounded-md border border-zinc-700 bg-zinc-900 px-2 text-xs text-zinc-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-500",
        className,
      )}
    >
      {children}
    </select>
  );
}
