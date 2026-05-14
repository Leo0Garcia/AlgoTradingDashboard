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

async function sendToChat(chat_id: string, text: string): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return false;
  try {
    const res = await fetch(`${TG_API}/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id, text, parse_mode: "HTML", disable_web_page_preview: true }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function broadcastAlert(algo: Algorithm, payload: AlertPayload): Promise<void> {
  if (!payload.approved) return;
  const subs = activeSubscribersFor(algo.id);
  if (subs.length === 0) return;
  const text = formatAlertMessage(algo, payload);
  await Promise.allSettled(subs.map((s) => sendToChat(s.chat_id, text)));
}

export async function sendTestMessage(chat_id: string): Promise<boolean> {
  return sendToChat(
    chat_id,
    "✅ <b>TradingAgent Dashboard</b>\nTelegram is wired up correctly.",
  );
}
