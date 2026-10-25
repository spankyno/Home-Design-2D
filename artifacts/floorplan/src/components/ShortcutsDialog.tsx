import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { SHORTCUT_GROUPS } from "../lib/shortcuts";

export default function ShortcutsDialog({ onClose }: { onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "?") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  return (
    <div
      className="modal-backdrop"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label="Atajos de teclado"
      >
        <div className="modal-head">
          <h2>Atajos de teclado</h2>
          <button
            ref={closeRef}
            className="modal-close"
            onClick={onClose}
            aria-label="Cerrar"
          >
            <X size={16} />
          </button>
        </div>
        <div className="modal-body">
          {SHORTCUT_GROUPS.map((g) => (
            <section key={g.title} className="sc-group">
              <h3>{g.title}</h3>
              <ul>
                {g.items.map((it) => (
                  <li key={it.label}>
                    <span className="sc-label">{it.label}</span>
                    <span className="sc-keys">
                      {it.keys.map((k, i) => (
                        <kbd key={i}>{k}</kbd>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
