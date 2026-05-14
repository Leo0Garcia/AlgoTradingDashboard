"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { StreamEvent } from "@/lib/types";

type Listener = (e: StreamEvent) => void;

interface SharedStream {
  es: EventSource | null;
  refs: number;
  listeners: Set<Listener>;
  connected: boolean;
  lastEventAt: string | null;
  setStatus: (c: boolean) => void;
}

declare global {
  // eslint-disable-next-line no-var
  var __sharedStream: SharedStream | undefined;
}

function shared(): SharedStream {
  if (!globalThis.__sharedStream) {
    globalThis.__sharedStream = {
      es: null,
      refs: 0,
      listeners: new Set(),
      connected: false,
      lastEventAt: null,
      setStatus: () => {},
    };
  }
  return globalThis.__sharedStream;
}

function ensureConnected() {
  const s = shared();
  if (s.es) return;
  const es = new EventSource("/api/v1/stream");
  s.es = es;
  es.onopen = () => {
    s.connected = true;
    s.setStatus(true);
  };
  es.onerror = () => {
    s.connected = false;
    s.setStatus(false);
  };
  es.onmessage = (msg) => {
    try {
      const data = JSON.parse(msg.data) as StreamEvent | { kind: string };
      s.lastEventAt = new Date().toISOString();
      for (const l of s.listeners) {
        try {
          l(data as StreamEvent);
        } catch {
          // ignore
        }
      }
    } catch {
      // ignore parse errors
    }
  };
}

function maybeDisconnect() {
  const s = shared();
  if (s.refs <= 0 && s.es) {
    s.es.close();
    s.es = null;
    s.connected = false;
  }
}

export function useStream(onEvent?: Listener) {
  const [, force] = useState(0);
  const [connected, setConnected] = useState(false);
  const [lastEventAt, setLastEventAt] = useState<string | null>(null);
  const handlerRef = useRef<Listener | null>(onEvent ?? null);
  handlerRef.current = onEvent ?? null;

  useEffect(() => {
    const s = shared();
    s.refs += 1;
    s.setStatus = (c) => setConnected(c);
    ensureConnected();
    setConnected(s.connected);

    const listener: Listener = (e) => {
      setLastEventAt(new Date().toISOString());
      handlerRef.current?.(e);
      force((x) => x + 1);
    };
    s.listeners.add(listener);

    return () => {
      s.listeners.delete(listener);
      s.refs -= 1;
      // Small grace period to avoid disconnecting between navigations
      setTimeout(maybeDisconnect, 50);
    };
  }, []);

  const noop = useCallback(() => {}, []);
  void noop;

  return { connected, lastEventAt };
}
