"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { fmtR, relativeTime } from "@/lib/utils";
import { Play, Square, Send, Plus, Pencil, Trash2, KeyRound, Search, Info } from "lucide-react";
import { Modal, ConfirmDialog } from "@/components/ui/modal";

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
    <div className="space-y-4">
      <Card>
        <CardHeader
          title="Algorithms"
          subtitle="Registered traders sending events to this dashboard"
          right={
            <Button size="sm" variant="outline" onClick={() => setShowRegister((v) => !v)}>
              <Plus className="h-3 w-3" /> Register
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
                <th className="text-left px-3 py-2">Name</th>
                <th className="text-left px-3 py-2">Type</th>
                <th className="text-left px-3 py-2">Status</th>
                <th className="text-left px-3 py-2">Heartbeat</th>
                <th className="text-left px-3 py-2">Symbols</th>
                <th className="text-right px-3 py-2">Alerts (today)</th>
                <th className="text-right px-3 py-2">W / L</th>
                <th className="text-right px-3 py-2">Σ R</th>
                <th className="text-right px-3 py-2">Actions</th>
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
                      <span className="text-zinc-300 capitalize">{a.status}</span>
                      {!a.enabled ? <Badge variant="amber">Disabled</Badge> : null}
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
                          <Square className="h-3 w-3" /> Stop
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => control(a.id, "start")}
                          disabled={!a.launch_cmd}
                          title={a.launch_cmd ?? "No launch command configured"}
                        >
                          <Play className="h-3 w-3" /> Start
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditingId(a.id)}
                        title="Edit"
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setRegenTarget(a.id)}
                        title="Regenerate API token"
                      >
                        <KeyRound className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setDeletingId(a.id)}
                        title="Delete"
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
          subtitle="Chats that receive approved alerts"
          right={
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={findChatId} disabled={discovering}>
                <Search className="h-3 w-3" /> {discovering ? "Looking…" : "Find my chat ID"}
              </Button>
              <Button size="sm" variant="outline" onClick={testTelegram}>
                <Send className="h-3 w-3" /> Send test
              </Button>
            </div>
          }
        />
        <div className="px-4 py-3 border-b border-zinc-800 text-xs text-zinc-400 flex items-start gap-2 bg-zinc-900/30">
          <Info className="h-3.5 w-3.5 text-blue-400 shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <span className="text-zinc-200 font-medium">First time?</span> Telegram bots can&apos;t DM
            you until you message them at least once. Open Telegram, find your bot, press{" "}
            <span className="text-zinc-200">Start</span> (or send <code className="num">hi</code>),
            then click <span className="text-zinc-200">find my chat ID</span> to discover it
            automatically.
          </div>
        </div>
        {telegramResult ? (
          <div className="px-4 py-3 border-b border-zinc-800 space-y-2">
            {telegramResult.map((r) => (
              <div
                key={r.chat_id}
                className={`text-xs rounded-md border p-2.5 ${
                  r.ok
                    ? "border-green-500/20 bg-green-500/5"
                    : "border-red-500/20 bg-red-500/5"
                }`}
              >
                <div className="flex items-center gap-2">
                  <Badge variant={r.ok ? "green" : "red"}>
                    {r.ok ? "Delivered" : "Failed"}
                  </Badge>
                  <span className="num text-zinc-300">{r.chat_id}</span>
                  {r.status ? <span className="text-zinc-500">HTTP {r.status}</span> : null}
                </div>
                {r.description ? (
                  <div className="mt-1.5 text-zinc-300">{r.description}</div>
                ) : null}
                {r.hint ? (
                  <div className="mt-1.5 text-zinc-400 leading-relaxed">
                    💡 {r.hint}
                  </div>
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
        <div className="overflow-auto">
          <table className="w-full text-xs">
            <thead className="text-[10px] uppercase tracking-wider text-zinc-500">
              <tr className="border-b border-zinc-800">
                <th className="text-left px-3 py-2">Chat ID</th>
                <th className="text-left px-3 py-2">Name</th>
                <th className="text-left px-3 py-2">Enabled</th>
                <th className="text-left px-3 py-2">Filter</th>
              </tr>
            </thead>
            <tbody>
              {subs.map((s) => (
                <tr key={s.id} className="border-b border-zinc-900">
                  <td className="num px-3 py-1.5 text-zinc-200">{s.chat_id}</td>
                  <td className="px-3 py-1.5 text-zinc-300">{s.name ?? "—"}</td>
                  <td className="px-3 py-1.5">
                    {s.enabled ? (
                      <Badge variant="green">On</Badge>
                    ) : (
                      <Badge variant="muted">Off</Badge>
                    )}
                  </td>
                  <td className="px-3 py-1.5 text-zinc-500">All algorithms</td>
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

      <ConfirmDialog
        open={regenTarget !== null}
        title="Regenerate API token"
        message={
          <div className="space-y-2">
            <p>
              The existing bearer token will stop working{" "}
              <span className="text-zinc-100 font-medium">immediately</span>. You&apos;ll need to
              update the algorithm&apos;s environment with the new value before it can talk to the
              dashboard again.
            </p>
            <p className="text-zinc-500 text-xs">
              The new token will be shown once — make sure to copy it before closing the reveal.
            </p>
          </div>
        }
        confirmLabel="Regenerate"
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
        <Input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
        <Select value={type} onChange={(e) => setType(e.target.value)}>
          <option value="hybrid">Hybrid</option>
          <option value="rules">Rules</option>
          <option value="llm">LLM</option>
          <option value="custom">Custom</option>
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
          Cancel
        </Button>
        <Button size="sm" variant="primary" onClick={submit} disabled={!name || submitting}>
          Register
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
      <Input placeholder="Chat ID" value={chat} onChange={(e) => setChat(e.target.value)} />
      <Input placeholder="Name (optional)" value={name} onChange={(e) => setName(e.target.value)} />
      <Button size="sm" variant="outline" onClick={submit} disabled={!chat}>
        <Plus className="h-3 w-3" /> Add subscriber
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
        <Field label="Name">
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Type">
          <Select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="hybrid">Hybrid</option>
            <option value="rules">Rules</option>
            <option value="llm">LLM</option>
            <option value="custom">Custom</option>
          </Select>
        </Field>
        <Field label="Description">
          <Input value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <Field label="Symbols (comma-separated)">
          <Input value={symbols} onChange={(e) => setSymbols(e.target.value)} />
        </Field>
        <Field label="Launch command">
          <Input
            value={launchCmd}
            onChange={(e) => setLaunchCmd(e.target.value)}
            placeholder="uv run python -m trading_agent.live_hybrid -v"
          />
        </Field>
        <Field label="Local database path">
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
            Enabled (uncheck to pause without deleting)
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
          Cancel
        </Button>
        <Button size="sm" variant="primary" onClick={submit} disabled={submitting || !name}>
          Save
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
            Type the algorithm name to confirm
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
          Cancel
        </Button>
        <Button size="sm" variant="danger" onClick={submit} disabled={!canDelete || submitting}>
          <Trash2 className="h-3 w-3" /> Delete
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
      <div className="space-y-3 text-sm">
        <p className="text-zinc-400">
          Copy this now — for security, the token is shown only once.
        </p>
        <Field label="Algorithm ID">
          <Input readOnly value={token.algorithm_id} className="num" />
        </Field>
        <Field label="API token">
          <Input readOnly value={token.api_token} className="num" />
        </Field>
        <Button
          size="sm"
          variant="outline"
          onClick={() => navigator.clipboard.writeText(token.api_token)}
        >
          Copy token
        </Button>
      </div>
      <div className="flex justify-end gap-2 mt-4">
        <Button size="sm" variant="primary" onClick={onClose}>
          Done
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
    <div className="px-4 py-3 border-b border-zinc-800 bg-zinc-950/40">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs text-zinc-300 font-medium">Discovered chats</div>
        <Button size="sm" variant="ghost" onClick={onClose}>
          Dismiss
        </Button>
      </div>
      {!result.ok ? (
        <div className="text-xs rounded-md border border-red-500/20 bg-red-500/5 p-2.5">
          <div className="text-zinc-200">{result.description}</div>
          {result.hint ? (
            <div className="mt-1.5 text-zinc-400">💡 {result.hint}</div>
          ) : null}
        </div>
      ) : result.chats.length === 0 ? (
        <div className="text-xs rounded-md border border-amber-500/20 bg-amber-500/5 p-2.5 text-zinc-300 leading-relaxed">
          No chats found yet. To register one:
          <ol className="list-decimal pl-5 mt-1.5 space-y-0.5 text-zinc-400">
            <li>Open Telegram and find your bot (the one whose token is in <code className="num">.env.local</code>).</li>
            <li>Press <span className="text-zinc-200">Start</span> or send it any message like <code className="num">hi</code>.</li>
            <li>Click <span className="text-zinc-200">find my chat ID</span> again here.</li>
          </ol>
        </div>
      ) : (
        <div className="space-y-1.5">
          {result.chats.map((c) => (
            <div
              key={c.chat_id}
              className="flex items-center justify-between text-xs rounded-md border border-zinc-800 bg-zinc-900/60 p-2.5"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Badge variant="muted">{c.type}</Badge>
                <span className="text-zinc-100 truncate">{c.title}</span>
                <span className="num text-zinc-500">{c.chat_id}</span>
              </div>
              <Button size="sm" variant="outline" onClick={() => onAdd(c)}>
                <Plus className="h-3 w-3" /> Add
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
        <div className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</div>
      ) : null}
      {children}
    </div>
  );
}
