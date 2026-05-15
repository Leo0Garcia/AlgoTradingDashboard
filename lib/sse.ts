import type { StreamEvent } from "./types";

type Listener = (e: StreamEvent) => void;

const BUFFER_SIZE = 50;

class Bus {
  private listeners = new Set<Listener>();
  private buffer: StreamEvent[] = [];

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  publish(e: StreamEvent): void {
    this.buffer.push(e);
    if (this.buffer.length > BUFFER_SIZE) {
      this.buffer.splice(0, this.buffer.length - BUFFER_SIZE);
    }
    for (const fn of this.listeners) {
      try {
        fn(e);
      } catch {
        // ignore broken listener
      }
    }
  }

  /** Return up to the last N events (oldest → newest). */
  recent(): StreamEvent[] {
    return this.buffer.slice();
  }
}

// Bumped from __sseBus → __sseBus_v2 when `recent()` was added so HMR doesn't
// hand us a stale instance from before the buffer existed.
const globalForBus = globalThis as unknown as { __sseBus_v2?: Bus };
export const bus: Bus =
  globalForBus.__sseBus_v2 ?? (globalForBus.__sseBus_v2 = new Bus());

export function publishEvent(e: StreamEvent): void {
  bus.publish(e);
}
