"use client";

import { cn } from "@/lib/utils";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "default" | "ghost" | "outline" | "danger" | "primary";
type Size = "sm" | "md";

const variants: Record<Variant, string> = {
  // hairline outline; muted text; brightens on hover
  default:
    "bg-bg-el-2 border border-div text-text hover:text-bright hover:border-muted",
  // green = brand / active = primary CTA
  primary:
    "bg-bg-el-2 border border-green text-green hover:bg-[rgba(0,212,154,0.07)]",
  ghost:
    "bg-transparent border border-transparent text-dim hover:text-text hover:border-div",
  outline:
    "bg-transparent border border-div text-text hover:text-bright hover:border-muted",
  danger:
    "bg-[rgba(255,82,82,0.07)] border border-[rgba(255,82,82,0.3)] text-red hover:bg-[rgba(255,82,82,0.14)]",
};

const sizes: Record<Size, string> = {
  sm: "h-[26px] px-2.5 text-[10px] tracking-[0.06em] gap-1.5",
  md: "h-7 px-3 text-[10px] tracking-[0.08em] gap-2",
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
        "inline-flex items-center justify-center uppercase transition-colors",
        "disabled:opacity-40 disabled:cursor-not-allowed",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-muted",
        "cursor-pointer",
        variants[variant],
        sizes[size],
        className,
      )}
    >
      {children}
    </button>
  );
}
