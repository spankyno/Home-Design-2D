import { createRoot } from "react-dom/client";
// Self-hosted Inter (no request to Google Fonts: privacy + strict CSP).
import "@fontsource/inter/latin-400.css";
import "@fontsource/inter/latin-500.css";
import "@fontsource/inter/latin-600.css";
import "@fontsource/inter/latin-ext-400.css";
import "@fontsource/inter/latin-ext-500.css";
import "@fontsource/inter/latin-ext-600.css";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);
