import { Router, type IRouter, type Request, type Response } from "express";
import { SendPlanEmailBody, SendPlanEmailResponse } from "@workspace/api-zod";
import { checkRateLimit } from "../lib/rateLimit";

const router: IRouter = Router();

const FROM = process.env.EMAIL_FROM ?? "Floor Plan <onboarding@resend.dev>";
const RESEND_API_KEY = process.env.RESEND_API_KEY ?? "";
/** Shared secret required in header X-API-Key (or Authorization: Bearer). Set in production. */
const EMAIL_API_KEY = process.env.EMAIL_API_KEY ?? "";
const MAX_PDF_BYTES = 10 * 1024 * 1024; // 10 MB decoded
const RATE_LIMIT = Number(process.env.EMAIL_RATE_LIMIT ?? 5);
const RATE_WINDOW_MS = Number(process.env.EMAIL_RATE_WINDOW_MS ?? 15 * 60 * 1000);

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function clientIp(req: Request): string {
  const xf = req.headers["x-forwarded-for"];
  if (typeof xf === "string" && xf.length > 0) {
    return xf.split(",")[0]!.trim();
  }
  return req.socket.remoteAddress ?? "unknown";
}

function extractApiKey(req: Request): string | undefined {
  const header = req.headers["x-api-key"];
  if (typeof header === "string" && header.length > 0) return header;
  const auth = req.headers.authorization;
  if (typeof auth === "string" && auth.toLowerCase().startsWith("bearer ")) {
    return auth.slice(7).trim();
  }
  return undefined;
}

function requireApiKey(req: Request, res: Response): boolean {
  if (!EMAIL_API_KEY) {
    if (process.env.NODE_ENV === "production") {
      res.status(503).json(
        SendPlanEmailResponse.parse({
          ok: false,
          error: "Email service is not configured",
        }),
      );
      return false;
    }
    return true;
  }
  const provided = extractApiKey(req);
  if (!provided || provided !== EMAIL_API_KEY) {
    res.status(401).json(
      SendPlanEmailResponse.parse({ ok: false, error: "Unauthorized" }),
    );
    return false;
  }
  return true;
}

router.post("/send-plan", async (req, res) => {
  if (!requireApiKey(req, res)) return;

  const ip = clientIp(req);
  const rl = checkRateLimit(`email:${ip}`, {
    limit: RATE_LIMIT,
    windowMs: RATE_WINDOW_MS,
  });
  res.setHeader("X-RateLimit-Remaining", String(rl.remaining));
  if (!rl.allowed) {
    res.setHeader("Retry-After", String(rl.retryAfterSec));
    res.status(429).json(
      SendPlanEmailResponse.parse({
        ok: false,
        error: "Too many requests. Please try again later.",
      }),
    );
    return;
  }

  if (!RESEND_API_KEY) {
    res.status(503).json(
      SendPlanEmailResponse.parse({
        ok: false,
        error: "Email service is not configured",
      }),
    );
    return;
  }

  const parsed = SendPlanEmailBody.safeParse(req.body);
  if (!parsed.success) {
    res
      .status(400)
      .json(SendPlanEmailResponse.parse({ ok: false, error: "Invalid request" }));
    return;
  }
  const { to, message, pdfBase64, filename } = parsed.data;

  if (to.length > 254 || to.includes("\n") || to.includes("\r")) {
    res
      .status(400)
      .json(SendPlanEmailResponse.parse({ ok: false, error: "Invalid request" }));
    return;
  }

  if (!/^[A-Za-z0-9+/=\r\n]+$/.test(pdfBase64)) {
    res
      .status(400)
      .json(SendPlanEmailResponse.parse({ ok: false, error: "Invalid PDF data" }));
    return;
  }
  if ((pdfBase64.length * 3) / 4 > MAX_PDF_BYTES) {
    res.status(400).json(
      SendPlanEmailResponse.parse({
        ok: false,
        error: "PDF is too large to send by email (max 10 MB)",
      }),
    );
    return;
  }

  if (message && message.length > 2000) {
    res.status(400).json(
      SendPlanEmailResponse.parse({
        ok: false,
        error: "Message is too long (max 2000 characters)",
      }),
    );
    return;
  }

  const safeName = (filename ?? "floorplan.pdf")
    .replace(/[^\w.-]/g, "_")
    .slice(0, 100);
  const note = message?.trim()
    ? `<p style="white-space:pre-wrap">${escapeHtml(message.trim())}</p>`
    : "";
  const html =
    `<div style="font-family:Inter,Arial,sans-serif;color:#111">` +
    `<h2 style="font-weight:600">Floor plan attached</h2>` +
    note +
    `<p style="color:#666;font-size:13px">Sent from the Floor Plan Editor.</p>` +
    `</div>`;

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM,
        to: [to],
        subject: "Your floor plan",
        html,
        attachments: [{ filename: safeName, content: pdfBase64 }],
      }),
    });

    if (!response.ok) {
      req.log.error({ status: response.status }, "resend send failed");
      res.status(502).json(
        SendPlanEmailResponse.parse({
          ok: false,
          error: "Could not send email. Please try again later.",
        }),
      );
      return;
    }

    req.log.info({ toDomain: to.split("@")[1] ?? "?" }, "plan email sent");
    res.json(SendPlanEmailResponse.parse({ ok: true }));
  } catch (e) {
    req.log.error({ err: e }, "resend request failed");
    res.status(502).json(
      SendPlanEmailResponse.parse({
        ok: false,
        error: "Could not reach the email service",
      }),
    );
  }
});

export default router;
