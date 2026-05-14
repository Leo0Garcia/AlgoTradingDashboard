# TradingAgent Dashboard

A multi-algorithm trading command center. Algorithms register over HTTP and stream
events (`alert`, `trade_filled`, `trade_exit`, `heartbeat`, `rejection`, `error`)
to the dashboard, which:

- Persists every event in its own SQLite database (append-only log + a
  materialised `alerts` table for fast queries).
- Pushes everything live to the browser via Server-Sent Events.
- Fans approved alerts out to subscribed Telegram chats.
- Can launch and kill algorithm processes via configured `launch_cmd`s.

Runs on `127.0.0.1:3000`. No auth on the browser side — algorithm-to-dashboard
traffic is bearer-token authenticated.

## Tech

Next.js 16 (App Router, RSC, Turbopack), TypeScript, Tailwind CSS v4,
`better-sqlite3`, TradingView `lightweight-charts`, Recharts, Vitest.

## Setup

```bash
npm install
cp .env.example .env.local   # fill in TELEGRAM_BOT_TOKEN + TELEGRAM_DEFAULT_CHAT_ID
npm run dev
```

Open <http://127.0.0.1:3000>.

## End-to-end smoke test

With the dev server running:

```bash
npx tsx scripts/sim.ts
```

This registers an algorithm, sends a heartbeat, an approved A+ alert (which
triggers Telegram), then a fill and a TP1 exit. The home page should reflect
it in real time, the journal should show the row, and the equity curve should
register +1.3R.

## Tests

```bash
npm test
```

## API

All endpoints are versioned under `/api/v1`. Algorithm-facing endpoints require
`Authorization: Bearer <api_token>` (returned by `/algorithms/register`).

| Method | Path | Auth | Purpose |
| ---- | ---- | ---- | ---- |
| POST | `/algorithms/register` | – | Register algorithm (idempotent on `name`) |
| POST | `/algorithms/:id/heartbeat` | algorithm | Tick |
| POST | `/algorithms/:id/events` | algorithm | Push event |
| POST | `/algorithms/:id/control` | – | `{action: "start" \| "stop"}` |
| GET  | `/algorithms` | – | List with today's stats |
| GET  | `/algorithms/:id` | – | Detail + latest heartbeat |
| GET  | `/alerts` | – | Query alerts |
| GET  | `/alerts/:id` | – | Single alert |
| GET  | `/active-trades` | – | Alerts currently in market |
| GET  | `/equity` | – | Equity curve points |
| GET  | `/stream` | – | SSE stream of live events |
| GET/POST | `/accounts` | – | Account registry (mostly stubbed in v1) |
| GET/POST | `/telegram/subscribers` | – | Subscriber registry |
| GET  | `/telegram/test` | – | Send test message |

## Layout

```
app/                Next.js App Router pages + API routes
  page.tsx          / — Live: status bar, event stream, active trades, equity
  journal/          /journal — alert browser with drawer
  analytics/        /analytics — breakdowns and distributions
  algos/            /algos — registry, controls, telegram subscribers
  api/v1/           HTTP API surface

lib/                db, repository, telegram, sse bus, auth, types, utils
components/         UI building blocks per page
hooks/useStream.ts  shared singleton SSE EventSource hook
scripts/sim.ts      end-to-end simulator
tests/              vitest unit tests
```

## Roadmap

- [x] Phase 1 — backbone, ingestion, telegram, live UI
- [x] Phase 2 — journal + drawer
- [x] Phase 3 — analytics breakdowns
- [ ] Phase 4 — multi-account broker integrations (Topstep, Apex…)
