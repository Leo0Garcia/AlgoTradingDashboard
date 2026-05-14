import { cn } from "@/lib/utils";
import type { ReactNode } from "react";
import { SectionHeader } from "./section-header";

/**
 * Terminal Pro "panel". No border, no radius. The panel separates itself from
 * the page background by being elevated to var(--bg-el).
 */
export function Card({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <div className={cn("bg-bg-el", className)}>{children}</div>;
}

/** Backwards-compatible header shim using the new SectionHeader. */
export function CardHeader({
  className,
  title,
  subtitle,
  right,
}: {
  className?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  right?: ReactNode;
}) {
  const rightSlot = right ?? (subtitle ? subtitle : undefined);
  return <SectionHeader title={title} right={rightSlot} className={className} />;
}

export function CardBody({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <div className={cn("px-[18px] py-3", className)}>{children}</div>;
}
