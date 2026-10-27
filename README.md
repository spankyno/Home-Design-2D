# Home Design 2D

Editor de planos 2D que funciona por completo en el navegador. Dibuja paredes, coloca puertas, ventanas y mobiliario, mide longitudes y superficies, y exporta el resultado a PNG, PDF o JSON.

**Aplicación:** <https://home-design-2d.pages.dev/> · **Acerca de:** <https://home-design-2d.pages.dev/acerca-de>

---

## Contenido

- [Características](#características)
- [Atajos de teclado](#atajos-de-teclado)
- [Stack tecnológico](#stack-tecnológico)
- [Estructura del repositorio](#estructura-del-repositorio)
- [Puesta en marcha](#puesta-en-marcha)
- [Datos, persistencia y formato JSON](#datos-persistencia-y-formato-json)
- [Despliegue en Cloudflare Pages](#despliegue-en-cloudflare-pages)
- [Seguridad](#seguridad)
- [SEO](#seo)
- [Pruebas](#pruebas)
- [Autor y contacto](#autor-y-contacto)
- [Licencia](#licencia)

---

## Características

**Dibujo**
- Paredes encadenadas con ajuste a cuadrícula, a ángulos habituales y a nodos existentes.
- Puertas y ventanas colocadas sobre las paredes, con ancho, posición y giro editables.
- Detección automática de habitaciones cerradas, con su superficie.
- Biblioteca de mobiliario y textos editables, con rotación y tamaño.

**Medición**
- Herramienta de **longitud**: arrastra entre dos puntos.
- Herramienta de **área**: marca los vértices de un polígono hasta cerrarlo y obtén los m² (y ft² en modo imperial).
- Unidades: metros, centímetros y pulgadas.

**Edición**
- Deshacer y rehacer, copiar y pegar, selección múltiple con recuadro.
- **Alinear y distribuir** mobiliario y textos (izquierda, centro, derecha, arriba, medio, abajo).
- **Guías inteligentes** al arrastrar: se alinean con bordes y centros de otros objetos y con las esquinas de las paredes. `Alt` las desactiva en el momento.
- Selector de color propio, con degradado y efectos (sombra, resplandor).

**Vista**
- Herramienta **Pan**, zoom con rueda o con botones y **Ajustar a la vista**.

**Datos**
- Autoguardado local con indicador de estado y aviso si no se puede guardar.
- Importación de JSON **validada con Zod**: un archivo corrupto no altera el plano actual.
- Exportación a PNG, PDF y JSON.

---

## Atajos de teclado

Pulsa `?` dentro de la aplicación para ver la lista completa.

| Tecla | Acción |
|---|---|
| `V` | Seleccionar |
| `H` | Pan (mover la vista) |
| `W` | Pared |
| `D` | Puerta |
| `N` | Ventana |
| `T` | Texto |
| `M` | Medir longitud |
| `A` | Medir área (`Enter` cierra, `⌫` quita el último vértice) |
| `X` | Eliminar |
| `+` / `−` | Acercar / alejar |
| `0` | Zoom 100 % |
| `F` | Ajustar a la vista |
| `Ctrl/⌘ + Z` / `Y` | Deshacer / rehacer |
| `Ctrl/⌘ + C` / `V` | Copiar / pegar |
| `Supr` | Eliminar selección |
| `Esc` | Cancelar / deseleccionar |
| `Espacio` + arrastrar | Mover la vista |
| `Alt` + arrastrar | Mover sin guías de alineación |

---

## Stack tecnológico

| Área | Tecnologías |
|---|---|
| Interfaz | React 19, TypeScript |
| Estilos y rutas | CSS propio (una sola hoja de estilos), wouter |
| Dibujo | SVG propio (sin librerías de canvas) |
| Validación | Zod |
| Exportación | jsPDF (carga bajo demanda) |
| Iconos | lucide-react |
| Tipografía | Inter (`@fontsource/inter`, alojada en local) |
| Compilación | Vite 7, pnpm workspaces |
| Alojamiento | Cloudflare Pages |

---

## Estructura del repositorio

```
.
├── artifacts/
│   └── floorplan/            # El editor (aplicación web)
│       ├── index.html        # Metaetiquetas SEO, JSON-LD y tracker
│       ├── public/           # og-image.png, iconos, manifest, robots, _headers
│       ├── src/
│       │   ├── App.tsx       # Rutas y espacio de trabajo
│       │   ├── store.tsx     # Estado, historial, autosave y acciones
│       │   ├── types.ts      # Modelo de datos
│       │   ├── components/   # Lienzo, barra de herramientas, paneles, diálogos
│       │   ├── pages/        # Página «Acerca de»
│       │   └── lib/          # Geometría, habitaciones, render, exportación,
│       │                     # esquema Zod, persistencia, layout, SEO
│       └── tests/            # Pruebas de lógica, seguridad y SEO
├── scripts/
│   └── generate-brand-assets.py   # Regenera og-image.png e iconos
├── DEPLOY-CLOUDFLARE.md      # Guía de despliegue
├── SECURITY-AUDIT.md         # Auditoría de seguridad y estado de las correcciones
└── pnpm-workspace.yaml
```

Los archivos principales del editor:

| Archivo | Responsabilidad |
|---|---|
| `store.tsx` | Estado del documento, deshacer/rehacer, autosave, zoom y alineación |
| `components/CanvasView.tsx` | Lienzo SVG: interacción, selección, arrastre, guías, medición |
| `lib/schema.ts` | Validación Zod de archivos importados y datos guardados |
| `lib/persistence.ts` | Lectura y escritura en `localStorage` con gestión de errores |
| `lib/layout.ts` | Cajas, alinear, distribuir y ajuste a guías |
| `lib/rooms.ts` | Detección de habitaciones a partir de las paredes |
| `lib/exporters.ts` | Exportación e importación (se carga bajo demanda) |
| `lib/site.ts` | Datos del sitio, enlaces del autor y JSON-LD |

---

## Puesta en marcha

**Requisitos:** Node.js 20 o superior y pnpm 9 (`corepack enable`).

```bash
# 1. Instalar dependencias
pnpm install

# 2. Servidor de desarrollo (http://localhost:5173)
pnpm --filter @workspace/floorplan run dev

# 3. Compilar para producción  ->  artifacts/floorplan/dist/public
pnpm run build

# 4. Previsualizar la compilación
pnpm --filter @workspace/floorplan run serve
```

Otros comandos útiles:

```bash
pnpm run typecheck   # comprobación de tipos
pnpm test            # pruebas de lógica, seguridad y SEO
pnpm audit           # vulnerabilidades en dependencias
```

Variables de entorno de compilación opcionales: `PORT` (por defecto 5173) y `BASE_PATH` (por defecto `/`).

---

## Datos, persistencia y formato JSON

- Las unidades internas son **centímetros** (100 cm = 1 m).
- El plano se guarda automáticamente en `localStorage` (clave `floorplan:v1`). Si los datos guardados están dañados, se conserva una copia en `floorplan:v1:backup` y el editor arranca limpio con un aviso.
- Si el navegador no permite guardar (almacenamiento lleno o bloqueado), aparece un banner con las opciones **Reintentar** y **Exportar JSON**.
- No hay cuenta ni base de datos: el plano solo sale del navegador si lo exportas.

**Formato JSON** (exportación e importación):

```json
{
  "walls":     [{ "id": "w1", "x1": 0, "y1": 0, "x2": 400, "y2": 0, "thickness": 10 }],
  "doors":     [{ "id": "d1", "wallId": "w1", "offset": 150, "width": 90, "flipX": false, "flipY": false }],
  "windows":   [{ "id": "v1", "wallId": "w1", "offset": 300, "width": 100 }],
  "furniture": [{ "id": "f1", "kind": "sofa", "x": 120, "y": 80, "rotation": 0, "w": 200, "h": 90 }],
  "texts":     [{ "id": "t1", "text": "Salón", "x": 200, "y": 150, "rotation": 0, "fontSize": 20 }]
}
```

Los elementos admiten opcionalmente `color`, `gradientColor`, `fillColor` (`#rrggbb`) y `effect` (`none`, `shadow`, `glow`). El campo `rooms` que aparece al exportar es informativo y se ignora al importar.

La importación rechaza JSON roto, tipos incorrectos, números no finitos o fuera de rango, medidas no positivas, más de 5.000 elementos por lista, identificadores reservados y archivos de más de 10 MB. El mensaje de error indica la ruta del problema, por ejemplo `furniture[2].w: debe ser mayor que 0`, y el plano actual no se modifica.

---

## Despliegue en Cloudflare Pages

| Ajuste | Valor |
|---|---|
| Framework preset | Vite |
| Comando de build | `corepack enable && corepack prepare pnpm@9.15.9 --activate && pnpm install --filter @workspace/floorplan... && pnpm --filter @workspace/floorplan run build` |
| Directorio de salida | `artifacts/floorplan/dist/public` |
| `NODE_VERSION` | `22` |
| `BASE_PATH` | `/` |

La guía completa, con los fallos de despliegue ya resueltos, está en [`DEPLOY-CLOUDFLARE.md`](./DEPLOY-CLOUDFLARE.md).

> No añadas un `404.html`: desactivaría el modo SPA de Cloudflare Pages.

---

## Seguridad

La aplicación es **solo frontend**: no hay backend, base de datos ni cuentas, y el plano nunca sale del navegador salvo que lo exportes. Medidas aplicadas (detalle en [`SECURITY-AUDIT.md`](./SECURITY-AUDIT.md)):

- **Entrada validada:** toda importación y todos los datos de `localStorage` pasan por un esquema Zod 4 con límites de tamaño, comprobados *antes* de validar para evitar bloqueos con archivos enormes.
- **Sin sumideros de XSS:** no se usa `innerHTML`, `eval` ni `new Function`; los colores se validan como `#rrggbb` y los textos se escapan en los SVG exportados.
- **Content-Security-Policy estricta** y cabeceras de seguridad (HSTS, `frame-ancestors 'none'`, `X-Frame-Options`, COOP…) en `public/_headers`. `script-src` solo admite el propio origen y el script del dashboard de analítica.
- **Sin recursos de terceros innecesarios:** la fuente Inter se sirve desde el propio dominio.
- **Referencias seguras:** las puertas y ventanas solo pueden apuntar a paredes propias (`Object.hasOwn`).

Si cambias de proveedor de analítica o añades otro recurso externo, **actualiza la CSP** en `public/_headers` o el navegador lo bloqueará. Para depurarla, cambia el nombre de la cabecera a `Content-Security-Policy-Report-Only` y revisa la consola.

Comprobación de dependencias: `pnpm audit`.

---

## SEO

- **Fuente única:** `src/lib/site.ts` contiene URL, títulos, descripciones, enlaces del autor y el JSON-LD (schema.org: `Person`, `WebSite`, `WebApplication`, `WebPage`/`AboutPage`, `BreadcrumbList`).
- **HTML estático por ruta:** el build genera `acerca-de.html` y `sitemap.xml`, para que rastreadores y vistas previas sociales que no ejecutan JavaScript vean los datos correctos de cada página. En la navegación interna, el hook `useSeo` actualiza las metaetiquetas.
- **Social:** Open Graph y Twitter Card con `og-image.png` (1200×630).
- **Rendimiento:** la exportación (jsPDF) se carga solo al exportar; la fuente Inter se aloja en local.
- **Archivos:** `robots.txt`, `site.webmanifest`, iconos y `_headers` (cabeceras de seguridad y caché inmutable para `/assets/*`).
- **Imagen social e iconos:** `python3 scripts/generate-brand-assets.py` (requiere Pillow).

Si cambias el dominio, actualiza `SITE.url` en `site.ts`, además de `index.html` y `public/robots.txt`. Las pruebas detectan si `index.html` y `site.ts` se desincronizan.

---

## Pruebas

```bash
pnpm --filter @workspace/floorplan run test:logic
```

Cubre la validación de importación y de datos guardados, el manejo de errores de `localStorage`, alinear, distribuir y guías, las correcciones de seguridad (archivos enormes, referencias heredadas, escapado, CSP) y la coherencia del SEO (JSON-LD, etiquetas, tamaño de `og-image.png`, `robots.txt` y footer).

---

## Autor y contacto

**Aitor Sánchez Gutiérrez**

- Blog: <https://aitorsanchez.pages.dev>
- Aitor Hub: <https://aitorhub.vercel.app>
- Contacto: <https://aitorsanchez.pages.dev/contacto>

---

## Licencia

© 2026 Aitor Sánchez Gutiérrez. Todos los derechos reservados.
