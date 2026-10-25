import { Maximize, Minus, Plus } from "lucide-react";
import { useStore } from "../store";

/** Floating zoom buttons: zoom out / current % (click = 100 %) / zoom in / fit. */
export default function ZoomControls() {
  const { view, zoomBy, zoomReset, fitView } = useStore();
  return (
    <div className="zoom-controls" role="group" aria-label="Zoom">
      <button
        onClick={() => zoomBy(1 / 1.25)}
        aria-label="Alejar"
        data-tip="Alejar (−)"
      >
        <Minus size={14} strokeWidth={2} />
      </button>
      <button
        className="zoom-pct"
        onClick={zoomReset}
        aria-label="Restablecer zoom al 100 %"
        data-tip="Zoom 100 % (0)"
      >
        {Math.round(view.z * 100)}%
      </button>
      <button
        onClick={() => zoomBy(1.25)}
        aria-label="Acercar"
        data-tip="Acercar (+)"
      >
        <Plus size={14} strokeWidth={2} />
      </button>
      <span className="zoom-sep" />
      <button
        onClick={fitView}
        aria-label="Ajustar a la vista"
        data-tip="Ajustar a la vista (F)"
      >
        <Maximize size={14} strokeWidth={2} />
      </button>
    </div>
  );
}
