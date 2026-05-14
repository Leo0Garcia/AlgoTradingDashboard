"use client";

import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { SectionHeader } from "@/components/ui/section-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { fmtR } from "@/lib/utils";
import { Modal, ConfirmDialog } from "@/components/ui/modal";
import { SessionInline } from "@/components/dashboard/SessionBadge";
import type { SessionState } from "@/lib/types";

interface AlgorithmEntry {
  id: string;
  name: string;
  type: string;
  description: string | null;
  status: "running" | "stopped" | "errored";
  last_heartbeat: string | null;
  symbols: string[];
  launch_cmd: string | null;
  db_path: string | null;
  enabled: boolean;
  account_id: string | null;
  last_session: SessionState | null;
  stats_today: {
    total_alerts: number;
    approved_count: number;
    wins: number;
    losses: number;
    r_sum: number;
  };
}

interface Subscriber {
  id: number;
  chat_id: string;
  name: string | null;
  enabled: boolean;
}

interface TelegramTestResult {
  chat_id: string;
  ok: boolean;
  status?: number;
  description?: string;
  hint?: string;
}

interface DiscoveredChat {
  chat_id: string;
  type: string;
  title: string;
}

type DiscoverResult =
  | { ok: true; chats: DiscoveredChat[] }
  | { ok: false; description: string; hint?: string };

function hbAgo(iso: string | null): string {
  if (!iso) return "—";
  const sec = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  return `${Math.floor(sec / 3600)}h ago`;
}

export function AlgosView() {
  const [algos, setAlgos] = useState<AlgorithmEntry[]>([]);
  const [subs, setSubs] = useState<Subscriber[]>([]);
  const [showRegister, setShowRegister] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [revealedToken, setRevealedToken] = useState<{
    algorithm_id: string;
    api_token: string;
  } | null>(null);
  const [telegramResult, setTelegramResult] = useState<TelegramTestResult[] | null>(null);
  const [discovering, setDiscovering] = useState(false);
  const [discovered, setDiscovered] = useState<DiscoverResult | null>(null);
  const [regenTarget, setRegenTarget] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [a, s] = await Promise.all([
      fetch("/api/v1/algorithms", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/v1/telegram/subscribers", { cache: "no-store" }).then((r) =>
        r.json(),
      ),
    ]);
    setAlgos(a.algorithms ?? []);
    setSubs(s.subscribers ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const control = async (id: string, action: "start" | "stop") => {
    await fetch(`/api/v1/algorithms/${id}/control`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action }),
    });
    load();
  };

  const testTelegram = async () => {
    setTelegramResult(null);
    const r = await fetch("/api/v1/telegram/test");
    const j = await r.json();
    setTelegramResult(j.results ?? []);
  };

  const findChatId = async () => {
    setDiscovering(true);
    setDiscovered(null);
    try {
      const r = await fetch("/api/v1/telegram/whoami");
      const j = (await r.json()) as DiscoverResult;
      setDiscovered(j);
    } finally {
      setDiscovering(false);
    }
  };

  const addDiscoveredSubscriber = async (chat: DiscoveredChat) => {
    await fetch("/api/v1/telegram/subscribers", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chat.chat_id, name: chat.title }),
    });
    load();
  };

  const regenToken = async (id: string) => {
    const r = await fetch(`/api/v1/algorithms/${id}/token`, { method: "POST" });
    const j = await r.json();
    setRevealedToken(j);
  };

  const editing = algos.find((a) => a.id === editingId) ?? null;
  const deleting = algos.find((a) => a.id === deletingId) ?? null;

  return (
    <div className="px-6 py-[18px] flex flex-col gap-3.5">
      <Card>
        <div className="px-[18px] py-2 border-b border-div flex items-center justify-between">
          <span className="text-green text-[10px] tracking-[0.1em] uppercase">
            ▸ ALGORITHMS
          </span>
          <div className="flex items-center gap-3">
            <span className="text-dim text-[10px]">
              Registered traders sending events to this dashboard
            </span>
            <Button size="sm" variant="primary" onClick={() => setShowRegister((v) => !v)}>
              + REGISTER
            </Button>
          </div>
        </div>
        {showRegister ? (
          <RegisterForm
            onDone={(token) => {
              setShowRegister(false);
              if (token) setRevealedToken(token);
              load();
            }}
          />
        ) : null}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[11px]">
            <thead>
              <tr>
                <Th>NAME</Th>
                <Th>TYPE</Th>
                <Th>STATUS</Th>
                <Th>SESSION</Th>
                <Th>HEARTBEAT</Th>
                <Th>SYMBOLS</Th>
                <Th right>ALERTS TODAY</Th>
                <Th right>W / L</Th>
                <Th right>Σ R</Th>
                <Th right>ACTIONS</Th>
              </tr>
            </thead>
            <tbody>
              {algos.length === 0 ? (
                <tr>
                  <td
                    colSpan={10}
                    className="px-10 py-8 text-center text-[11px] text-dim"
                  >
                    NO_ALGORITHMS_REGISTERED
                  </td>
                </tr>
              ) : (
                algos.map((a) => (
                  <tr key={a.id} className="row-hover">
                    <Td>
                      <div className="text-bright font-semibold text-[13px] uppercase">
                        {a.name}
                      </div>
                      <div className="text-dim text-[9px] mt-0.5 tracking-[0.04em]">
                        {a.id}
                      </div>
                    </Td>
                    <Td>
                      <span className="text-muted text-[10px] tracking-[0.06em] uppercase">
                        {a.type}
                      </span>
                    </Td>
                    <Td>
                      <span className="inline-flex items-center gap-1.5">
                        <span className={`pulse-dot ${a.status}`} />
                        <span className="text-bright text-[10px] tracking-[0.06em] uppercase">
                          {a.status}
                        </span>
                      </span>
                    </Td>
                    <Td>
                      <SessionInline session={a.last_session} />
                    </Td>
                    <Td>
                      <span className="text-text">{hbAgo(a.last_heartbeat)}</span>
                    </Td>
                    <Td>
                      <span className="text-text">{a.symbols.join(" · ")}</span>
                    </Td>
                    <Td right>
                      <span className="text-bright">{a.stats_today.total_alerts}</span>
                    </Td>
                    <Td right>
                      <span className="text-text">
                        {a.stats_today.wins} / {a.stats_today.losses}
                      </span>
                    </Td>
                    <Td right>
                      <span
                        className={`font-semibold ${
                          a.stats_today.r_sum >= 0 ? "text-green" : "text-red"
                        }`}
                      >
                        {fmtR(a.stats_today.r_sum)}
                      </span>
                    </Td>
                    <Td right>
                      <div className="inline-flex gap-1.5">
                        {a.status === "running" ? (
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => control(a.id, "stop")}
                          >
                            ■ STOP
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={!a.launch_cmd}
                            title={a.launch_cmd ?? "No launch command configured"}
                            onClick={() => control(a.id, "start")}
                          >
                            ▶ START
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => setEditingId(a.id)}>
                          EDIT
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setRegenTarget(a.id)}>
                          KEY
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setDeletingId(a.id)}
                          className="!text-red hover:!text-red hover:!border-[rgba(255,82,82,0.3)]"
                        >
                          DEL
                        </Button>
                      </div>
                    </Td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <div className="px-[18px] py-2 border-b border-div flex items-center justify-between">
          <span className="text-green text-[10px] tracking-[0.1em] uppercase">
            ▸ TELEGRAM SUBSCRIBERS
          </span>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={findChatId} disabled={discovering}>
              {discovering ? "LOOKING…" : "FIND MY CHAT ID"}
            </Button>
            <Button size="sm" variant="outline" onClick={testTelegram}>
              SEND TEST
            </Button>
          </div>
        </div>

        <div className="px-[18px] py-2.5 border-b border-div text-[11px] text-dim bg-bg-el-2/60">
          <span className="text-bright">FIRST TIME?</span> Telegram bots can&apos;t
          DM you until you message them at least once. Open Telegram, find your
          bot, press Start (or send &quot;hi&quot;), then click{" "}
          <span className="text-bright">FIND MY CHAT ID</span> to auto-discover.
        </div>

        {telegramResult ? (
          <div className="px-[18px] py-3 border-b border-div space-y-2">
            {telegramResult.map((r) => (
              <div
                key={r.chat_id}
                className={`text-[11px] border p-2.5 ${
                  r.ok
                    ? "border-[rgba(0,212,154,0.25)] bg-[rgba(0,212,154,0.05)]"
                    : "border-[rgba(255,82,82,0.25)] bg-[rgba(255,82,82,0.05)]"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[10px] tracking-[0.06em] ${
                      r.ok ? "text-green" : "text-red"
                    }`}
                  >
                    {r.ok ? "● DELIVERED" : "○ FAILED"}
                  </span>
                  <span className="text-text">{r.chat_id}</span>
                  {r.status ? (
                    <span className="text-dim">HTTP {r.status}</span>
                  ) : null}
                </div>
                {r.description ? (
                  <div className="mt-1.5 text-text">{r.description}</div>
                ) : null}
                {r.hint ? (
                  <div className="mt-1.5 text-dim">▸ {r.hint}</div>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}

        {discovered ? (
          <ChatDiscoveryPanel
            result={discovered}
            onAdd={addDiscoveredSubscriber}
            onClose={() => setDiscovered(null)}
          />
        ) : null}

        <SubscriberForm onAdded={load} />

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[11px]">
            <thead>
              <tr>
                <Th>CHAT ID</Th>
                <Th>NAME</Th>
                <Th>STATUS</Th>
                <Th>FILTER</Th>
              </tr>
            </thead>
            <tbody>
              {subs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-10 py-8 text-center text-[11px] text-dim">
                    NO_TELEGRAM_CHATS
                  </td>
                </tr>
              ) : (
                subs.map((s) => (
                  <tr key={s.id} className="row-hover">
                    <Td>
                      <span className="text-dim text-[10px]">{s.chat_id}</span>
                    </Td>
                    <Td>
                      <span className="text-bright font-medium">{s.name ?? "—"}</span>
                    </Td>
                    <Td>
                      <span
                        className={`text-[10px] tracking-[0.06em] ${
                          s.enabled ? "text-green" : "text-dim"
                        }`}
                      >
                        {s.enabled ? "● ACTIVE" : "○ INACTIVE"}
                      </span>
                    </Td>
                    <Td>
                      <span className="text-dim">All algorithms</span>
                    </Td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <EditModal
        algo={editing}
        onClose={() => setEditingId(null)}
        onSaved={() => {
          setEditingId(null);
          load();
        }}
      />

      <DeleteModal
        algo={deleting}
        onClose={() => setDeletingId(null)}
        onDeleted={() => {
          setDeletingId(null);
          load();
        }}
      />

      <TokenModal token={revealedToken} onClose={() => setRevealedToken(null)} />

      <ConfirmDialog
        open={regenTarget !== null}
        title="Regenerate API token"
        message={
          <div className="space-y-2">
            <p>
              The existing bearer token will stop working{" "}
              <span className="text-bright">immediately</span>. Update the
              algorithm&apos;s environment with the new value before it can talk
              to the dashboard again.
            </p>
            <p className="text-dim text-[11px]">
              The new token is shown once — copy it before closing the reveal.
            </p>
          </div>
        }
        confirmLabel="REGENERATE"
        tone="danger"
        onCancel={() => setRegenTarget(null)}
        onConfirm={() => {
          if (regenTarget) regenToken(regenTarget);
          setRegenTarget(null);
        }}
      />
    </div>
  );
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th
      className={`px-3 py-1.5 border-b border-div text-[9px] tracking-[0.1em] font-normal text-dim whitespace-nowrap ${
        right ? "text-right" : "text-left"
      }`}
    >
      {children}
    </th>
  );
}
function Td({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <td
      className={`px-3 py-2.5 border-b border-bg-el-2 text-[11px] align-middle ${
        right ? "text-right" : "text-left"
      }`}
    >
      {children}
    </td>
  );
}

function RegisterForm({
  onDone,
}: {
  onDone: (token: { algorithm_id: string; api_token: string } | null) => void;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState("hybrid");
  const [symbols, setSymbols] = useState("MNQ1!,MES1!");
  const [launchCmd, setLaunchCmd] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    setSubmitting(true);
    try {
      const r = await fetch("/api/v1/algorithms/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name,
          type,
          symbols: symbols.split(",").map((s) => s.trim()).filter(Boolean),
          launch_cmd: launchCmd || undefined,
        }),
      });
      const j = await r.json();
      onDone(j.created ? { algorithm_id: j.algorithm_id, api_token: j.api_token } : null);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="px-[18px] py-3 border-b border-div space-y-3 bg-bg-el-2/40">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
        <Input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
        <Select value={type} onChange={(e) => setType(e.target.value)}>
          <option value="hybrid">HYBRID</option>
          <option value="rules">RULES</option>
          <option value="llm">LLM</option>
          <option value="custom">CUSTOM</option>
        </Select>
        <Input
          placeholder="Symbols (comma-separated)"
          value={symbols}
          onChange={(e) => setSymbols(e.target.value)}
        />
        <Input
          placeholder="Launch command (optional)"
          value={launchCmd}
          onChange={(e) => setLaunchCmd(e.target.value)}
        />
      </div>
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={() => onDone(null)}>
          CANCEL
        </Button>
        <Button size="sm" variant="primary" onClick={submit} disabled={!name || submitting}>
          REGISTER ▸
        </Button>
      </div>
    </div>
  );
}

function SubscriberForm({ onAdded }: { onAdded: () => void }) {
  const [chat, setChat] = useState("");
  const [name, setName] = useState("");
  const submit = async () => {
    if (!chat) return;
    await fetch("/api/v1/telegram/subscribers", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chat, name: name || undefined }),
    });
    setChat("");
    setName("");
    onAdded();
  };
  return (
    <div className="px-[18px] py-2.5 border-b border-div flex flex-wrap items-center gap-2 bg-bg-el-2/40">
      <Input placeholder="Chat ID" value={chat} onChange={(e) => setChat(e.target.value)} />
      <Input
        placeholder="Name (optional)"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <Button size="sm" variant="outline" onClick={submit} disabled={!chat}>
        + ADD SUBSCRIBER
      </Button>
    </div>
  );
}

function EditModal({
  algo,
  onClose,
  onSaved,
}: {
  algo: AlgorithmEntry | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState("hybrid");
  const [description, setDescription] = useState("");
  const [symbols, setSymbols] = useState("");
  const [launchCmd, setLaunchCmd] = useState("");
  const [dbPath, setDbPath] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!algo) return;
    setName(algo.name);
    setType(algo.type);
    setDescription(algo.description ?? "");
    setSymbols(algo.symbols.join(","));
    setLaunchCmd(algo.launch_cmd ?? "");
    setDbPath(algo.db_path ?? "");
    setEnabled(algo.enabled);
    setError(null);
  }, [algo]);

  if (!algo) return null;

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const r = await fetch(`/api/v1/algorithms/${algo.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name,
          type,
          description: description || null,
          symbols: symbols.split(",").map((s) => s.trim()).filter(Boolean),
          launch_cmd: launchCmd || null,
          db_path: dbPath || null,
          enabled,
        }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        setError(j.error || `update failed (${r.status})`);
        return;
      }
      onSaved();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal title={`Edit · ${algo.name}`} onClose={onClose}>
      <div className="space-y-3">
        <Field label="NAME">
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="TYPE">
          <Select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="hybrid">HYBRID</option>
            <option value="rules">RULES</option>
            <option value="llm">LLM</option>
            <option value="custom">CUSTOM</option>
          </Select>
        </Field>
        <Field label="DESCRIPTION">
          <Input value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <Field label="SYMBOLS (COMMA-SEPARATED)">
          <Input value={symbols} onChange={(e) => setSymbols(e.target.value)} />
        </Field>
        <Field label="LAUNCH COMMAND">
          <Input
            value={launchCmd}
            onChange={(e) => setLaunchCmd(e.target.value)}
            placeholder="uv run python -m trading_agent.live_hybrid -v"
          />
        </Field>
        <Field label="LOCAL DATABASE PATH">
          <Input value={dbPath} onChange={(e) => setDbPath(e.target.value)} />
        </Field>
        <Field label="">
          <label className="flex items-center gap-2 text-[11px] text-text">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="accent-green"
            />
            ENABLED (UNCHECK TO PAUSE WITHOUT DELETING)
          </label>
        </Field>
        {error ? (
          <div className="text-[11px] text-red bg-[rgba(255,82,82,0.05)] p-2 border border-[rgba(255,82,82,0.25)]">
            {error}
          </div>
        ) : null}
      </div>
      <div className="flex justify-end gap-2 mt-4">
        <Button size="sm" variant="ghost" onClick={onClose}>
          CANCEL
        </Button>
        <Button size="sm" variant="primary" onClick={submit} disabled={submitting || !name}>
          SAVE ▸
        </Button>
      </div>
    </Modal>
  );
}

function DeleteModal({
  algo,
  onClose,
  onDeleted,
}: {
  algo: AlgorithmEntry | null;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [confirmName, setConfirmName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setConfirmName("");
    setError(null);
  }, [algo]);

  if (!algo) return null;
  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const r = await fetch(`/api/v1/algorithms/${algo.id}`, { method: "DELETE" });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        setError(j.error || `delete failed (${r.status})`);
        return;
      }
      onDeleted();
    } finally {
      setSubmitting(false);
    }
  };
  const canDelete = confirmName === algo.name;

  return (
    <Modal title="Delete algorithm" onClose={onClose}>
      <div className="space-y-3 text-[12px]">
        <p className="text-text">
          This permanently deletes{" "}
          <span className="text-bright font-semibold">{algo.name}</span> along
          with all its events and alert history.
        </p>
        <p className="text-dim text-[11px]">
          {algo.stats_today.total_alerts} alert
          {algo.stats_today.total_alerts === 1 ? "" : "s"} recorded today. This
          action cannot be undone.
        </p>
        <div>
          <div className="text-[9px] tracking-[0.1em] text-dim mb-1 uppercase">
            Type the algorithm name to confirm
          </div>
          <Input
            value={confirmName}
            onChange={(e) => setConfirmName(e.target.value)}
            placeholder={algo.name}
          />
        </div>
        {error ? (
          <div className="text-[11px] text-red bg-[rgba(255,82,82,0.05)] p-2 border border-[rgba(255,82,82,0.25)]">
            {error}
          </div>
        ) : null}
      </div>
      <div className="flex justify-end gap-2 mt-4">
        <Button size="sm" variant="ghost" onClick={onClose}>
          CANCEL
        </Button>
        <Button size="sm" variant="danger" onClick={submit} disabled={!canDelete || submitting}>
          ■ DELETE
        </Button>
      </div>
    </Modal>
  );
}

function TokenModal({
  token,
  onClose,
}: {
  token: { algorithm_id: string; api_token: string } | null;
  onClose: () => void;
}) {
  if (!token) return null;
  return (
    <Modal title="API token" onClose={onClose}>
      <div className="space-y-3 text-[12px]">
        <p className="text-dim">
          Copy this now — for security, the token is shown only once.
        </p>
        <Field label="ALGORITHM ID">
          <Input readOnly value={token.algorithm_id} />
        </Field>
        <Field label="API TOKEN">
          <Input readOnly value={token.api_token} />
        </Field>
        <Button
          size="sm"
          variant="outline"
          onClick={() => navigator.clipboard.writeText(token.api_token)}
        >
          COPY TOKEN
        </Button>
      </div>
      <div className="flex justify-end gap-2 mt-4">
        <Button size="sm" variant="primary" onClick={onClose}>
          DONE
        </Button>
      </div>
    </Modal>
  );
}

function ChatDiscoveryPanel({
  result,
  onAdd,
  onClose,
}: {
  result: DiscoverResult;
  onAdd: (chat: DiscoveredChat) => void;
  onClose: () => void;
}) {
  return (
    <div className="px-[18px] py-3 border-b border-div bg-bg-el-2/60">
      <div className="flex items-center justify-between mb-2">
        <span className="text-bright text-[11px] tracking-[0.04em] uppercase">
          ▸ Discovered chats
        </span>
        <Button size="sm" variant="ghost" onClick={onClose}>
          DISMISS
        </Button>
      </div>
      {!result.ok ? (
        <div className="text-[11px] border border-[rgba(255,82,82,0.25)] bg-[rgba(255,82,82,0.05)] p-2.5">
          <div className="text-text">{result.description}</div>
          {result.hint ? (
            <div className="mt-1.5 text-dim">▸ {result.hint}</div>
          ) : null}
        </div>
      ) : result.chats.length === 0 ? (
        <div className="text-[11px] border border-[rgba(255,170,51,0.25)] bg-[rgba(255,170,51,0.05)] p-2.5 text-text">
          NO_CHATS_FOUND — message your bot on Telegram first, then retry.
        </div>
      ) : (
        <div className="space-y-1.5">
          {result.chats.map((c) => (
            <div
              key={c.chat_id}
              className="flex items-center justify-between text-[11px] border border-div bg-bg-el p-2.5"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-muted text-[10px] uppercase tracking-[0.06em]">
                  {c.type}
                </span>
                <span className="text-bright truncate">{c.title}</span>
                <span className="text-dim">{c.chat_id}</span>
              </div>
              <Button size="sm" variant="outline" onClick={() => onAdd(c)}>
                + ADD
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      {label ? (
        <div className="text-[9px] tracking-[0.1em] text-dim">{label}</div>
      ) : null}
      {children}
    </div>
  );
}
