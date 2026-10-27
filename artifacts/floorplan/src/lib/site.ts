/**
 * Single source of truth for site-wide SEO data. Used by:
 *  - the runtime `useSeo` hook (client-side navigation),
 *  - the Vite `seo-pages` plugin (static acerca-de.html + sitemap.xml),
 *  - the footer / About page links,
 *  - tests/logic.test.ts (checks index.html stays in sync).
 * Keep this file free of browser APIs: it is also imported by vite.config.ts.
 */

export const SITE = {
  url: "https://home-design-2d.pages.dev",
  name: "Home Design 2D",
  lang: "es",
  locale: "es_ES",
  themeColor: "#142238",
  ogImage: "/og-image.png",
  ogImageWidth: 1200,
  ogImageHeight: 630,
  ogImageAlt:
    "Home Design 2D: editor de planos 2D online con un plano de planta dibujado sobre fondo azul marino",
} as const;

export const AUTHOR = {
  name: "Aitor Sánchez Gutiérrez",
  blog: "https://aitorsanchez.pages.dev",
  hub: "https://aitorhub.vercel.app",
  contact: "https://aitorsanchez.pages.dev/contacto",
} as const;

export type PageKey = "home" | "about" | "notFound";

interface PageSeo {
  path: string;
  title: string;
  description: string;
  noindex?: boolean;
}

export const PAGES: Record<PageKey, PageSeo> = {
  home: {
    path: "/",
    title: "Home Design 2D · Editor de planos 2D online",
    description:
      "Diseña planos 2D de casas y habitaciones en el navegador: paredes, puertas, ventanas, mobiliario y medición de longitud y área. Exporta a PNG, PDF o JSON.",
  },
  about: {
    path: "/acerca-de",
    title: "Acerca de Home Design 2D: funcionamiento y tecnología",
    description:
      "Cómo funciona Home Design 2D, el editor de planos online de Aitor Sánchez Gutiérrez: herramientas, tecnologías (React, TypeScript, Vite) y contacto.",
  },
  notFound: {
    path: "/404",
    title: "Página no encontrada · Home Design 2D",
    description: "La página que buscas no existe. Vuelve al editor de planos.",
    noindex: true,
  },
};

export const ROBOTS_INDEX =
  "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1";
export const ROBOTS_NOINDEX = "noindex, follow";

const absoluteUrl = (path: string): string =>
  path === "/" ? `${SITE.url}/` : `${SITE.url}${path}`;

/** Canonical URL for a page (home keeps the trailing slash). */
export const canonicalFor = (page: PageKey): string =>
  absoluteUrl(PAGES[page].path);

export const OG_IMAGE_URL = `${SITE.url}${SITE.ogImage}`;

const FEATURES = [
  "Dibujo de paredes con ajuste a cuadrícula y ángulos",
  "Puertas y ventanas sobre las paredes",
  "Biblioteca de mobiliario con color, degradado y efectos",
  "Textos editables",
  "Medición de longitudes y de áreas",
  "Alinear y distribuir objetos con guías inteligentes",
  "Deshacer y rehacer, y autoguardado en el navegador",
  "Exportación a PNG, PDF y JSON; importación de JSON validado",
];

const ID = {
  person: `${AUTHOR.blog}/#aitor-sanchez`,
  website: `${SITE.url}/#website`,
  app: `${SITE.url}/#webapp`,
  image: `${SITE.url}/#og-image`,
  homePage: `${SITE.url}/#webpage`,
  aboutPage: `${SITE.url}/acerca-de#webpage`,
  aboutCrumbs: `${SITE.url}/acerca-de#breadcrumb`,
};

/** schema.org graph for a page. Serialised into <script type="application/ld+json">. */
export function buildJsonLd(page: "home" | "about"): Record<string, unknown> {
  const person = {
    "@type": "Person",
    "@id": ID.person,
    name: AUTHOR.name,
    url: AUTHOR.blog,
    sameAs: [AUTHOR.blog, AUTHOR.hub],
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer support",
      url: AUTHOR.contact,
      availableLanguage: ["es"],
    },
  };

  const website = {
    "@type": "WebSite",
    "@id": ID.website,
    url: `${SITE.url}/`,
    name: SITE.name,
    inLanguage: SITE.lang,
    publisher: { "@id": ID.person },
    author: { "@id": ID.person },
  };

  const image = {
    "@type": "ImageObject",
    "@id": ID.image,
    url: OG_IMAGE_URL,
    contentUrl: OG_IMAGE_URL,
    width: SITE.ogImageWidth,
    height: SITE.ogImageHeight,
    caption: SITE.ogImageAlt,
  };

  const app = {
    "@type": "WebApplication",
    "@id": ID.app,
    name: SITE.name,
    alternateName: "Editor de planos 2D",
    url: `${SITE.url}/`,
    description: PAGES.home.description,
    applicationCategory: "DesignApplication",
    operatingSystem: "Cualquiera (navegador web)",
    browserRequirements: "Requiere JavaScript",
    inLanguage: SITE.lang,
    isAccessibleForFree: true,
    offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" },
    image: { "@id": ID.image },
    featureList: FEATURES,
    author: { "@id": ID.person },
    creator: { "@id": ID.person },
    publisher: { "@id": ID.person },
    isPartOf: { "@id": ID.website },
    sameAs: [AUTHOR.blog, AUTHOR.hub],
  };

  if (page === "home") {
    return {
      "@context": "https://schema.org",
      "@graph": [
        person,
        website,
        image,
        app,
        {
          "@type": "WebPage",
          "@id": ID.homePage,
          url: `${SITE.url}/`,
          name: PAGES.home.title,
          description: PAGES.home.description,
          inLanguage: SITE.lang,
          isPartOf: { "@id": ID.website },
          about: { "@id": ID.app },
          primaryImageOfPage: { "@id": ID.image },
          author: { "@id": ID.person },
        },
      ],
    };
  }

  return {
    "@context": "https://schema.org",
    "@graph": [
      person,
      website,
      image,
      app,
      {
        "@type": "AboutPage",
        "@id": ID.aboutPage,
        url: canonicalFor("about"),
        name: PAGES.about.title,
        description: PAGES.about.description,
        inLanguage: SITE.lang,
        isPartOf: { "@id": ID.website },
        about: { "@id": ID.app },
        mainEntity: { "@id": ID.person },
        primaryImageOfPage: { "@id": ID.image },
        author: { "@id": ID.person },
        breadcrumb: { "@id": ID.aboutCrumbs },
      },
      {
        "@type": "BreadcrumbList",
        "@id": ID.aboutCrumbs,
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: SITE.name,
            item: `${SITE.url}/`,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: "Acerca de",
            item: canonicalFor("about"),
          },
        ],
      },
    ],
  };
}

/** JSON-LD text safe to embed inside a <script> element. */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data, null, 2).replace(/</g, "\\u003c");
}
