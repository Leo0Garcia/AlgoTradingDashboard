"use client";

import { useEffect, useRef, useState } from "react";
import type { StreamEvent } from "@/lib/types";

type Listener = (e: StreamEvent) => void;
type StatusListener = (connected: boolean) => void;

interface SharedStream {
  es: EventSource | null;
  refs: number;
  listeners: Set<Listener>;
  statusListeners: Set<StatusListener>;
  connected: boolean;
  lastEventAt: string | null;
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
      statusListeners: new Set(),
      connected: false,
      lastEventAt: null,
    };
  }
  return globalThis.__sharedStream;
}

function broadcastStatus(connected: boolean) {
  const s = shared();
  if (s.connected === connected) return;
  s.connected = connected;
  for (const fn of s.statusListeners) {
    try {
      fn(connected);
    } catch {
      // ignore
    }
  }
}

function ensureConnected() {
  const s = shared();
  if (s.es) return;
  const es = new EventSource("/api/v1/stream");
  s.es = es;
  es.onopen = () => broadcastStatus(true);
  es.onerror = () => {
    // EventSource auto-reconnects; reflect transient disconnects in UI
    if (es.readyState === EventSource.CLOSED) {
      broadcastStatus(false);
    } else if (es.readyState === EventSource.CONNECTING) {
      broadcastStatus(false);
    }
  };
  es.onmessage = (msg) => {
    try {
      const data = JSON.parse(msg.data) as StreamEvent | { kind: string };
      s.lastEventAt = new Date().toISOString();
      // Receiving any message means we're definitely connected
      if (!s.connected) broadcastStatus(true);
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
    broadcastStatus(false);
  }
}

export function useStream(onEvent?: Listener) {
  const [, force] = useState(0);
  const [connected, setConnected] = useState(() => shared().connected);
  const [lastEventAt, setLastEventAt] = useState<string | null>(() => shared().lastEventAt);
  const handlerRef = useRef<Listener | null>(onEvent ?? null);
  handlerRef.current = onEvent ?? null;

  useEffect(() => {
    const s = shared();
    s.refs += 1;
    ensureConnected();
    setConnected(s.connected);

    const statusListener: StatusListener = (c) => setConnected(c);
    s.statusListeners.add(statusListener);

    const listener: Listener = (e) => {
      setLastEventAt(new Date().toISOString());
      handlerRef.current?.(e);
      force((x) => x + 1);
    };
    s.listeners.add(listener);

    return () => {
      s.listeners.delete(listener);
      s.statusListeners.delete(statusListener);
      s.refs -= 1;
      // Small grace period to avoid disconnecting between navigations
      setTimeout(maybeDisconnect, 50);
    };
  }, []);

  return { connected, lastEventAt };
}
