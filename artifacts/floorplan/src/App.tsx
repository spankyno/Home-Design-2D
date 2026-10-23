import { useEffect, useRef } from "react";
import { StoreProvider, useStore } from "./store";
import Toolbar from "./components/Toolbar";
import CanvasView from "./components/CanvasView";
import PropertiesPanel from "./components/PropertiesPanel";
import PageFooter from "./components/PageFooter";
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
} from "lucide-react";
import {
  exportJSON,
  exportPNG,
  exportPDF,
  importJSON,
} from "./lib/exporters";

function TopBar() {
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
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const next = importJSON(String(reader.result));
        replaceDoc(next);
      } catch {
        alert("No se pudo importar: el archivo JSON del plano no es válido.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  return (
    <div className="topbar">
      <div className="brand">Plano</div>

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
          className={`tb-toggle${settings.lockJoints ? " on" : ""}`}
          onClick={() => setSettings({ lockJoints: !settings.lockJoints })}
          data-tip="Bloquear uniones"
        >
          <Lock size={16} strokeWidth={1.75} />
        </button>
      </div>

      <div className="tb-spacer" />

      <div className="tb-group">
        <button
          className="tb-btn"
          onClick={() => void exportPNG(doc, settings)}
          data-tip="Exportar PNG"
        >
          <Download size={16} strokeWidth={1.75} />
          <span className="tb-label">PNG</span>
        </button>
        <button
          className="tb-btn"
          onClick={() => void exportPDF(doc, settings)}
          data-tip="Exportar PDF"
        >
          <Download size={16} strokeWidth={1.75} />
          <span className="tb-label">PDF</span>
        </button>
        <button
          className="tb-btn"
          onClick={() => exportJSON(doc)}
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

function Shortcuts() {
  const {
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
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
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
      switch (e.key.toLowerCase()) {
        case "v":
          setTool("select");
          break;
        case "w":
          setTool("wall");
          break;
        case "d":
          setTool("door");
          break;
        case "n":
          setTool("window");
          break;
        case "t":
          setTool("text");
          break;
        case "m":
          setTool("measure");
          break;
        case "x":
          setTool("delete");
          break;
        case "delete":
        case "backspace":
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
  return (
    <div className="app">
      <TopBar />
      <div className="main">
        <Toolbar />
        <CanvasView />
        <PropertiesPanel />
      </div>
      <UnitSwitch />
      <Shortcuts />
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
