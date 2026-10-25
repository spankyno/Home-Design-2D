import { useEffect, useRef, useState } from "react";
import { StoreProvider, useStore } from "./store";
import Toolbar from "./components/Toolbar";
import CanvasView from "./components/CanvasView";
import PropertiesPanel from "./components/PropertiesPanel";
import PageFooter from "./components/PageFooter";
import ZoomControls from "./components/ZoomControls";
import ShortcutsDialog from "./components/ShortcutsDialog";
import { SaveIndicator, NoticeBanner } from "./components/SaveStatus";
import { toolForKey } from "./lib/shortcuts";
import { useSeo } from "./lib/useSeo";
import { ImportError, MAX_IMPORT_BYTES } from "./lib/schema";
import AcercaDe from "./pages/AcercaDe";
import { Route, Switch } from "wouter";
import {
  Undo2,
  Redo2,
  Grid3x3,
  Tag,
  Magnet,
  Lock,
  Download,
  Upload,
  Trash,
  Crosshair,
  Keyboard,
} from "lucide-react";
import { withExporters, reportExportError } from "./lib/lazyExporters";

function TopBar({ onHelp }: { onHelp: () => void }) {
  const {
    settings,
    setSettings,
    undo,
    redo,
    canUndo,
    canRedo,
    doc,
    replaceDoc,
    clearAll,
  } = useStore();
  const fileRef = useRef<HTMLInputElement>(null);

  const onImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > MAX_IMPORT_BYTES) {
      alert("No se pudo importar: el archivo es demasiado grande (máx. 10 MB).");
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => alert("No se pudo leer el archivo.");
    reader.onload = () => {
      // Validated first: the current plan is only replaced if the file is OK.
      withExporters((m) => m.importJSON(String(reader.result)))
        .then((imported) => replaceDoc(imported))
        .catch((err: unknown) => {
          if (err instanceof ImportError) {
            alert(
              `No se pudo importar: ${err.message}` +
                (err.details.length
                  ? `\n\n${err.details.map((d) => `• ${d}`).join("\n")}`
                  : "") +
                "\n\nTu plano actual no se ha modificado.",
            );
          } else {
            alert(
              "No se pudo importar el archivo. Tu plano actual no se ha modificado.",
            );
          }
        });
    };
    reader.readAsText(file);
  };

  return (
    <div className="topbar">
      <div className="brand">Plano</div>
      <SaveIndicator />

      <div className="tb-group">
        <button
          className="tb-btn"
          onClick={undo}
          disabled={!canUndo}
          data-tip="Deshacer (Ctrl+Z)"
        >
          <Undo2 size={16} strokeWidth={1.75} />
        </button>
        <button
          className="tb-btn"
          onClick={redo}
          disabled={!canRedo}
          data-tip="Rehacer (Ctrl+Y)"
        >
          <Redo2 size={16} strokeWidth={1.75} />
        </button>
      </div>

      <div className="tb-group">
        <button
          className={`tb-toggle${settings.gridVisible ? " on" : ""}`}
          onClick={() => setSettings({ gridVisible: !settings.gridVisible })}
          data-tip="Cuadrícula"
        >
          <Grid3x3 size={16} strokeWidth={1.75} />
        </button>
        <button
          className={`tb-toggle${settings.labelsVisible ? " on" : ""}`}
          onClick={() => setSettings({ labelsVisible: !settings.labelsVisible })}
          data-tip="Cotas"
        >
          <Tag size={16} strokeWidth={1.75} />
        </button>
        <button
          className={`tb-toggle${settings.angleSnap ? " on" : ""}`}
          onClick={() => setSettings({ angleSnap: !settings.angleSnap })}
          data-tip="Ajustar ángulos (0/45/90)"
        >
          <Magnet size={16} strokeWidth={1.75} />
        </button>
        <button
          className={`tb-toggle${settings.gridSnap ? " on" : ""}`}
          onClick={() => setSettings({ gridSnap: !settings.gridSnap })}
          data-tip="Ajustar a la cuadrícula"
        >
          <Grid3x3 size={16} strokeWidth={1.75} />
          <span className="dot" />
        </button>
        <button
          className={`tb-toggle${settings.smartGuides ? " on" : ""}`}
          onClick={() => setSettings({ smartGuides: !settings.smartGuides })}
          data-tip="Guías de alineación"
          aria-label="Guías de alineación"
        >
          <Crosshair size={16} strokeWidth={1.75} />
        </button>
        <button
          className={`tb-toggle${settings.lockJoints ? " on" : ""}`}
          onClick={() => setSettings({ lockJoints: !settings.lockJoints })}
          data-tip="Bloquear uniones"
        >
          <Lock size={16} strokeWidth={1.75} />
        </button>
      </div>

      <div className="tb-group">
        <button
          className="tb-btn"
          onClick={onHelp}
          data-tip="Atajos de teclado (?)"
          aria-label="Atajos de teclado"
        >
          <Keyboard size={16} strokeWidth={1.75} />
        </button>
      </div>

      <div className="tb-spacer" />

      <div className="tb-group">
        <button
          className="tb-btn"
          onClick={() => withExporters((m) => m.exportPNG(doc, settings)).catch(reportExportError)}
          data-tip="Exportar PNG"
        >
          <Download size={16} strokeWidth={1.75} />
          <span className="tb-label">PNG</span>
        </button>
        <button
          className="tb-btn"
          onClick={() => withExporters((m) => m.exportPDF(doc, settings)).catch(reportExportError)}
          data-tip="Exportar PDF"
        >
          <Download size={16} strokeWidth={1.75} />
          <span className="tb-label">PDF</span>
        </button>
        <button
          className="tb-btn"
          onClick={() => withExporters((m) => m.exportJSON(doc)).catch(reportExportError)}
          data-tip="Exportar JSON"
        >
          <Download size={16} strokeWidth={1.75} />
          <span className="tb-label">JSON</span>
        </button>
        <button
          className="tb-btn"
          onClick={() => fileRef.current?.click()}
          data-tip="Importar JSON"
        >
          <Upload size={16} strokeWidth={1.75} />
          <span className="tb-label">Importar</span>
        </button>
        <button
          className="tb-btn"
          onClick={() => {
            if (confirm("¿Quieres borrar todo el plano?")) clearAll();
          }}
          data-tip="Borrar todo"
        >
          <Trash size={16} strokeWidth={1.75} />
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={onImport}
        />
      </div>
    </div>
  );
}

function Shortcuts({ onHelp }: { onHelp: () => void }) {
  const {
    tool,
    zoomBy,
    zoomReset,
    fitView,
    undo,
    redo,
    setTool,
    deleteById,
    deleteMany,
    copySelection,
    pasteClipboard,
    selection,
    multiSelection,
  } = useStore();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (
        t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.tagName === "SELECT" ||
          t.isContentEditable)
      )
        return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
        return;
      }
      if (mod && e.key.toLowerCase() === "c") {
        e.preventDefault();
        copySelection();
        return;
      }
      if (mod && e.key.toLowerCase() === "v") {
        e.preventDefault();
        pasteClipboard();
        return;
      }
      if (mod) return;
      const toolKey = toolForKey(e.key);
      if (toolKey) {
        setTool(toolKey);
        return;
      }
      switch (e.key.toLowerCase()) {
        case "?":
          onHelp();
          break;
        case "+":
        case "=":
          zoomBy(1.25);
          break;
        case "-":
        case "_":
          zoomBy(1 / 1.25);
          break;
        case "0":
          zoomReset();
          break;
        case "f":
          fitView();
          break;
        case "delete":
        case "backspace":
          // In the area tool Backspace removes the last vertex instead.
          if (tool === "area") break;
          if (multiSelection.length > 0) {
            deleteMany(multiSelection);
          } else if (selection && selection.type !== "room") {
            deleteById(selection.type, selection.id);
          }
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    tool,
    zoomBy,
    zoomReset,
    fitView,
    onHelp,
    undo,
    redo,
    setTool,
    deleteById,
    deleteMany,
    copySelection,
    pasteClipboard,
    selection,
    multiSelection,
  ]);
  return null;
}

function UnitSwitch() {
  const { settings, setSettings } = useStore();
  return (
    <div className="unit-switch unit-switch-floating">
      <button
        className={settings.unit === "cm" ? "on" : ""}
        onClick={() => setSettings({ unit: "cm" })}
      >
        cm
      </button>
      <button
        className={settings.unit === "in" ? "on" : ""}
        onClick={() => setSettings({ unit: "in" })}
      >
        pulg
      </button>
    </div>
  );
}

function Workspace() {
  useSeo("home");
  const [helpOpen, setHelpOpen] = useState(false);
  const toggleHelp = () => setHelpOpen((o) => !o);
  return (
    <div className="app">
      <h1 className="visually-hidden">
        Home Design 2D: editor de planos 2D online
      </h1>
      <TopBar onHelp={toggleHelp} />
      <NoticeBanner />
      <div className="main">
        <Toolbar />
        <CanvasView />
        <PropertiesPanel />
      </div>
      <ZoomControls />
      <UnitSwitch />
      <Shortcuts onHelp={toggleHelp} />
      {helpOpen && <ShortcutsDialog onClose={() => setHelpOpen(false)} />}
      <PageFooter />
    </div>
  );
}

function EditorPage() {
  useEffect(() => {
    document.title = "Editor de planos";
    const description = document.querySelector<HTMLMetaElement>(
      'meta[name="description"]',
    );
    if (description) {
      description.content =
        "Dibuja y edita planos con precisión. Añade mobiliario y texto, personaliza su apariencia y exporta el resultado.";
    }
  }, []);

  return (
    <StoreProvider>
      <Workspace />
    </StoreProvider>
  );
}

function NotFoundPage() {
  useSeo("notFound");
  return (
    <main className="route-not-found">
      <p>404 / Plano no encontrado</p>
      <h1>Esta página no está en el plano.</h1>
      <a href="/">Volver al editor</a>
    </main>
  );
}

export default function App() {
  return (
    <Switch>
      <Route path="/" component={EditorPage} />
      <Route path="/acerca-de" component={AcercaDe} />
      <Route component={NotFoundPage} />
    </Switch>
  );
}
