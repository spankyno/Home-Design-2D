/**
 * Cloudflare Worker API for Floor Plan Designer
 * Routes: GET /api/healthz, POST /api/send-plan
 *
 * Secrets (wrangler secret put):
 *   RESEND_API_KEY, EMAIL_API_KEY
 * Vars (wrangler.toml or dashboard):
 *   EMAIL_FROM, ALLOWED_ORIGINS, EMAIL_RATE_LIMIT, EMAIL_RATE_WINDOW_MS
 */

export interface Env {
  RESEND_API_KEY: string;
  EMAIL_API_KEY: string;
  EMAIL_FROM?: string;
  ALLOWED_ORIGINS?: string;
  EMAIL_RATE_LIMIT?: string;
  EMAIL_RATE_WINDOW_MS?: string;
}

const MAX_PDF_BYTES = 10 * 1024 * 1024;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function json(data: unknown, status = 200, extraHeaders: HeadersInit = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...extraHeaders,
    },
  });
}

function corsHeaders(env: Env, request: Request): Record<string, string> {
  const origin = request.headers.get("Origin") ?? "";
  const allowed = (env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-API-Key",
    "Access-Control-Max-Age": "86400",
  };

  if (allowed.length === 0) {
    // Misconfigured production: do not reflect arbitrary origins
    return headers;
  }
  if (allowed.includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Vary"] = "Origin";
  }
  return headers;
}

function clientIp(request: Request): string {
  return (
    request.headers.get("CF-Connecting-IP") ||
    request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

function extractApiKey(request: Request): string | undefined {
  const h = request.headers.get("X-API-Key");
  if (h) return h;
  const auth = request.headers.get("Authorization");
  if (auth && auth.toLowerCase().startsWith("bearer ")) {
    return auth.slice(7).trim();
  }
  return undefined;
}

/** In-memory rate limit (per isolate). For stronger limits use Durable Objects. */
const rateBuckets = new Map<string, number[]>();

function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): { allowed: boolean; remaining: number; retryAfterSec: number } {
  const now = Date.now();
  let ts = rateBuckets.get(key) ?? [];
  ts = ts.filter((t) => now - t < windowMs);
  if (ts.length >= limit) {
    rateBuckets.set(key, ts);
    const retryAfterSec = Math.max(1, Math.ceil((ts[0]! + windowMs - now) / 1000));
    return { allowed: false, remaining: 0, retryAfterSec };
  }
  ts.push(now);
  rateBuckets.set(key, ts);
  return { allowed: true, remaining: limit - ts.length, retryAfterSec: 0 };
}

async function handleSendPlan(request: Request, env: Env, cors: Record<string, string>): Promise<Response> {
  if (!env.EMAIL_API_KEY) {
    return json({ ok: false, error: "Email service is not configured" }, 503, cors);
  }
  const provided = extractApiKey(request);
  if (!provided || provided !== env.EMAIL_API_KEY) {
    return json({ ok: false, error: "Unauthorized" }, 401, cors);
  }

  if (!env.RESEND_API_KEY) {
    return json({ ok: false, error: "Email service is not configured" }, 503, cors);
  }

  const limit = Number(env.EMAIL_RATE_LIMIT ?? 5);
  const windowMs = Number(env.EMAIL_RATE_WINDOW_MS ?? 15 * 60 * 1000);
  const rl = checkRateLimit(`email:${clientIp(request)}`, limit, windowMs);
  const rateHeaders = {
    ...cors,
    "X-RateLimit-Remaining": String(rl.remaining),
  };
  if (!rl.allowed) {
    return json(
      { ok: false, error: "Too many requests. Please try again later." },
      429,
      { ...rateHeaders, "Retry-After": String(rl.retryAfterSec) },
    );
  }

  let body: {
    to?: string;
    message?: string | null;
    pdfBase64?: string;
    filename?: string | null;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ ok: false, error: "Invalid request" }, 400, rateHeaders);
  }

  const to = typeof body.to === "string" ? body.to.trim() : "";
  const pdfBase64 = typeof body.pdfBase64 === "string" ? body.pdfBase64 : "";
  const message = typeof body.message === "string" ? body.message : null;
  const filename = typeof body.filename === "string" ? body.filename : null;

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to) && to.length <= 254;
  if (!emailOk || to.includes("\n") || to.includes("\r")) {
    return json({ ok: false, error: "Invalid request" }, 400, rateHeaders);
  }
  if (!pdfBase64 || !/^[A-Za-z0-9+/=\r\n]+$/.test(pdfBase64)) {
    return json({ ok: false, error: "Invalid PDF data" }, 400, rateHeaders);
  }
  if ((pdfBase64.length * 3) / 4 > MAX_PDF_BYTES) {
    return json(
      { ok: false, error: "PDF is too large to send by email (max 10 MB)" },
      400,
      rateHeaders,
    );
  }
  if (message && message.length > 2000) {
    return json(
      { ok: false, error: "Message is too long (max 2000 characters)" },
      400,
      rateHeaders,
    );
  }

  const safeName = (filename ?? "floorplan.pdf").replace(/[^\w.-]/g, "_").slice(0, 100);
  const note = message?.trim()
    ? `<p style="white-space:pre-wrap">${escapeHtml(message.trim())}</p>`
    : "";
  const html =
    `<div style="font-family:Inter,Arial,sans-serif;color:#111">` +
    `<h2 style="font-weight:600">Floor plan attached</h2>` +
    note +
    `<p style="color:#666;font-size:13px">Sent from the Floor Plan Editor.</p>` +
    `</div>`;

  const from = env.EMAIL_FROM ?? "Floor Plan <onboarding@resend.dev>";

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject: "Your floor plan",
        html,
        attachments: [{ filename: safeName, content: pdfBase64 }],
      }),
    });

    if (!response.ok) {
      console.error("resend failed", response.status);
      return json(
        { ok: false, error: "Could not send email. Please try again later." },
        502,
        rateHeaders,
      );
    }
    return json({ ok: true }, 200, rateHeaders);
  } catch (e) {
    console.error("resend request failed", e);
    return json(
      { ok: false, error: "Could not reach the email service" },
      502,
      rateHeaders,
    );
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const cors = corsHeaders(env, request);
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    if (url.pathname === "/api/healthz" || url.pathname === "/healthz") {
      return json({ status: "ok" }, 200, cors);
    }

    if (
      (url.pathname === "/api/send-plan" || url.pathname === "/send-plan") &&
      request.method === "POST"
    ) {
      return handleSendPlan(request, env, cors);
    }

    return json({ ok: false, error: "Not found" }, 404, cors);
  },
};
