import { useState } from "react";
import { X, Mail } from "lucide-react";
import { useStore } from "../store";
import { buildPdfBase64 } from "../lib/exporters";

/**
 * API base:
 * - VITE_API_URL: absolute URL of the API (Cloudflare Worker), e.g. https://floorplan-api.xxx.workers.dev
 * - Otherwise same-origin relative path (Express reverse-proxy or Pages Functions)
 */
const API_BASE = (
  import.meta.env.VITE_API_URL
    ? String(import.meta.env.VITE_API_URL).replace(/\/$/, "")
    : `${import.meta.env.BASE_URL}api`.replace(/\/?$/, "")
);

/** Optional public API key for the email endpoint (pair with EMAIL_API_KEY on the server). */
const API_KEY = (import.meta.env.VITE_EMAIL_API_KEY as string | undefined) ?? "";

type Status = "idle" | "sending" | "sent" | "error";

export default function EmailDialog({ onClose }: { onClose: () => void }) {
  const { doc, settings } = useStore();
  const [to, setTo] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to.trim());

  const send = async () => {
    if (!valid || status === "sending") return;
    setStatus("sending");
    setError(null);
    try {
      const pdfBase64 = await buildPdfBase64(doc, settings);
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (API_KEY) {
        headers["X-API-Key"] = API_KEY;
      }
      const res = await fetch(`${API_BASE}/send-plan`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          to: to.trim(),
          message: message.trim() ? message.trim() : null,
          pdfBase64,
          filename: "floorplan.pdf",
        }),
      });
      const data = (await res.json().catch(() => null)) as {
        ok?: boolean;
        error?: string | null;
      } | null;
      if (!res.ok || !data?.ok) {
        setStatus("error");
        if (res.status === 429) {
          setError("Demasiados intentos. Espera unos minutos e inténtalo de nuevo.");
        } else if (res.status === 401) {
          setError("No autorizado. Revisa la configuración del servicio de email.");
        } else if (res.status === 413 || data?.error?.includes("too large")) {
          setError(
            "El PDF del plano ocupa demasiado para enviarlo. Prueba a simplificar el plano.",
          );
        } else {
          setError(
            data?.error && data.error.length < 120
              ? data.error
              : `No se pudo enviar el correo (${res.status}). Revisa la dirección e inténtalo de nuevo.`,
          );
        }
        return;
      }
      setStatus("sent");
    } catch {
      setStatus("error");
      setError("No se pudo conectar con el servidor.");
    }
  };

  return (
    <div className="modal-overlay" onMouseDown={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-label="Enviar plano por correo"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <div className="modal-title">
            <Mail size={15} strokeWidth={1.75} />
            Enviar plano por correo
          </div>
          <button className="tb-btn" onClick={onClose} aria-label="Cerrar">
            <X size={15} strokeWidth={1.75} />
          </button>
        </div>

        {status === "sent" ? (
          <div className="modal-body">
            <p className="modal-success">
              Enviado. El PDF del plano se ha enviado correctamente.
            </p>
            <div className="modal-actions">
              <button className="modal-primary" onClick={onClose}>
                Cerrar
              </button>
            </div>
          </div>
        ) : (
          <div className="modal-body">
            <label className="modal-label" htmlFor="email-to">
              Destinatario
            </label>
            <input
              id="email-to"
              className="modal-input"
              type="email"
              autoComplete="email"
              placeholder="nombre@ejemplo.com"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void send();
              }}
            />
            <label className="modal-label" htmlFor="email-message">
              Mensaje (opcional)
            </label>
            <textarea
              id="email-message"
              className="modal-input modal-textarea"
              placeholder="Escribe una nota breve para el destinatario…"
              value={message}
              rows={3}
              onChange={(e) => setMessage(e.target.value)}
            />
            {error && <p className="modal-error">{error}</p>}
            <div className="modal-actions">
              <button className="modal-secondary" onClick={onClose}>
                Cancelar
              </button>
              <button
                className="modal-primary"
                disabled={!valid || status === "sending"}
                onClick={() => void send()}
              >
                {status === "sending" ? "Enviando…" : "Enviar PDF"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
