import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import fs from "node:fs";
import type { Plugin } from "vite";
import {
  PAGES,
  SITE,
  OG_IMAGE_URL,
  buildJsonLd,
  canonicalFor,
  serializeJsonLd,
} from "./src/lib/site";

const port = Number(process.env.PORT ?? 5173);
if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${process.env.PORT}"`);
}

// Cloudflare Pages and most static hosts use "/"
const basePath = process.env.BASE_PATH ?? "/";

const escAttr = (v: string) =>
  v.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

/** Replace the first match of `re` or fail the build (never ship a half-patched page). */
function patch(html: string, re: RegExp, replacement: string, label: string): string {
  if (!re.test(html)) {
    throw new Error(`[seo-pages] tag not found in index.html: ${label}`);
  }
  return html.replace(re, () => replacement);
}

/**
 * Static per-route SEO. The app is a SPA, but crawlers and link-preview bots
 * (Facebook, X, LinkedIn, WhatsApp…) do not run JavaScript, so /acerca-de needs
 * its own HTML with the right <title>, description, canonical, Open Graph and
 * JSON-LD. Cloudflare Pages serves acerca-de.html at /acerca-de.
 * Also emits sitemap.xml.
 */
function seoPages(): Plugin {
  let outDir = "";
  return {
    name: "seo-pages",
    apply: "build",
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      const indexPath = path.join(outDir, "index.html");
      let html = fs.readFileSync(indexPath, "utf8");
      const about = PAGES.about;
      const url = canonicalFor("about");
      const t = escAttr(about.title);
      const d = escAttr(about.description);

      html = patch(html, /<title>[\s\S]*?<\/title>/, `<title>${escAttr(about.title)}</title>`, "title");
      html = patch(html, /<meta name="description" content="[^"]*" \/>/, `<meta name="description" content="${d}" />`, "description");
      html = patch(html, /<link rel="canonical" href="[^"]*" \/>/, `<link rel="canonical" href="${url}" />`, "canonical");
      html = patch(html, /<link rel="alternate" hreflang="es" href="[^"]*" \/>/, `<link rel="alternate" hreflang="es" href="${url}" />`, "hreflang es");
      html = patch(html, /<link rel="alternate" hreflang="x-default" href="[^"]*" \/>/, `<link rel="alternate" hreflang="x-default" href="${url}" />`, "hreflang x-default");
      html = patch(html, /<meta property="og:url" content="[^"]*" \/>/, `<meta property="og:url" content="${url}" />`, "og:url");
      html = patch(html, /<meta property="og:title" content="[^"]*" \/>/, `<meta property="og:title" content="${t}" />`, "og:title");
      html = patch(html, /<meta property="og:description" content="[^"]*" \/>/, `<meta property="og:description" content="${d}" />`, "og:description");
      html = patch(html, /<meta name="twitter:title" content="[^"]*" \/>/, `<meta name="twitter:title" content="${t}" />`, "twitter:title");
      html = patch(html, /<meta name="twitter:description" content="[^"]*" \/>/, `<meta name="twitter:description" content="${d}" />`, "twitter:description");
      html = patch(
        html,
        /<script type="application\/ld\+json">[\s\S]*?<\/script>/,
        `<script type="application/ld+json">\n${serializeJsonLd(buildJsonLd("about"))}\n    </script>`,
        "ld+json",
      );
      html = patch(
        html,
        /<noscript>[\s\S]*?<\/noscript>/,
        `<noscript><main><h1>Acerca de Home Design 2D</h1><p>${d}</p><p><a href="/">Ir al editor de planos</a></p></main></noscript>`,
        "noscript",
      );
      fs.writeFileSync(path.join(outDir, "acerca-de.html"), html);

      const lastmod = new Date().toISOString().slice(0, 10);
      const entries = [
        { loc: canonicalFor("home"), priority: "1.0", image: true },
        { loc: url, priority: "0.6", image: false },
      ];
      const xml =
        `<?xml version="1.0" encoding="UTF-8"?>\n` +
        `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n` +
        entries
          .map(
            (e) =>
              `  <url>\n    <loc>${e.loc}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>${e.priority}</priority>\n` +
              (e.image
                ? `    <image:image>\n      <image:loc>${OG_IMAGE_URL}</image:loc>\n      <image:title>${escAttr(SITE.name)}</image:title>\n    </image:image>\n`
                : "") +
              `  </url>`,
          )
          .join("\n") +
        `\n</urlset>\n`;
      fs.writeFileSync(path.join(outDir, "sitemap.xml"), xml);
    },
  };
}

export default defineConfig({
  base: basePath,
  plugins: [react(), seoPages()],
  resolve: { dedupe: ["react", "react-dom"] },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: { port, strictPort: true },
  preview: { port },
});
