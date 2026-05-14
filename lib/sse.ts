import type { StreamEvent } from "./types";

type Listener = (e: StreamEvent) => void;

class Bus {
  private listeners = new Set<Listener>();

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  publish(e: StreamEvent): void {
    for (const fn of this.listeners) {
      try {
        fn(e);
      } catch {
        // ignore broken listener
      }
    }
  }
}

const globalForBus = globalThis as unknown as { __sseBus?: Bus };
export const bus: Bus = globalForBus.__sseBus ?? (globalForBus.__sseBus = new Bus());

export function publishEvent(e: StreamEvent): void {
  bus.publish(e);
}
