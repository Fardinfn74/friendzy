/**
 * Tells everyone in a room "something changed, fetch the new state now" using Supabase Realtime Broadcast.
 *
 * Players still poll as a safety net, but with this push a move shows up on the other phone right away
 * instead of waiting for the next poll. Best-effort: a failure here must never break a game action.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/** On Vercel, keep the function alive long enough to finish the push after the response is sent. */
function keepAlive(work: Promise<unknown>) {
  try {
    const ctx = (globalThis as Record<symbol, unknown>)[Symbol.for("@vercel/request-context")] as
      | { get?: () => { waitUntil?: (p: Promise<unknown>) => void } | undefined }
      | undefined;
    ctx?.get?.()?.waitUntil?.(work);
  } catch {
    /* not on Vercel */
  }
}

export function notifyRoom(code: string): void {
  const topic = `room:${code.trim().toUpperCase()}`;
  const work = (async () => {
    const channel = supabaseAdmin.channel(topic);
    try {
      const payload = { t: Date.now() };
      const maybeHttp = (channel as unknown as { httpSend?: (e: string, p: unknown) => Promise<unknown> }).httpSend;
      const send =
        typeof maybeHttp === "function"
          ? maybeHttp.call(channel, "tick", payload)
          : channel.send({ type: "broadcast", event: "tick", payload });
      await Promise.race([send, new Promise((resolve) => setTimeout(resolve, 3000))]);
    } finally {
      await supabaseAdmin.removeChannel(channel).catch(() => {});
    }
  })().catch(() => {});
  keepAlive(work);
}
