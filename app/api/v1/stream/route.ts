import { bus } from "@/lib/sse";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const send = (data: unknown) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          // controller closed
        }
      };
      send({ kind: "connected", ts: new Date().toISOString() });
      // Replay the last ~50 events so a fresh subscriber sees recent activity
      // (algorithm starts/stops, fills, exits) instead of an empty stream.
      // Guarded in case HMR holds a stale Bus instance without `recent`.
      const recent =
        typeof bus.recent === "function" ? bus.recent() : [];
      for (const ev of recent) {
        send({ ...ev, replay: true });
      }
      const unsub = bus.subscribe(send);
      const ping = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          clearInterval(ping);
        }
      }, 15000);
      const cleanup = () => {
        unsub();
        clearInterval(ping);
        try {
          controller.close();
        } catch {
          // already closed
        }
      };
      // Hook into stream cancellation (best-effort)
      (controller as unknown as { _cleanup?: () => void })._cleanup = cleanup;
    },
    cancel() {
      // listeners cleaned up via close path
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
