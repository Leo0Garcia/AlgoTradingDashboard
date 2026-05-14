"use client";

import { cn } from "@/lib/utils";
import type { InputHTMLAttributes } from "react";

export function Input({
  className,
  ...rest
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...rest}
      className={cn(
        "h-7 bg-bg-el-2 border border-div text-text px-2 text-[11px]",
        "placeholder:text-dim",
        "focus-visible:outline-none focus-visible:border-muted",
        className,
      )}
    />
  );
}
