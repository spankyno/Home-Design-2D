/**
 * Simple in-memory sliding-window rate limiter.
 * Suitable for a single Node process. On multi-instance deploys use Redis / Durable Objects.
 */

type Entry = { timestamps: number[] };

const store = new Map<string, Entry>();

export interface RateLimitOptions {
  /** Max requests allowed in the window */
  limit: number;
  /** Window size in milliseconds */
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number;
}

export function checkRateLimit(
  key: string,
  { limit, windowMs }: RateLimitOptions,
): RateLimitResult {
  const now = Date.now();
  let entry = store.get(key);
  if (!entry) {
    entry = { timestamps: [] };
    store.set(key, entry);
  }

  // Drop timestamps outside the window
  entry.timestamps = entry.timestamps.filter((t) => now - t < windowMs);

  if (entry.timestamps.length >= limit) {
    const oldest = entry.timestamps[0]!;
    const retryAfterSec = Math.ceil((oldest + windowMs - now) / 1000);
    return { allowed: false, remaining: 0, retryAfterSec: Math.max(1, retryAfterSec) };
  }

  entry.timestamps.push(now);
  return {
    allowed: true,
    remaining: limit - entry.timestamps.length,
    retryAfterSec: 0,
  };
}

/** Periodic cleanup to avoid unbounded Map growth */
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    entry.timestamps = entry.timestamps.filter((t) => now - t < 60 * 60 * 1000);
    if (entry.timestamps.length === 0) store.delete(key);
  }
}, 10 * 60 * 1000).unref?.();
