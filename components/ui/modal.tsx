"use client";

import { useEffect } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export function Modal({
  title,
  children,
  onClose,
  size = "sm",
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  size?: "sm" | "md";
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={cn(
          "w-full rounded-lg border border-zinc-800 bg-zinc-950 shadow-xl",
          size === "sm" ? "max-w-md" : "max-w-lg",
        )}
      >
        <div className="px-4 py-3 border-b border-zinc-800 text-sm font-semibold text-zinc-100">
          {title}
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "confirm",
  cancelLabel = "cancel",
  tone = "default",
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "default" | "danger";
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <Modal title={title} onClose={onCancel}>
      <div className="text-sm text-zinc-300 leading-relaxed">{message}</div>
      <div className="flex justify-end gap-2 mt-4">
        <Button size="sm" variant="ghost" onClick={onCancel}>
          {cancelLabel}
        </Button>
        <Button
          size="sm"
          variant={tone === "danger" ? "danger" : "primary"}
          onClick={onConfirm}
        >
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
