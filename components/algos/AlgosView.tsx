"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { fmtR, relativeTime } from "@/lib/utils";
import { Play, Square, Send, Plus, Pencil, Trash2, KeyRound } from "lucide-react";

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

  const load = useCallback(async () => {
    const [a, s] = await Promise.all([
      fetch("/api/v1/algorithms", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/v1/telegram/subscribers", { cache: "no-store" }).then((r) => r.json()),
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
    const r = await fetch("/api/v1/telegram/test");
    const j = await r.json();
    alert(JSON.stringify(j, null, 2));
  };

  const regenToken = async (id: string) => {
    if (
      !confirm(
        "Regenerate API token? The existing token will stop working immediately. Make sure to update the algorithm's env afterwards.",
      )
    )
      return;
    const r = await fetch(`/api/v1/algorithms/${id}/token`, { method: "POST" });
    const j = await r.json();
    setRevealedToken(j);
  };

  const editing = algos.find((a) => a.id === editingId) ?? null;
  const deleting = algos.find((a) => a.id === deletingId) ?? null;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title="Algorithms"
          subtitle="registered traders sending events to this dashboard"
          right={
            <Button size="sm" variant="outline" onClick={() => setShowRegister((v) => !v)}>
              <Plus className="h-3 w-3" /> register
            </Button>
          }
        />
        {showRegister ? (
          <RegisterForm
            onDone={(token) => {
              setShowRegister(false);
              if (token) setRevealedToken(token);
              load();
            }}
          />
        ) : null}
        <div className="overflow-auto">
          <table className="w-full text-xs">
            <thead className="text-[10px] uppercase tracking-wider text-zinc-500">
              <tr className="border-b border-zinc-800">
                <th className="text-left px-3 py-2">name</th>
                <th className="text-left px-3 py-2">type</th>
                <th className="text-left px-3 py-2">status</th>
                <th className="text-left px-3 py-2">hb</th>
                <th className="text-left px-3 py-2">symbols</th>
                <th className="text-right px-3 py-2">alerts (today)</th>
                <th className="text-right px-3 py-2">w/l</th>
                <th className="text-right px-3 py-2">Σ R</th>
                <th className="text-right px-3 py-2">actions</th>
              </tr>
            </thead>
            <tbody>
              {algos.map((a) => (
                <tr key={a.id} className="border-b border-zinc-900">
                  <td className="px-3 py-2">
                    <div className="text-zinc-100 font-medium">{a.name}</div>
                    <div className="num text-[10px] text-zinc-500">{a.id}</div>
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant="muted">{a.type}</Badge>
                  </td>
                  <td className="px-3 py-2">
                    <span className="inline-flex items-center gap-1.5">
                      <span className={`pulse-dot ${a.status}`} />
                      <span className="text-zinc-300">{a.status}</span>
                      {!a.enabled ? <Badge variant="amber">disabled</Badge> : null}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-zinc-400">{relativeTime(a.last_heartbeat)}</td>
                  <td className="num px-3 py-2 text-zinc-300">{a.symbols.join(" · ")}</td>
                  <td className="num px-3 py-2 text-right text-zinc-200">
                    {a.stats_today.total_alerts}
                  </td>
                  <td className="num px-3 py-2 text-right text-zinc-200">
                    {a.stats_today.wins}/{a.stats_today.losses}
                  </td>
                  <td
                    className={`num px-3 py-2 text-right ${
                      a.stats_today.r_sum >= 0 ? "text-green-400" : "text-red-400"
                    }`}
                  >
                    {fmtR(a.stats_today.r_sum)}
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    <div className="inline-flex gap-1">
                      {a.status === "running" ? (
                        <Button size="sm" variant="danger" onClick={() => control(a.id, "stop")}>
                          <Square className="h-3 w-3" /> stop
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => control(a.id, "start")}
                          disabled={!a.launch_cmd}
                          title={a.launch_cmd ?? "no launch_cmd configured"}
                        >
                          <Play className="h-3 w-3" /> start
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditingId(a.id)}
                        title="edit"
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => regenToken(a.id)}
                        title="regenerate token"
                      >
                        <KeyRound className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setDeletingId(a.id)}
                        title="delete"
                        className="hover:bg-red-500/15 hover:text-red-300"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {algos.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-zinc-500">
              No algorithms registered yet.
            </div>
          ) : null}
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Telegram subscribers"
          subtitle="chats that receive approved alerts"
          right={
            <Button size="sm" variant="outline" onClick={testTelegram}>
              <Send className="h-3 w-3" /> send test
            </Button>
          }
        />
        <SubscriberForm onAdded={load} />
        <div className="overflow-auto">
          <table className="w-full text-xs">
            <thead className="text-[10px] uppercase tracking-wider text-zinc-500">
              <tr className="border-b border-zinc-800">
                <th className="text-left px-3 py-2">chat_id</th>
                <th className="text-left px-3 py-2">name</th>
                <th className="text-left px-3 py-2">enabled</th>
                <th className="text-left px-3 py-2">filter</th>
              </tr>
            </thead>
            <tbody>
              {subs.map((s) => (
                <tr key={s.id} className="border-b border-zinc-900">
                  <td className="num px-3 py-1.5 text-zinc-200">{s.chat_id}</td>
                  <td className="px-3 py-1.5 text-zinc-300">{s.name ?? "—"}</td>
                  <td className="px-3 py-1.5">
                    {s.enabled ? (
                      <Badge variant="green">on</Badge>
                    ) : (
                      <Badge variant="muted">off</Badge>
                    )}
                  </td>
                  <td className="px-3 py-1.5 text-zinc-500">all algos</td>
                </tr>
              ))}
            </tbody>
          </table>
          {subs.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-zinc-500">
              No subscribers configured.
            </div>
          ) : null}
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
    </div>
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
      if (j.created) {
        onDone({ algorithm_id: j.algorithm_id, api_token: j.api_token });
      } else {
        onDone(null);
      }
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <div className="p-4 border-b border-zinc-800 space-y-3 bg-zinc-950/40">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
        <Input placeholder="name" value={name} onChange={(e) => setName(e.target.value)} />
        <Select value={type} onChange={(e) => setType(e.target.value)}>
          <option value="hybrid">hybrid</option>
          <option value="rules">rules</option>
          <option value="llm">llm</option>
          <option value="custom">custom</option>
        </Select>
        <Input
          placeholder="symbols, comma-separated"
          value={symbols}
          onChange={(e) => setSymbols(e.target.value)}
        />
        <Input
          placeholder="launch_cmd (optional)"
          value={launchCmd}
          onChange={(e) => setLaunchCmd(e.target.value)}
        />
      </div>
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={() => onDone(null)}>
          cancel
        </Button>
        <Button size="sm" variant="primary" onClick={submit} disabled={!name || submitting}>
          register
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
    <div className="p-3 border-b border-zinc-800 flex flex-wrap items-center gap-2 bg-zinc-950/40">
      <Input placeholder="chat_id" value={chat} onChange={(e) => setChat(e.target.value)} />
      <Input placeholder="name (optional)" value={name} onChange={(e) => setName(e.target.value)} />
      <Button size="sm" variant="outline" onClick={submit} disabled={!chat}>
        <Plus className="h-3 w-3" /> add subscriber
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
    <ModalShell title={`Edit · ${algo.name}`} onClose={onClose}>
      <div className="space-y-3">
        <Field label="name">
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="type">
          <Select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="hybrid">hybrid</option>
            <option value="rules">rules</option>
            <option value="llm">llm</option>
            <option value="custom">custom</option>
          </Select>
        </Field>
        <Field label="description">
          <Input value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <Field label="symbols (comma-separated)">
          <Input value={symbols} onChange={(e) => setSymbols(e.target.value)} />
        </Field>
        <Field label="launch_cmd">
          <Input
            value={launchCmd}
            onChange={(e) => setLaunchCmd(e.target.value)}
            placeholder="uv run python -m trading_agent.live_hybrid -v"
          />
        </Field>
        <Field label="db_path">
          <Input value={dbPath} onChange={(e) => setDbPath(e.target.value)} />
        </Field>
        <Field label="">
          <label className="flex items-center gap-2 text-xs text-zinc-300">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="accent-zinc-100"
            />
            enabled (uncheck to pause without deleting)
          </label>
        </Field>
        {error ? (
          <div className="text-xs text-red-400 bg-red-500/10 rounded p-2 border border-red-500/20">
            {error}
          </div>
        ) : null}
      </div>
      <div className="flex justify-end gap-2 mt-4">
        <Button size="sm" variant="ghost" onClick={onClose}>
          cancel
        </Button>
        <Button size="sm" variant="primary" onClick={submit} disabled={submitting || !name}>
          save
        </Button>
      </div>
    </ModalShell>
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
    <ModalShell title="Delete algorithm" onClose={onClose}>
      <div className="space-y-3 text-sm">
        <p className="text-zinc-300">
          This permanently deletes <span className="text-zinc-100 font-semibold">{algo.name}</span>{" "}
          along with all its events and alert history.
        </p>
        <p className="text-zinc-500 text-xs">
          {algo.stats_today.total_alerts} alert{algo.stats_today.total_alerts === 1 ? "" : "s"}{" "}
          recorded today. This action cannot be undone.
        </p>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">
            type the algorithm name to confirm
          </div>
          <Input
            value={confirmName}
            onChange={(e) => setConfirmName(e.target.value)}
            placeholder={algo.name}
          />
        </div>
        {error ? (
          <div className="text-xs text-red-400 bg-red-500/10 rounded p-2 border border-red-500/20">
            {error}
          </div>
        ) : null}
      </div>
      <div className="flex justify-end gap-2 mt-4">
        <Button size="sm" variant="ghost" onClick={onClose}>
          cancel
        </Button>
        <Button size="sm" variant="danger" onClick={submit} disabled={!canDelete || submitting}>
          <Trash2 className="h-3 w-3" /> delete
        </Button>
      </div>
    </ModalShell>
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
    <ModalShell title="API token" onClose={onClose}>
      <div className="space-y-3 text-sm">
        <p className="text-zinc-400">
          Copy this now — for security, the token is shown only once.
        </p>
        <Field label="algorithm_id">
          <Input readOnly value={token.algorithm_id} className="num" />
        </Field>
        <Field label="api_token">
          <Input readOnly value={token.api_token} className="num" />
        </Field>
        <Button
          size="sm"
          variant="outline"
          onClick={() => navigator.clipboard.writeText(token.api_token)}
        >
          copy token
        </Button>
      </div>
      <div className="flex justify-end gap-2 mt-4">
        <Button size="sm" variant="primary" onClick={onClose}>
          done
        </Button>
      </div>
    </ModalShell>
  );
}

function ModalShell({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-lg border border-zinc-800 bg-zinc-950 shadow-xl">
        <div className="px-4 py-3 border-b border-zinc-800 text-sm font-semibold text-zinc-100">
          {title}
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      {label ? (
        <div className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</div>
      ) : null}
      {children}
    </div>
  );
}
