/**
 * Small in-memory rate limiter for abuse-prone endpoints (sign-up, creating rooms, AI calls...).
 * It is per server instance, so it is a speed bump rather than a wall, but it stops casual flooding.
 */
import { getRequest } from "@tanstack/react-start/server";

const buckets = new Map<string, { count: number; resetAt: number }>();

/** Best-effort caller address. On Vercel the platform sets x-forwarded-for itself. */
export function clientIp(): string {
  try {
    const req = getRequest();
    const fwd = req?.headers.get("x-forwarded-for");
    if (fwd) return fwd.split(",")[0]!.trim();
    return req?.headers.get("x-real-ip") ?? "unknown";
  } catch {
    return "unknown";
  }
}

/** Throws a friendly error once `key` was used more than `limit` times inside `windowMs`. */
export function rateLimit(
  action: string,
  limit: number,
  windowMs: number,
  extraKey?: string,
): void {
  const key = `${action}:${extraKey ?? clientIp()}`;
  const now = Date.now();
  const hit = buckets.get(key);
  if (!hit || hit.resetAt <= now) {
    if (buckets.size > 20000) {
      for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
      if (buckets.size > 20000) buckets.clear();
    }
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }
  hit.count += 1;
  if (hit.count > limit) {
    const err = new Error("Too many requests. Please wait a moment and try again.");
    err.name = "GameError";
    throw err;
  }
}
