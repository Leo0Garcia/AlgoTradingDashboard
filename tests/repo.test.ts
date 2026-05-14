import { describe, it, expect, beforeEach } from "vitest";
import path from "node:path";
import fs from "node:fs";

const TEST_DB = path.join(process.cwd(), "test-dashboard.sqlite");

beforeEach(() => {
  process.env.DATABASE_PATH = TEST_DB;
  process.env.TELEGRAM_DEFAULT_CHAT_ID = "";
  if (fs.existsSync(TEST_DB)) fs.rmSync(TEST_DB);
  // Reset module cache so the singleton DB picks up the new path
  // (vitest isolation across `it` already does this per-file)
});

describe("repo", () => {
  it("registers an algorithm idempotently and issues a token", async () => {
    const repo = await import("@/lib/repo");
    const { algorithm: a1, created: c1 } = repo.registerAlgorithm({
      name: "Hybrid (MNQ/MES)",
      type: "hybrid",
      symbols: ["MNQ1!", "MES1!"],
    });
    expect(c1).toBe(true);
    expect(a1.api_token).toMatch(/^tok_/);
    expect(a1.id).toMatch(/^alg_/);

    const { algorithm: a2, created: c2 } = repo.registerAlgorithm({
      name: "Hybrid (MNQ/MES)",
      type: "hybrid",
    });
    expect(c2).toBe(false);
    expect(a2.id).toBe(a1.id);
    expect(a2.api_token).toBe(a1.api_token);
  });

  it("upserts an alert, fills it, and resolves with R", async () => {
    const repo = await import("@/lib/repo");
    const { algorithm } = repo.registerAlgorithm({
      name: "Hybrid (MNQ/MES)",
      type: "hybrid",
    });
    const alert = repo.upsertAlert(
      algorithm.id,
      {
        external_id: "alt_1",
        symbol: "MNQ1!",
        direction: "long",
        grade: "A+",
        recipe: "sweep_ob",
        entry_zone: [29220, 29224],
        stop: 29200,
        tp1: 29254,
        tp2: 29281,
        tp3: 29327,
        confluences: ["sweep", "LTF_OB"],
        rationale: "TJR-style confluences",
        approved: true,
      },
      new Date().toISOString(),
    );
    expect(alert.status).toBe("pending");
    const filled = repo.setAlertFilled(algorithm.id, "alt_1", new Date().toISOString(), 29223);
    expect(filled?.status).toBe("filled");
    const exit = repo.setAlertExit(
      algorithm.id,
      "alt_1",
      "tp1",
      new Date().toISOString(),
      29254,
      1.3,
    );
    expect(exit?.status).toBe("tp1");
    expect(exit?.r_outcome).toBe(1.3);

    const stats = repo.algorithmStats(algorithm.id);
    expect(stats.wins).toBe(1);
    expect(stats.r_sum).toBeCloseTo(1.3);

    const curve = repo.equityCurve(algorithm.id);
    expect(curve).toHaveLength(1);
    expect(curve[0].cumulative).toBeCloseTo(1.3);
  });

  it("filters alerts by status and direction", async () => {
    const repo = await import("@/lib/repo");
    const { algorithm } = repo.registerAlgorithm({
      name: "Filter test",
      type: "rules",
    });
    const now = new Date().toISOString();
    for (let i = 0; i < 3; i++) {
      repo.upsertAlert(
        algorithm.id,
        {
          external_id: `e${i}`,
          symbol: "MNQ1!",
          direction: i === 2 ? "short" : "long",
          grade: "A",
          recipe: "r",
          entry_zone: [100, 101],
          stop: 99,
          tp1: 103,
          tp2: 105,
          tp3: 110,
          confluences: [],
          rationale: "",
          approved: true,
        },
        now,
      );
    }
    const longs = repo.listAlerts({ algorithm_id: algorithm.id, direction: "long" });
    const shorts = repo.listAlerts({ algorithm_id: algorithm.id, direction: "short" });
    expect(longs).toHaveLength(2);
    expect(shorts).toHaveLength(1);
  });
});
