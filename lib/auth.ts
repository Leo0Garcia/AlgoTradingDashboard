import { NextRequest } from "next/server";
import { getAlgorithmByToken, getAlgorithm } from "./repo";
import type { Algorithm } from "./types";

export function getBearerToken(req: NextRequest): string | null {
  const h = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!h) return null;
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

export function authenticateAlgorithm(
  req: NextRequest,
  expectedId?: string,
): { ok: true; algorithm: Algorithm } | { ok: false; error: string; status: number } {
  const token = getBearerToken(req);
  if (!token) {
    return { ok: false, error: "missing bearer token", status: 401 };
  }
  const algo = getAlgorithmByToken(token);
  if (!algo) {
    return { ok: false, error: "invalid token", status: 401 };
  }
  if (expectedId && algo.id !== expectedId) {
    const other = getAlgorithm(expectedId);
    if (!other) return { ok: false, error: "algorithm not found", status: 404 };
    return { ok: false, error: "token does not match algorithm", status: 403 };
  }
  return { ok: true, algorithm: algo };
}
