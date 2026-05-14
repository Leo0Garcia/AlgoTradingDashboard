import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS accounts (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    broker          TEXT NOT NULL,
    balance         REAL,
    max_drawdown    REAL,
    status          TEXT NOT NULL DEFAULT 'active',
    metadata        TEXT,
    created_at      TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS algorithms (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL UNIQUE,
    type            TEXT NOT NULL,
    description     TEXT,
    api_token       TEXT NOT NULL UNIQUE,
    account_id      TEXT REFERENCES accounts(id),
    symbols         TEXT,
    db_path         TEXT,
    launch_cmd      TEXT,
    enabled         INTEGER NOT NULL DEFAULT 1,
    status          TEXT NOT NULL DEFAULT 'stopped',
    pid             INTEGER,
    last_heartbeat  TEXT,
    last_session    TEXT,
    working_dir     TEXT,
    last_launch_error TEXT,
    created_at      TEXT NOT NULL,
    updated_at      TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS events (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    algorithm_id    TEXT NOT NULL REFERENCES algorithms(id),
    event_type      TEXT NOT NULL,
    payload         TEXT NOT NULL,
    received_at     TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_events_algo_time ON events(algorithm_id, received_at);

CREATE TABLE IF NOT EXISTS alerts (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    algorithm_id    TEXT NOT NULL REFERENCES algorithms(id),
    external_id     TEXT NOT NULL,
    received_at     TEXT NOT NULL,
    symbol          TEXT NOT NULL,
    direction       TEXT NOT NULL,
    grade           TEXT NOT NULL,
    recipe          TEXT,
    entry_lo        REAL NOT NULL,
    entry_hi        REAL NOT NULL,
    stop            REAL NOT NULL,
    tp1             REAL NOT NULL,
    tp2             REAL NOT NULL,
    tp3             REAL NOT NULL,
    confluences     TEXT,
    rationale       TEXT,
    llm_decision    TEXT,
    approved        INTEGER NOT NULL DEFAULT 1,
    status          TEXT NOT NULL DEFAULT 'pending',
    fill_ts         TEXT,
    fill_px         REAL,
    exit_ts         TEXT,
    exit_px         REAL,
    r_outcome       REAL,
    UNIQUE(algorithm_id, external_id)
);
CREATE INDEX IF NOT EXISTS idx_alerts_algo_time ON alerts(algorithm_id, received_at);
CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts(status);

CREATE TABLE IF NOT EXISTS telegram_subscribers (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_id         TEXT NOT NULL UNIQUE,
    name            TEXT,
    enabled         INTEGER NOT NULL DEFAULT 1,
    filter_algo_ids TEXT,
    created_at      TEXT NOT NULL
);
`;

let _db: Database.Database | null = null;

function dbPath(): string {
  const raw = process.env.DATABASE_PATH || "./dashboard.sqlite";
  return path.isAbsolute(raw) ? raw : path.join(process.cwd(), raw);
}

export function getDb(): Database.Database {
  if (_db) return _db;
  const p = dbPath();
  const dir = path.dirname(p);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const db = new Database(p);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA);
  runMigrations(db);
  seedTelegramFromEnv(db);
  _db = db;
  return db;
}

function runMigrations(db: Database.Database) {
  // Idempotent column adds for older DBs that pre-date the column.
  const cols = db.prepare("PRAGMA table_info(algorithms)").all() as { name: string }[];
  const present = new Set(cols.map((c) => c.name));
  if (!present.has("last_session")) {
    db.exec("ALTER TABLE algorithms ADD COLUMN last_session TEXT");
  }
  if (!present.has("working_dir")) {
    db.exec("ALTER TABLE algorithms ADD COLUMN working_dir TEXT");
  }
  if (!present.has("last_launch_error")) {
    db.exec("ALTER TABLE algorithms ADD COLUMN last_launch_error TEXT");
  }
}

function seedTelegramFromEnv(db: Database.Database) {
  const chatId = process.env.TELEGRAM_DEFAULT_CHAT_ID;
  if (!chatId) return;
  const existing = db
    .prepare("SELECT id FROM telegram_subscribers WHERE chat_id = ?")
    .get(chatId);
  if (existing) return;
  db.prepare(
    `INSERT INTO telegram_subscribers (chat_id, name, enabled, filter_algo_ids, created_at)
     VALUES (?, ?, 1, NULL, ?)`,
  ).run(chatId, "default", new Date().toISOString());
}

export function nowIso(): string {
  return new Date().toISOString();
}
