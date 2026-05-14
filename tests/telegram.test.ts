import { describe, it, expect } from "vitest";
import { formatAlertMessage } from "@/lib/telegram";
import type { Algorithm, AlertPayload } from "@/lib/types";

const algo: Algorithm = {
  id: "alg_test",
  name: "Hybrid-MNQ",
  type: "hybrid",
  description: null,
  api_token: "tok_x",
  account_id: null,
  symbols: ["MNQ1!"],
  db_path: null,
  launch_cmd: null,
  enabled: true,
  status: "running",
  pid: null,
  last_heartbeat: null,
  last_session: null,
  created_at: "",
  updated_at: "",
};

const payload: AlertPayload = {
  external_id: "x",
  symbol: "MNQ1!",
  direction: "long",
  grade: "A+",
  recipe: "sweep_ob",
  entry_zone: [29222, 29224],
  stop: 29200,
  tp1: 29254,
  tp2: 29281,
  tp3: 29327,
  confluences: ["sweep", "LTF_OB", "240_FVG", "liq_pool_high"],
  rationale: "TJR confluences",
  approved: true,
  live_spot: 29225,
};

describe("telegram formatting", () => {
  it("renders the alert message in the spec'd layout", () => {
    const msg = formatAlertMessage(algo, payload);
    expect(msg).toContain("[Hybrid-MNQ]");
    expect(msg).toContain("MNQ1!");
    expect(msg).toContain("LONG");
    expect(msg).toContain("A+");
    expect(msg).toContain("Entry");
    expect(msg).toContain("29222");
    expect(msg).toContain("29224");
    expect(msg).toContain("Stop");
    expect(msg).toContain("TP1");
    expect(msg).toContain("TP2");
    expect(msg).toContain("TP3");
    expect(msg).toContain("sweep + LTF_OB + 240_FVG + liq_pool_high");
    expect(msg).toContain("Live: 29225");
  });
});
