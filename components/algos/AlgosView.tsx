"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { fmtR, fmtDateTime, relativeTime } from "@/lib/utils";
import { Play, Square, Send, Plus, Trash } from "lucide-react";

interface AlgorithmEntry {
  id: string;
  name: string;
  type: string;
  description: string | null;
  status: "running" | "stopped" | "errored";
  last_heartbeat: string | null;
  symbols: string[];
  launch_cmd: string | null;
  enabled: boolean;
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
            onDone={() => {
              setShowRegister(false);
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
                <th className="text-right px-3 py-2">control</th>
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
                  <td className="px-3 py-2 text-right">
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
    </div>
  );
}

function RegisterForm({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState("");
  const [type, setType] = useState("hybrid");
  const [symbols, setSymbols] = useState("MNQ1!,MES1!");
  const [launchCmd, setLaunchCmd] = useState("");
  const [result, setResult] = useState<{ algorithm_id: string; api_token: string } | null>(
    null,
  );
  const submit = async () => {
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
    setResult(j);
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
        <Button size="sm" variant="ghost" onClick={onDone}>
          cancel
        </Button>
        <Button size="sm" variant="primary" onClick={submit} disabled={!name}>
          register
        </Button>
      </div>
      {result ? (
        <div className="rounded-md border border-zinc-800 bg-zinc-900/60 p-3 text-xs">
          <div className="text-zinc-400 mb-1">Save these — token shown only once:</div>
          <div className="num text-zinc-200">algorithm_id: {result.algorithm_id}</div>
          <div className="num text-zinc-200">api_token: {result.api_token}</div>
        </div>
      ) : null}
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
