/**
 * End-to-end simulation script.
 *
 * Usage:
 *   tsx scripts/sim.ts                       # registers + heartbeats + sample alert
 *   tsx scripts/sim.ts --base http://...     # override base URL
 */

const args = new Map<string, string>();
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (a.startsWith("--")) {
    const [k, v] = [a.slice(2), process.argv[i + 1]];
    args.set(k, v);
    i++;
  }
}

const BASE = args.get("base") || "http://127.0.0.1:3000";

async function post(path: string, body: unknown, token?: string) {
  const r = await fetch(BASE + path, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const txt = await r.text();
    throw new Error(`POST ${path} -> ${r.status}: ${txt}`);
  }
  return r.json();
}

async function main() {
  console.log(`▶ Simulating against ${BASE}`);

  const reg = await post("/api/v1/algorithms/register", {
    name: "Hybrid (MNQ/MES)",
    type: "hybrid",
    description: "TJR-style rules + LLM review",
    symbols: ["MNQ1!", "MES1!"],
  });
  const { algorithm_id: id, api_token: token } = reg;
  console.log(`  ✓ registered ${id}`);

  await post(
    `/api/v1/algorithms/${id}/heartbeat`,
    {
      symbols: {
        "MNQ1!": { status: "no_setup", last_bar_ts: Date.now() / 1000, bias: "bullish" },
        "MES1!": { status: "watching" },
      },
      ts: new Date().toISOString(),
    },
    token,
  );
  console.log("  ✓ heartbeat sent");

  const ext = `alt_${Date.now()}`;
  await post(
    `/api/v1/algorithms/${id}/events`,
    {
      event_type: "alert",
      payload: {
        external_id: ext,
        symbol: "MNQ1!",
        direction: "long",
        grade: "A+",
        recipe: "sweep_ob_fvg",
        entry_zone: [29222, 29224],
        stop: 29200,
        tp1: 29254,
        tp2: 29281,
        tp3: 29327,
        confluences: ["sweep", "LTF_OB", "240_FVG", "liq_pool_high"],
        rationale: "Liquidity sweep into HTF OB, confluent with daily bias.",
        llm_decision: {
          decision: "approve",
          reason: "Confluences align; risk:reward is favorable.",
          confidence: "high",
        },
        approved: true,
        live_spot: 29225,
      },
    },
    token,
  );
  console.log("  ✓ alert event sent (telegram broadcast triggered)");

  await new Promise((r) => setTimeout(r, 250));

  await post(
    `/api/v1/algorithms/${id}/events`,
    {
      event_type: "trade_filled",
      payload: {
        external_id: ext,
        fill_ts: new Date().toISOString(),
        fill_px: 29223,
      },
    },
    token,
  );
  console.log("  ✓ trade_filled");

  await new Promise((r) => setTimeout(r, 250));

  await post(
    `/api/v1/algorithms/${id}/events`,
    {
      event_type: "trade_exit",
      payload: {
        external_id: ext,
        status: "tp1",
        exit_ts: new Date().toISOString(),
        exit_px: 29254,
        r_outcome: 1.3,
      },
    },
    token,
  );
  console.log("  ✓ trade_exit tp1 +1.3R");

  console.log("\n✅ Done. Open http://127.0.0.1:3000 to view the dashboard.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
