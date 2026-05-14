export type AlgorithmType = "hybrid" | "rules" | "llm" | "custom";
export type AlgorithmStatus = "running" | "stopped" | "errored";
export type Direction = "long" | "short";
export type Grade = "A+" | "A" | "B";
export type AlertStatus =
  | "pending"
  | "filled"
  | "tp1"
  | "tp2"
  | "tp3"
  | "stopped"
  | "be_after_tp1"
  | "expired";

export type EventType =
  | "alert"
  | "rejection"
  | "trade_filled"
  | "trade_exit"
  | "error"
  | "heartbeat";

export interface SessionState {
  active: boolean;
  name: string; // "london" | "ny" | "outside" | algorithm-defined
  next_window_start_unix?: number | null;
  next_window_name?: string | null;
}

export interface Algorithm {
  id: string;
  name: string;
  type: AlgorithmType;
  description: string | null;
  api_token: string;
  account_id: string | null;
  symbols: string[];
  db_path: string | null;
  launch_cmd: string | null;
  enabled: boolean;
  status: AlgorithmStatus;
  pid: number | null;
  last_heartbeat: string | null;
  last_session: SessionState | null;
  working_dir: string | null;
  last_launch_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface Alert {
  id: number;
  algorithm_id: string;
  external_id: string;
  received_at: string;
  symbol: string;
  direction: Direction;
  grade: Grade;
  recipe: string | null;
  entry_lo: number;
  entry_hi: number;
  stop: number;
  tp1: number;
  tp2: number;
  tp3: number;
  confluences: string[];
  rationale: string | null;
  llm_decision: LLMDecision | null;
  approved: boolean;
  status: AlertStatus;
  fill_ts: string | null;
  fill_px: number | null;
  exit_ts: string | null;
  exit_px: number | null;
  r_outcome: number | null;
}

export interface LLMDecision {
  decision: "approve" | "reject";
  reason: string;
  confidence: "high" | "medium" | "low";
}

export interface AlertPayload {
  external_id: string;
  symbol: string;
  direction: Direction;
  grade: Grade;
  recipe: string;
  entry_zone: [number, number];
  stop: number;
  tp1: number;
  tp2: number;
  tp3: number;
  confluences: string[];
  rationale: string;
  llm_decision?: LLMDecision;
  approved: boolean;
  live_spot?: number;
}

export interface RejectionPayload {
  external_id: string;
  symbol: string;
  direction: Direction;
  grade: Grade;
  reason: string;
  llm_decision?: LLMDecision;
}

export interface TradeFilledPayload {
  external_id: string;
  fill_ts: string;
  fill_px: number;
}

export interface TradeExitPayload {
  external_id: string;
  status: "tp1" | "tp2" | "tp3" | "stopped" | "be_after_tp1" | "expired";
  exit_ts: string;
  exit_px: number;
  r_outcome: number;
}

export interface ErrorPayload {
  level: "warn" | "error";
  message: string;
  context?: Record<string, unknown>;
}

export interface HeartbeatPayload {
  symbols: Record<
    string,
    {
      status: string;
      last_bar_ts?: number;
      bias?: string;
      pid?: number;
      [k: string]: unknown;
    }
  >;
  ts: string;
  session?: SessionState;
}

export interface Account {
  id: string;
  name: string;
  broker: string;
  balance: number | null;
  max_drawdown: number | null;
  status: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface TelegramSubscriber {
  id: number;
  chat_id: string;
  name: string | null;
  enabled: boolean;
  filter_algo_ids: string[] | null;
  created_at: string;
}

export interface StreamEvent {
  kind: "event" | "heartbeat" | "alert_update";
  algorithm_id: string;
  event_type?: EventType;
  payload: unknown;
  received_at: string;
}
