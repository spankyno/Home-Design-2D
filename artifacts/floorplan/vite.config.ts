import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

const port = Number(process.env.PORT ?? 5173);
if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${process.env.PORT}"`);
}

// Cloudflare Pages and most static hosts use "/"
const basePath = process.env.BASE_PATH ?? "/";

async function loadReplitPlugins() {
  if (process.env.NODE_ENV === "production" || process.env.REPL_ID === undefined) {
    return [];
  }
  const plugins: unknown[] = [];
  try {
    const runtimeErrorOverlay = (await import("@replit/vite-plugin-runtime-error-modal")).default;
    plugins.push(runtimeErrorOverlay());
  } catch {
    /* optional */
  }
  try {
    const { cartographer } = await import("@replit/vite-plugin-cartographer");
    plugins.push(
      cartographer({
        root: path.resolve(import.meta.dirname, ".."),
      }),
    );
  } catch {
    /* optional */
  }
  try {
    const { devBanner } = await import("@replit/vite-plugin-dev-banner");
    plugins.push(devBanner());
  } catch {
    /* optional */
  }
  return plugins;
}

export default defineConfig(async () => ({
  base: basePath,
  plugins: [react(), tailwindcss(), ...(await loadReplitPlugins())],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    port,
    strictPort: true,
    host: "0.0.0.0",
    allowedHosts: true,
    fs: {
      strict: true,
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
}));
