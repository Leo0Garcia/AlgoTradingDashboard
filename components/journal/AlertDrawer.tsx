"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
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
      {alert ? (
        <Content
          alert={alert}
          algoName={algoNameMap[alert.algorithm_id]}
          onClose={() => dialogRef.current?.close()}
        />
      ) : (
        <div className="p-6 text-[11px] text-dim">LOADING…</div>
      )}
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
      <div className="px-5 py-3 border-b border-div flex items-center justify-between sticky top-0 bg-bg-el">
        <div className="flex items-center gap-3">
          <span className="text-lg font-semibold text-bright">{alert.symbol}</span>
          <span
            className={`text-[10px] tracking-[0.06em] ${
              alert.direction === "long" ? "text-green" : "text-red"
            }`}
          >
            {alert.direction === "long" ? "▲ LONG" : "▼ SHORT"}
          </span>
          <span
            className={`text-[10px] font-semibold ${
              alert.grade === "A+"
                ? "text-amber"
                : alert.grade === "A"
                  ? "text-text"
                  : "text-muted"
            }`}
          >
            {alert.grade}
          </span>
          <StatusBadge status={alert.status} />
        </div>
        <Button size="sm" variant="ghost" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-auto p-5 space-y-5">
        <section>
          <H>Algorithm</H>
          <div className="text-[12px] text-text uppercase tracking-[0.04em]">
            {algoName ?? alert.algorithm_id}
          </div>
          <div className="text-[10px] text-dim mt-0.5">
            EXT_ID {alert.external_id} · {fmtDateTime(alert.received_at)}
          </div>
        </section>

        <section className="grid grid-cols-4 gap-2">
          <Stat label="ENTRY" value={`${fmtNum(alert.entry_lo)} – ${fmtNum(alert.entry_hi)}`} />
          <Stat label="STOP" value={fmtNum(alert.stop)} tone="red" />
          <Stat label="TP1" value={fmtNum(alert.tp1)} tone="green" />
          <Stat label="TP2" value={fmtNum(alert.tp2)} tone="green" />
          <Stat label="TP3" value={fmtNum(alert.tp3)} tone="green" />
          <Stat label="FILL" value={fmtNum(alert.fill_px)} />
          <Stat label="EXIT" value={fmtNum(alert.exit_px)} />
          <Stat
            label="R OUTCOME"
            value={alert.r_outcome == null ? "—" : `${alert.r_outcome.toFixed(2)}R`}
            tone={(alert.r_outcome ?? 0) >= 0 ? "green" : "red"}
          />
        </section>

        {alert.recipe ? (
          <section>
            <H>Recipe</H>
            <div className="text-[12px] text-text">{alert.recipe}</div>
          </section>
        ) : null}

        {alert.confluences && alert.confluences.length > 0 ? (
          <section>
            <H>Confluences</H>
            <div className="flex flex-wrap gap-1.5">
              {alert.confluences.map((c) => (
                <span
                  key={c}
                  className="px-1.5 py-0.5 border border-div text-text text-[10px] uppercase tracking-[0.06em]"
                >
                  {c}
                </span>
              ))}
            </div>
          </section>
        ) : null}

        {alert.rationale ? (
          <section>
            <H>Rationale</H>
            <p className="text-[12px] text-text whitespace-pre-wrap leading-relaxed">
              {alert.rationale}
            </p>
          </section>
        ) : null}

        {alert.llm_decision ? (
          <section>
            <H>LLM review</H>
            <div className="border border-div bg-bg-el-2 p-3 space-y-1.5">
              <div className="flex items-center gap-2 text-[10px] tracking-[0.06em] uppercase">
                <span
                  className={
                    alert.llm_decision.decision === "approve"
                      ? "text-green"
                      : "text-red"
                  }
                >
                  ▸ {alert.llm_decision.decision}
                </span>
                <span className="text-dim">
                  · {alert.llm_decision.confidence} CONFIDENCE
                </span>
              </div>
              <div className="text-[12px] text-text whitespace-pre-wrap">
                {alert.llm_decision.reason}
              </div>
            </div>
          </section>
        ) : null}

        <section>
          <H>Lifecycle</H>
          <div className="text-[11px] text-dim space-y-0.5 uppercase tracking-[0.04em]">
            <div>RECEIVED {fmtDateTime(alert.received_at)}</div>
            <div>FILLED {alert.fill_ts ? fmtDateTime(alert.fill_ts) : "—"}</div>
            <div>EXITED {alert.exit_ts ? fmtDateTime(alert.exit_ts) : "—"}</div>
            <div>OUTCOME {fmtR(alert.r_outcome)}</div>
          </div>
        </section>
      </div>
    </div>
  );
}

function H({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[9px] tracking-[0.1em] text-green uppercase mb-1.5">
      ▸ {children}
    </h3>
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
    tone === "red" ? "text-red" : tone === "green" ? "text-green" : "text-bright";
  return (
    <div className="bg-bg-el-2 px-3 py-2">
      <div className={`text-[13px] font-medium ${cls}`}>{value}</div>
      <div className="text-[9px] tracking-[0.1em] text-dim uppercase mt-0.5">
        {label}
      </div>
    </div>
  );
}
