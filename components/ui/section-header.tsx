import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function SectionHeader({
  title,
  right,
  border = true,
  className,
}: {
  title: ReactNode;
  right?: ReactNode;
  border?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "px-[18px] py-2 flex items-center justify-between flex-shrink-0",
        border ? "border-b border-div" : "",
        className,
      )}
    >
      <span className="text-green text-[10px] tracking-[0.1em] uppercase">
        ▸ {title}
      </span>
      {right ? (
        <span className="text-dim text-[10px]">{right}</span>
      ) : null}
    </div>
  );
}
