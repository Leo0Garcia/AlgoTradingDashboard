import type { Algorithm, AlertPayload } from "./types";
import { activeSubscribersFor } from "./repo";

const TG_API = "https://api.telegram.org";

function escapeHTML(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function fmtPx(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

function calcR(entry: number, stop: number, target: number, dir: "long" | "short"): number {
  const risk = Math.abs(entry - stop);
  if (!risk) return 0;
  const reward = dir === "long" ? target - entry : entry - target;
  return reward / risk;
}

export function formatAlertMessage(algo: Algorithm, p: AlertPayload): string {
  const entryMid = (p.entry_zone[0] + p.entry_zone[1]) / 2;
  const dirEmoji = p.direction === "long" ? "🟢" : "🔴";
  const dirText = p.direction.toUpperCase();
  const r1 = calcR(entryMid, p.stop, p.tp1, p.direction);
  const r2 = calcR(entryMid, p.stop, p.tp2, p.direction);
  const r3 = calcR(entryMid, p.stop, p.tp3, p.direction);
  const rStop = -1;
  const conf = (p.confluences ?? []).join(" + ");
  const liveLine = p.live_spot
    ? `\nLive: ${fmtPx(p.live_spot)} (${fmtPx(p.live_spot - entryMid)}pt from entry)`
    : "";
  return [
    `${dirEmoji} <b>[${escapeHTML(algo.name)}]</b> ${escapeHTML(p.symbol)} ${dirText} <b>${p.grade}</b>`,
    `Entry  ${fmtPx(p.entry_zone[0])} – ${fmtPx(p.entry_zone[1])}`,
    `Stop   ${fmtPx(p.stop)}   (${rStop.toFixed(2)}R)`,
    `TP1    ${fmtPx(p.tp1)}   (${r1.toFixed(2)}R)`,
    `TP2    ${fmtPx(p.tp2)}   (${r2.toFixed(2)}R)`,
    `TP3    ${fmtPx(p.tp3)}   (${r3.toFixed(2)}R)`,
    "",
    `Why: ${escapeHTML(conf || p.recipe)}${liveLine}`,
  ].join("\n");
}

export interface SendResult {
  ok: boolean;
  status?: number;
  description?: string;
  hint?: string;
}

function hintFor(description: string | undefined, status: number | undefined): string | undefined {
  const d = (description || "").toLowerCase();
  if (status === 401 || d.includes("unauthorized")) {
    return "TELEGRAM_BOT_TOKEN is missing or invalid — check .env.local.";
  }
  if (d.includes("chat not found")) {
    return "chat_id is wrong, or you haven't messaged the bot yet. Send /start to your bot first, then visit /api/v1/telegram/whoami to read the chat_id from getUpdates.";
  }
  if (d.includes("blocked") || d.includes("forbidden")) {
    return "You blocked or never started the bot. Open Telegram, find your bot, and press Start.";
  }
  if (d.includes("not enough rights") || d.includes("chat_admin")) {
    return "Bot lacks permission in this chat — invite it as admin (for groups/channels).";
  }
  return undefined;
}

async function sendToChat(chat_id: string, text: string): Promise<SendResult> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return { ok: false, description: "TELEGRAM_BOT_TOKEN is not configured" };
  try {
    const res = await fetch(`${TG_API}/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id, text, parse_mode: "HTML", disable_web_page_preview: true }),
    });
    const body = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      description?: string;
    };
    if (res.ok && body.ok) return { ok: true, status: res.status };
    return {
      ok: false,
      status: res.status,
      description: body.description ?? `HTTP ${res.status}`,
      hint: hintFor(body.description, res.status),
    };
  } catch (err) {
    return {
      ok: false,
      description: err instanceof Error ? err.message : "network error",
    };
  }
}

export async function broadcastAlert(algo: Algorithm, payload: AlertPayload): Promise<void> {
  if (!payload.approved) return;
  const subs = activeSubscribersFor(algo.id);
  if (subs.length === 0) return;
  const text = formatAlertMessage(algo, payload);
  await Promise.allSettled(subs.map((s) => sendToChat(s.chat_id, text)));
}

export async function sendTestMessage(chat_id: string): Promise<SendResult> {
  return sendToChat(
    chat_id,
    "✅ <b>TradingAgent Dashboard</b>\nTelegram is wired up correctly.",
  );
}

interface TGUpdate {
  message?: {
    chat?: { id: number; type: string; title?: string; username?: string; first_name?: string };
  };
  channel_post?: {
    chat?: { id: number; type: string; title?: string };
  };
  my_chat_member?: {
    chat?: { id: number; type: string; title?: string };
  };
}

export interface DiscoveredChat {
  chat_id: string;
  type: string;
  title: string;
}

export async function discoverChats(): Promise<
  { ok: true; chats: DiscoveredChat[] } | { ok: false; description: string; hint?: string }
> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return { ok: false, description: "TELEGRAM_BOT_TOKEN is not configured" };
  try {
    const res = await fetch(`${TG_API}/bot${token}/getUpdates`);
    const body = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      result?: TGUpdate[];
      description?: string;
    };
    if (!body.ok) {
      return {
        ok: false,
        description: body.description ?? `HTTP ${res.status}`,
        hint: hintFor(body.description, res.status),
      };
    }
    const map = new Map<string, DiscoveredChat>();
    for (const u of body.result ?? []) {
      const chat = u.message?.chat ?? u.channel_post?.chat ?? u.my_chat_member?.chat;
      if (!chat) continue;
      const id = String(chat.id);
      if (map.has(id)) continue;
      const c = chat as {
        id: number;
        type: string;
        title?: string;
        username?: string;
        first_name?: string;
      };
      map.set(id, {
        chat_id: id,
        type: c.type,
        title: c.title || c.username || c.first_name || id,
      });
    }
    return { ok: true, chats: Array.from(map.values()) };
  } catch (err) {
    return {
      ok: false,
      description: err instanceof Error ? err.message : "network error",
    };
  }
}
