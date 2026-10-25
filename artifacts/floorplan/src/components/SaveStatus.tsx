import { useEffect, useState } from "react";
import { Check, LoaderCircle, TriangleAlert, X } from "lucide-react";
import { useStore } from "../store";
import { withExporters, reportExportError } from "../lib/lazyExporters";

/** Small status pill in the top bar: saved / saving / could not save. */
export function SaveIndicator() {
  const { saveStatus, retrySave } = useStore();
  if (saveStatus.kind === "error") {
    return (
      <button
        className="save-ind err"
        onClick={retrySave}
        data-tip="No se pudo guardar. Pulsa para reintentar"
        aria-live="assertive"
      >
        <TriangleAlert size={13} strokeWidth={2} />
        <span>Sin guardar</span>
      </button>
    );
  }
  return (
    <span className="save-ind" aria-live="polite">
      {saveStatus.kind === "saving" ? (
        <>
          <LoaderCircle size={13} strokeWidth={2} className="spin" />
          <span>Guardando…</span>
        </>
      ) : (
        <>
          <Check size={13} strokeWidth={2} />
          <span>Guardado</span>
        </>
      )}
    </span>
  );
}

/** Banner under the top bar for save failures and unreadable stored data. */
export function NoticeBanner() {
  const { saveStatus, retrySave, notice, dismissNotice, doc } = useStore();
  const [errDismissed, setErrDismissed] = useState(false);

  useEffect(() => {
    if (saveStatus.kind !== "error") setErrDismissed(false);
  }, [saveStatus.kind]);

  const isError = saveStatus.kind === "error" && !errDismissed;
  const message = isError
    ? (saveStatus as { message: string }).message
    : notice;
  if (!message) return null;

  return (
    <div className="notice-banner" role="alert">
      <TriangleAlert size={16} strokeWidth={2} />
      <span className="notice-text">{message}</span>
      {isError && (
        <button className="notice-btn" onClick={retrySave}>
          Reintentar
        </button>
      )}
      <button className="notice-btn" onClick={() =>
          withExporters((m) => m.exportJSON(doc)).catch(reportExportError)
        }
      >
        Exportar JSON
      </button>
      <button
        className="notice-close"
        aria-label="Cerrar aviso"
        onClick={() => (isError ? setErrDismissed(true) : dismissNotice())}
      >
        <X size={14} />
      </button>
    </div>
  );
}
