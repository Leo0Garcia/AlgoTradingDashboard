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
        "h-7 bg-bg-el-2 border border-div text-text px-2 text-[11px] cursor-pointer",
        "focus-visible:outline-none focus-visible:border-muted",
        className,
      )}
    >
      {children}
    </select>
  );
}
