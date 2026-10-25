import { useEffect } from "react";
import {
  PAGES,
  ROBOTS_INDEX,
  ROBOTS_NOINDEX,
  SITE,
  OG_IMAGE_URL,
  buildJsonLd,
  canonicalFor,
  serializeJsonLd,
  type PageKey,
} from "./site";

function upsertMeta(attr: "name" | "property", key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(
    `meta[${attr}="${key}"]`,
  );
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function upsertCanonical(href: string | null) {
  let el = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (href === null) {
    el?.remove();
    return;
  }
  if (!el) {
    el = document.createElement("link");
    el.rel = "canonical";
    document.head.appendChild(el);
  }
  el.href = href;
}

function upsertJsonLd(data: unknown | null) {
  let el = document.head.querySelector<HTMLScriptElement>(
    'script[type="application/ld+json"]',
  );
  if (data === null) {
    el?.remove();
    return;
  }
  if (!el) {
    el = document.createElement("script");
    el.type = "application/ld+json";
    document.head.appendChild(el);
  }
  el.textContent = serializeJsonLd(data);
}

/**
 * Keeps <title>, description, canonical, robots, Open Graph, Twitter Card and
 * JSON-LD in sync with the current route during client-side navigation.
 * (The first load is already covered by the static HTML, see vite.config.ts.)
 */
export function useSeo(page: PageKey): void {
  useEffect(() => {
    const p = PAGES[page];
    const noindex = p.noindex === true;
    const url = canonicalFor(page);

    document.title = p.title;
    upsertMeta("name", "description", p.description);
    upsertMeta("name", "robots", noindex ? ROBOTS_NOINDEX : ROBOTS_INDEX);
    upsertCanonical(noindex ? null : url);

    upsertMeta("property", "og:title", p.title);
    upsertMeta("property", "og:description", p.description);
    upsertMeta("property", "og:url", url);
    upsertMeta("property", "og:image", OG_IMAGE_URL);
    upsertMeta("name", "twitter:title", p.title);
    upsertMeta("name", "twitter:description", p.description);
    upsertMeta("name", "twitter:image", OG_IMAGE_URL);
    upsertMeta("name", "twitter:image:alt", SITE.ogImageAlt);

    upsertJsonLd(
      page === "home" || page === "about" ? buildJsonLd(page) : null,
    );
  }, [page]);
}
