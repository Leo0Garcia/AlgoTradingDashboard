import { getDb, nowIso } from "./db";
import { nanoid } from "nanoid";
import type {
  Algorithm,
  Alert,
  AlertPayload,
  AlertStatus,
  HeartbeatPayload,
  TelegramSubscriber,
  Account,
} from "./types";

type Row = Record<string, unknown>;

function parseJSON<T>(v: unknown, fallback: T): T {
  if (typeof v !== "string" || !v) return fallback;
  try {
    return JSON.parse(v) as T;
  } catch {
    return fallback;
  }
}

function mapAlgorithm(r: Row): Algorithm {
  return {
    id: r.id as string,
    name: r.name as string,
    type: r.type as Algorithm["type"],
    description: (r.description as string) ?? null,
    api_token: r.api_token as string,
    account_id: (r.account_id as string) ?? null,
    symbols: parseJSON<string[]>(r.symbols, []),
    db_path: (r.db_path as string) ?? null,
    launch_cmd: (r.launch_cmd as string) ?? null,
    enabled: Boolean(r.enabled),
    status: r.status as Algorithm["status"],
    pid: (r.pid as number) ?? null,
    last_heartbeat: (r.last_heartbeat as string) ?? null,
    created_at: r.created_at as string,
    updated_at: r.updated_at as string,
  };
}

function mapAlert(r: Row): Alert {
  return {
    id: r.id as number,
    algorithm_id: r.algorithm_id as string,
    external_id: r.external_id as string,
    received_at: r.received_at as string,
    symbol: r.symbol as string,
    direction: r.direction as Alert["direction"],
    grade: r.grade as Alert["grade"],
    recipe: (r.recipe as string) ?? null,
    entry_lo: r.entry_lo as number,
    entry_hi: r.entry_hi as number,
    stop: r.stop as number,
    tp1: r.tp1 as number,
    tp2: r.tp2 as number,
    tp3: r.tp3 as number,
    confluences: parseJSON<string[]>(r.confluences, []),
    rationale: (r.rationale as string) ?? null,
    llm_decision: parseJSON<Alert["llm_decision"]>(r.llm_decision, null),
    approved: Boolean(r.approved),
    status: r.status as AlertStatus,
    fill_ts: (r.fill_ts as string) ?? null,
    fill_px: (r.fill_px as number) ?? null,
    exit_ts: (r.exit_ts as string) ?? null,
    exit_px: (r.exit_px as number) ?? null,
    r_outcome: (r.r_outcome as number) ?? null,
  };
}

function mapAccount(r: Row): Account {
  return {
    id: r.id as string,
    name: r.name as string,
    broker: r.broker as string,
    balance: (r.balance as number) ?? null,
    max_drawdown: (r.max_drawdown as number) ?? null,
    status: r.status as string,
    metadata: parseJSON<Account["metadata"]>(r.metadata, null),
    created_at: r.created_at as string,
  };
}

function mapSubscriber(r: Row): TelegramSubscriber {
  return {
    id: r.id as number,
    chat_id: r.chat_id as string,
    name: (r.name as string) ?? null,
    enabled: Boolean(r.enabled),
    filter_algo_ids: parseJSON<string[] | null>(r.filter_algo_ids, null),
    created_at: r.created_at as string,
  };
}

// Algorithms ----------------------------------------------------------------

export function registerAlgorithm(input: {
  name: string;
  type: string;
  description?: string;
  symbols?: string[];
  db_path?: string;
  launch_cmd?: string;
  account_id?: string;
}): { algorithm: Algorithm; created: boolean } {
  const db = getDb();
  const existing = db
    .prepare("SELECT * FROM algorithms WHERE name = ?")
    .get(input.name) as Row | undefined;
  if (existing) {
    return { algorithm: mapAlgorithm(existing), created: false };
  }
  const id = `alg_${nanoid(20)}`;
  const token = `tok_${nanoid(40)}`;
  const ts = nowIso();
  db.prepare(
    `INSERT INTO algorithms
     (id, name, type, description, api_token, account_id, symbols, db_path, launch_cmd,
      enabled, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'stopped', ?, ?)`,
  ).run(
    id,
    input.name,
    input.type,
    input.description ?? null,
    token,
    input.account_id ?? null,
    JSON.stringify(input.symbols ?? []),
    input.db_path ?? null,
    input.launch_cmd ?? null,
    ts,
    ts,
  );
  const row = db.prepare("SELECT * FROM algorithms WHERE id = ?").get(id) as Row;
  return { algorithm: mapAlgorithm(row), created: true };
}

export function listAlgorithms(): Algorithm[] {
  const db = getDb();
  const rows = db
    .prepare("SELECT * FROM algorithms ORDER BY created_at ASC")
    .all() as Row[];
  return rows.map(mapAlgorithm);
}

export function getAlgorithm(id: string): Algorithm | null {
  const db = getDb();
  const r = db.prepare("SELECT * FROM algorithms WHERE id = ?").get(id) as Row | undefined;
  return r ? mapAlgorithm(r) : null;
}

export function getAlgorithmByToken(token: string): Algorithm | null {
  const db = getDb();
  const r = db
    .prepare("SELECT * FROM algorithms WHERE api_token = ?")
    .get(token) as Row | undefined;
  return r ? mapAlgorithm(r) : null;
}

export function updateAlgorithmHeartbeat(id: string, ts: string): void {
  const db = getDb();
  db.prepare(
    "UPDATE algorithms SET last_heartbeat = ?, status = 'running', updated_at = ? WHERE id = ?",
  ).run(ts, nowIso(), id);
}

export function setAlgorithmStatus(
  id: string,
  status: Algorithm["status"],
  pid: number | null = null,
): void {
  const db = getDb();
  db.prepare(
    "UPDATE algorithms SET status = ?, pid = ?, updated_at = ? WHERE id = ?",
  ).run(status, pid, nowIso(), id);
}

// Events --------------------------------------------------------------------

export function insertEvent(
  algorithm_id: string,
  event_type: string,
  payload: unknown,
): { id: number; received_at: string } {
  const db = getDb();
  const received_at = nowIso();
  const info = db
    .prepare(
      "INSERT INTO events (algorithm_id, event_type, payload, received_at) VALUES (?, ?, ?, ?)",
    )
    .run(algorithm_id, event_type, JSON.stringify(payload), received_at);
  return { id: info.lastInsertRowid as number, received_at };
}

// Alerts --------------------------------------------------------------------

export function upsertAlert(
  algorithm_id: string,
  payload: AlertPayload,
  received_at: string,
): Alert {
  const db = getDb();
  const existing = db
    .prepare(
      "SELECT id FROM alerts WHERE algorithm_id = ? AND external_id = ?",
    )
    .get(algorithm_id, payload.external_id) as { id: number } | undefined;
  if (existing) {
    return getAlertById(existing.id)!;
  }
  const info = db
    .prepare(
      `INSERT INTO alerts
       (algorithm_id, external_id, received_at, symbol, direction, grade, recipe,
        entry_lo, entry_hi, stop, tp1, tp2, tp3, confluences, rationale,
        llm_decision, approved, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
    )
    .run(
      algorithm_id,
      payload.external_id,
      received_at,
      payload.symbol,
      payload.direction,
      payload.grade,
      payload.recipe ?? null,
      payload.entry_zone[0],
      payload.entry_zone[1],
      payload.stop,
      payload.tp1,
      payload.tp2,
      payload.tp3,
      JSON.stringify(payload.confluences ?? []),
      payload.rationale ?? null,
      payload.llm_decision ? JSON.stringify(payload.llm_decision) : null,
      payload.approved ? 1 : 0,
    );
  return getAlertById(info.lastInsertRowid as number)!;
}

export function setAlertFilled(
  algorithm_id: string,
  external_id: string,
  fill_ts: string,
  fill_px: number,
): Alert | null {
  const db = getDb();
  db.prepare(
    `UPDATE alerts SET status = 'filled', fill_ts = ?, fill_px = ?
     WHERE algorithm_id = ? AND external_id = ?`,
  ).run(fill_ts, fill_px, algorithm_id, external_id);
  return getAlertByExternal(algorithm_id, external_id);
}

export function setAlertExit(
  algorithm_id: string,
  external_id: string,
  status: AlertStatus,
  exit_ts: string,
  exit_px: number,
  r_outcome: number,
): Alert | null {
  const db = getDb();
  db.prepare(
    `UPDATE alerts SET status = ?, exit_ts = ?, exit_px = ?, r_outcome = ?
     WHERE algorithm_id = ? AND external_id = ?`,
  ).run(status, exit_ts, exit_px, r_outcome, algorithm_id, external_id);
  return getAlertByExternal(algorithm_id, external_id);
}

export function getAlertById(id: number): Alert | null {
  const db = getDb();
  const r = db.prepare("SELECT * FROM alerts WHERE id = ?").get(id) as Row | undefined;
  return r ? mapAlert(r) : null;
}

export function getAlertByExternal(algo: string, ext: string): Alert | null {
  const db = getDb();
  const r = db
    .prepare("SELECT * FROM alerts WHERE algorithm_id = ? AND external_id = ?")
    .get(algo, ext) as Row | undefined;
  return r ? mapAlert(r) : null;
}

export interface AlertFilters {
  algorithm_id?: string;
  from?: string;
  to?: string;
  symbol?: string;
  direction?: string;
  grade?: string;
  status?: string;
  approved?: boolean;
  limit?: number;
}

export function listAlerts(f: AlertFilters = {}): Alert[] {
  const db = getDb();
  const where: string[] = [];
  const params: unknown[] = [];
  if (f.algorithm_id) {
    where.push("algorithm_id = ?");
    params.push(f.algorithm_id);
  }
  if (f.from) {
    where.push("received_at >= ?");
    params.push(f.from);
  }
  if (f.to) {
    where.push("received_at <= ?");
    params.push(f.to);
  }
  if (f.symbol) {
    where.push("symbol = ?");
    params.push(f.symbol);
  }
  if (f.direction) {
    where.push("direction = ?");
    params.push(f.direction);
  }
  if (f.grade) {
    where.push("grade = ?");
    params.push(f.grade);
  }
  if (f.status) {
    where.push("status = ?");
    params.push(f.status);
  }
  if (f.approved !== undefined) {
    where.push("approved = ?");
    params.push(f.approved ? 1 : 0);
  }
  const sql = `SELECT * FROM alerts ${
    where.length ? "WHERE " + where.join(" AND ") : ""
  } ORDER BY received_at DESC LIMIT ?`;
  params.push(f.limit ?? 500);
  const rows = db.prepare(sql).all(...params) as Row[];
  return rows.map(mapAlert);
}

export function listActiveAlerts(): Alert[] {
  const db = getDb();
  const rows = db
    .prepare(
      "SELECT * FROM alerts WHERE status IN ('filled','tp1','tp2','be_after_tp1') ORDER BY received_at DESC",
    )
    .all() as Row[];
  return rows.map(mapAlert);
}

export function algorithmStats(algorithm_id: string, since?: string) {
  const db = getDb();
  const args: unknown[] = [algorithm_id];
  let timeClause = "";
  if (since) {
    timeClause = " AND received_at >= ?";
    args.push(since);
  }
  const row = db
    .prepare(
      `SELECT
        COUNT(*) as total_alerts,
        SUM(CASE WHEN approved = 1 THEN 1 ELSE 0 END) as approved_count,
        SUM(CASE WHEN status IN ('tp1','tp2','tp3','be_after_tp1') THEN 1 ELSE 0 END) as wins,
        SUM(CASE WHEN status = 'stopped' THEN 1 ELSE 0 END) as losses,
        COALESCE(SUM(r_outcome), 0) as r_sum
       FROM alerts WHERE algorithm_id = ?${timeClause}`,
    )
    .get(...args) as Row;
  return {
    total_alerts: Number(row.total_alerts ?? 0),
    approved_count: Number(row.approved_count ?? 0),
    wins: Number(row.wins ?? 0),
    losses: Number(row.losses ?? 0),
    r_sum: Number(row.r_sum ?? 0),
  };
}

// Telegram subscribers ------------------------------------------------------

export function listSubscribers(): TelegramSubscriber[] {
  const db = getDb();
  const rows = db
    .prepare("SELECT * FROM telegram_subscribers ORDER BY id ASC")
    .all() as Row[];
  return rows.map(mapSubscriber);
}

export function activeSubscribersFor(algorithm_id: string): TelegramSubscriber[] {
  return listSubscribers().filter((s) => {
    if (!s.enabled) return false;
    if (!s.filter_algo_ids || s.filter_algo_ids.length === 0) return true;
    return s.filter_algo_ids.includes(algorithm_id);
  });
}

export function addSubscriber(chat_id: string, name?: string): TelegramSubscriber {
  const db = getDb();
  const existing = db
    .prepare("SELECT * FROM telegram_subscribers WHERE chat_id = ?")
    .get(chat_id) as Row | undefined;
  if (existing) return mapSubscriber(existing);
  db.prepare(
    `INSERT INTO telegram_subscribers (chat_id, name, enabled, filter_algo_ids, created_at)
     VALUES (?, ?, 1, NULL, ?)`,
  ).run(chat_id, name ?? null, nowIso());
  return mapSubscriber(
    db.prepare("SELECT * FROM telegram_subscribers WHERE chat_id = ?").get(chat_id) as Row,
  );
}

// Accounts ------------------------------------------------------------------

export function listAccounts(): Account[] {
  const db = getDb();
  const rows = db.prepare("SELECT * FROM accounts ORDER BY created_at ASC").all() as Row[];
  return rows.map(mapAccount);
}

export function createAccount(input: {
  name: string;
  broker: string;
  balance?: number;
  max_drawdown?: number;
}): Account {
  const db = getDb();
  const id = `acc_${nanoid(16)}`;
  db.prepare(
    `INSERT INTO accounts (id, name, broker, balance, max_drawdown, status, metadata, created_at)
     VALUES (?, ?, ?, ?, ?, 'active', NULL, ?)`,
  ).run(
    id,
    input.name,
    input.broker,
    input.balance ?? null,
    input.max_drawdown ?? null,
    nowIso(),
  );
  return mapAccount(db.prepare("SELECT * FROM accounts WHERE id = ?").get(id) as Row);
}

export function heartbeatPayloadFor(id: string): HeartbeatPayload | null {
  const db = getDb();
  const r = db
    .prepare(
      "SELECT payload FROM events WHERE algorithm_id = ? AND event_type = 'heartbeat' ORDER BY id DESC LIMIT 1",
    )
    .get(id) as { payload: string } | undefined;
  if (!r) return null;
  try {
    return JSON.parse(r.payload) as HeartbeatPayload;
  } catch {
    return null;
  }
}

export function equityCurve(
  algorithm_id?: string,
  since?: string,
): { ts: string; r: number; cumulative: number }[] {
  const db = getDb();
  const params: unknown[] = [];
  const where: string[] = ["exit_ts IS NOT NULL", "r_outcome IS NOT NULL"];
  if (algorithm_id) {
    where.push("algorithm_id = ?");
    params.push(algorithm_id);
  }
  if (since) {
    where.push("exit_ts >= ?");
    params.push(since);
  }
  const rows = db
    .prepare(
      `SELECT exit_ts as ts, r_outcome as r FROM alerts
       WHERE ${where.join(" AND ")} ORDER BY exit_ts ASC`,
    )
    .all(...params) as { ts: string; r: number }[];
  let cum = 0;
  return rows.map((r) => {
    cum += r.r;
    return { ts: r.ts, r: r.r, cumulative: cum };
  });
}
