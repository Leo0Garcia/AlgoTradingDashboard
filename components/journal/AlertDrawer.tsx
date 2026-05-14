"use client";

import { useEffect, useRef, useState } from "react";
import { Badge, DirectionBadge, GradeBadge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { fmtDateTime, fmtNum, fmtR } from "@/lib/utils";
import { X } from "lucide-react";
import type { Alert } from "@/lib/types";

interface Props {
  alertId: number | null;
  algoNameMap: Record<string, string>;
  onClose: () => void;
}

export function AlertDrawer({ alertId, algoNameMap, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [alert, setAlert] = useState<Alert | null>(null);

  useEffect(() => {
    if (alertId === null) {
      dialogRef.current?.close();
      setAlert(null);
      return;
    }
    fetch(`/api/v1/alerts/${alertId}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => setAlert(j.alert ?? null))
      .catch(() => setAlert(null));
    if (dialogRef.current && !dialogRef.current.open) {
      dialogRef.current.showModal();
    }
  }, [alertId]);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    const handle = () => onClose();
    el.addEventListener("close", handle);
    return () => el.removeEventListener("close", handle);
  }, [onClose]);

  return (
    <dialog ref={dialogRef} className="drawer">
      {alert ? <Content alert={alert} algoName={algoNameMap[alert.algorithm_id]} onClose={() => dialogRef.current?.close()} /> : <div className="p-6 text-sm text-zinc-500">Loading…</div>}
    </dialog>
  );
}

function Content({
  alert,
  algoName,
  onClose,
}: {
  alert: Alert;
  algoName?: string;
  onClose: () => void;
}) {
  return (
    <div className="flex flex-col h-full">
      <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between sticky top-0 bg-zinc-950/95 backdrop-blur">
        <div className="flex items-center gap-3">
          <span className="num text-lg font-semibold">{alert.symbol}</span>
          <DirectionBadge dir={alert.direction} />
          <GradeBadge grade={alert.grade} />
          <StatusBadge status={alert.status} />
        </div>
        <Button size="sm" variant="ghost" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-auto p-5 space-y-5">
        <section>
          <H>Algorithm</H>
          <div className="text-sm text-zinc-300">{algoName ?? alert.algorithm_id}</div>
          <div className="num text-xs text-zinc-500 mt-0.5">
            External ID {alert.external_id} · {fmtDateTime(alert.received_at)}
          </div>
        </section>

        <section className="grid grid-cols-4 gap-2">
          <Stat label="Entry" value={`${fmtNum(alert.entry_lo)} – ${fmtNum(alert.entry_hi)}`} />
          <Stat label="Stop" value={fmtNum(alert.stop)} tone="red" />
          <Stat label="TP1" value={fmtNum(alert.tp1)} tone="green" />
          <Stat label="TP2" value={fmtNum(alert.tp2)} tone="green" />
          <Stat label="TP3" value={fmtNum(alert.tp3)} tone="green" />
          <Stat label="Fill" value={fmtNum(alert.fill_px)} />
          <Stat label="Exit" value={fmtNum(alert.exit_px)} />
          <Stat
            label="R outcome"
            value={alert.r_outcome == null ? "—" : `${alert.r_outcome.toFixed(2)}R`}
            tone={(alert.r_outcome ?? 0) >= 0 ? "green" : "red"}
          />
        </section>

        {alert.recipe ? (
          <section>
            <H>Recipe</H>
            <div className="text-sm text-zinc-300">{alert.recipe}</div>
          </section>
        ) : null}

        {alert.confluences && alert.confluences.length > 0 ? (
          <section>
            <H>Confluences</H>
            <div className="flex flex-wrap gap-1.5">
              {alert.confluences.map((c) => (
                <Badge key={c} variant="outline">
                  {c}
                </Badge>
              ))}
            </div>
          </section>
        ) : null}

        {alert.rationale ? (
          <section>
            <H>Rationale</H>
            <p className="text-sm text-zinc-300 whitespace-pre-wrap leading-relaxed">
              {alert.rationale}
            </p>
          </section>
        ) : null}

        {alert.llm_decision ? (
          <section>
            <H>LLM review</H>
            <div className="rounded-md border border-zinc-800 bg-zinc-900/40 p-3 space-y-1.5">
              <div className="flex items-center gap-2">
                <Badge
                  variant={alert.llm_decision.decision === "approve" ? "green" : "red"}
                >
                  <span className="capitalize">{alert.llm_decision.decision}</span>
                </Badge>
                <Badge variant="muted">
                  <span className="capitalize">{alert.llm_decision.confidence} confidence</span>
                </Badge>
              </div>
              <div className="text-sm text-zinc-300 whitespace-pre-wrap">
                {alert.llm_decision.reason}
              </div>
            </div>
          </section>
        ) : null}

        <section>
          <H>Lifecycle</H>
          <div className="text-xs text-zinc-400 space-y-0.5">
            <div>Received {fmtDateTime(alert.received_at)}</div>
            <div>Filled {alert.fill_ts ? fmtDateTime(alert.fill_ts) : "—"}</div>
            <div>Exited {alert.exit_ts ? fmtDateTime(alert.exit_ts) : "—"}</div>
            <div>Outcome {fmtR(alert.r_outcome)}</div>
          </div>
        </section>
      </div>
    </div>
  );
}

function H({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1.5">{children}</h3>
  );
}

function Stat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "red" | "green";
}) {
  const cls =
    tone === "red"
      ? "text-red-400"
      : tone === "green"
        ? "text-green-400"
        : "text-zinc-100";
  return (
    <div className="rounded-md bg-zinc-900/60 px-3 py-2">
      <div className={`num text-sm font-medium ${cls}`}>{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</div>
    </div>
  );
}
