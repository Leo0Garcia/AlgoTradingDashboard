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

  it("upserts mutable metadata when re-registering an existing name", async () => {
    const repo = await import("@/lib/repo");
    const r1 = repo.registerAlgorithm({
      name: "upsert-target",
      type: "hybrid",
      symbols: ["MNQ1!"],
    });
    expect(r1.created).toBe(true);
    expect(r1.algorithm.launch_cmd).toBeNull();

    // Second registration adds launch_cmd + new symbols and a description.
    const r2 = repo.registerAlgorithm({
      name: "upsert-target",
      type: "hybrid",
      symbols: ["MNQ1!", "MES1!"],
      launch_cmd: "uv run python -m trading_agent.live_hybrid -v",
      description: "TJR + LLM",
    });
    expect(r2.created).toBe(false);
    expect(r2.algorithm.id).toBe(r1.algorithm.id);
    expect(r2.algorithm.api_token).toBe(r1.algorithm.api_token);
    expect(r2.algorithm.launch_cmd).toBe("uv run python -m trading_agent.live_hybrid -v");
    expect(r2.algorithm.symbols).toEqual(["MNQ1!", "MES1!"]);
    expect(r2.algorithm.description).toBe("TJR + LLM");
  });

  it("captures pid from heartbeat and preserves it across pid-less heartbeats", async () => {
    const repo = await import("@/lib/repo");
    const { algorithm } = repo.registerAlgorithm({ name: "boot-pid", type: "hybrid" });
    const bootHb = {
      symbols: { "MNQ1!": { status: "booting", pid: 41013 } },
      ts: new Date().toISOString(),
    };
    expect(repo.pidFromHeartbeat(bootHb)).toBe(41013);
    repo.updateAlgorithmHeartbeat(algorithm.id, new Date().toISOString(), 41013);
    let row = repo.getAlgorithm(algorithm.id);
    expect(row?.pid).toBe(41013);
    expect(row?.status).toBe("running");

    // Subsequent heartbeat without pid must NOT clear the stored pid
    repo.updateAlgorithmHeartbeat(algorithm.id, new Date().toISOString(), null);
    row = repo.getAlgorithm(algorithm.id);
    expect(row?.pid).toBe(41013);
  });

  it("marks running algorithms stopped when heartbeat is stale and pid is dead", async () => {
    const repo = await import("@/lib/repo");
    const { algorithm } = repo.registerAlgorithm({ name: "stale", type: "rules" });
    const sixMinAgo = new Date(Date.now() - 6 * 60 * 1000).toISOString();
    repo.updateAlgorithmHeartbeat(algorithm.id, sixMinAgo, 999999);
    let row = repo.getAlgorithm(algorithm.id);
    expect(row?.status).toBe("running");

    repo.markStaleAlgorithms();
    row = repo.getAlgorithm(algorithm.id);
    expect(row?.status).toBe("stopped");
    expect(row?.pid).toBeNull();
  });

  it("keeps a running algorithm running when its pid is still alive (own process)", async () => {
    const repo = await import("@/lib/repo");
    const { algorithm } = repo.registerAlgorithm({ name: "live-pid", type: "rules" });
    const sixMinAgo = new Date(Date.now() - 6 * 60 * 1000).toISOString();
    repo.updateAlgorithmHeartbeat(algorithm.id, sixMinAgo, process.pid);
    repo.markStaleAlgorithms();
    const row = repo.getAlgorithm(algorithm.id);
    expect(row?.status).toBe("running");
  });

  it("updates algorithm fields via patch semantics", async () => {
    const repo = await import("@/lib/repo");
    const { algorithm } = repo.registerAlgorithm({ name: "to-edit", type: "rules" });
    const updated = repo.updateAlgorithm(algorithm.id, {
      name: "renamed",
      description: "new desc",
      symbols: ["ES1!"],
      enabled: false,
    });
    expect(updated?.name).toBe("renamed");
    expect(updated?.description).toBe("new desc");
    expect(updated?.symbols).toEqual(["ES1!"]);
    expect(updated?.enabled).toBe(false);
    // Unchanged field stays
    expect(updated?.type).toBe("rules");
  });

  it("deletes algorithm and cascades its events and alerts", async () => {
    const repo = await import("@/lib/repo");
    const { algorithm } = repo.registerAlgorithm({ name: "to-delete", type: "rules" });
    repo.upsertAlert(
      algorithm.id,
      {
        external_id: "e1",
        symbol: "MNQ1!",
        direction: "long",
        grade: "A",
        recipe: "x",
        entry_zone: [1, 2],
        stop: 0,
        tp1: 3,
        tp2: 4,
        tp3: 5,
        confluences: [],
        rationale: "",
        approved: true,
      },
      new Date().toISOString(),
    );
    repo.insertEvent(algorithm.id, "heartbeat", { foo: "bar" });
    expect(repo.listAlerts({ algorithm_id: algorithm.id })).toHaveLength(1);

    const ok = repo.deleteAlgorithm(algorithm.id);
    expect(ok).toBe(true);
    expect(repo.getAlgorithm(algorithm.id)).toBeNull();
    expect(repo.listAlerts({ algorithm_id: algorithm.id })).toHaveLength(0);
  });

  it("regenerates the api token", async () => {
    const repo = await import("@/lib/repo");
    const { algorithm } = repo.registerAlgorithm({ name: "rotate", type: "rules" });
    const before = algorithm.api_token;
    const after = repo.regenerateAlgorithmToken(algorithm.id);
    expect(after?.api_token).not.toBe(before);
    expect(repo.getAlgorithmByToken(before)).toBeNull();
    expect(repo.getAlgorithmByToken(after!.api_token)?.id).toBe(algorithm.id);
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
