import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function Card({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border border-zinc-800 bg-zinc-950/40",
        className,
      )}
    >
      {children}
    </div>
  );
}

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
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-2 border-b border-zinc-800 px-4 py-3",
        className,
      )}
    >
      <div className="min-w-0">
        <div className="text-sm font-semibold text-zinc-100">{title}</div>
        {subtitle ? (
          <div className="text-xs text-zinc-500">{subtitle}</div>
        ) : null}
      </div>
      {right}
    </div>
  );
}

export function CardBody({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <div className={cn("p-4", className)}>{children}</div>;
}
