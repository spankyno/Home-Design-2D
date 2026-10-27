import { ArrowDownRight, ArrowUpRight, MoveRight, Ruler, Layers3, PencilRuler } from "lucide-react";
import { Link } from "wouter";
import PageFooter from "../components/PageFooter";
import { useSeo } from "../lib/useSeo";
import { AUTHOR, SITE } from "../lib/site";

const features = [
  {
    number: "01",
    title: "Traza el espacio",
    description:
      "Dibuja paredes con precisión y completa la distribución con puertas y ventanas. La cuadrícula y el ajuste angular ayudan a mantener cada línea en su sitio.",
    icon: PencilRuler,
  },
  {
    number: "02",
    title: "Dale forma al plano",
    description:
      "Coloca mobiliario, añade textos editables y mide longitudes y superficies sobre el plano. Las guías de alineación y las opciones de alinear y distribuir ordenan los objetos; colores, degradados y efectos los distinguen.",
    icon: Layers3,
  },
  {
    number: "03",
    title: "Guarda y comparte",
    description:
      "Deshaz y rehaz cambios mientras trabajas; el plano se guarda solo en tu navegador. Cuando esté listo, expórtalo como PNG, PDF o JSON, importa archivos JSON validados y compártelo como archivo.",
    icon: Ruler,
  },
];

export default function AcercaDe() {
  useSeo("about");

  return (
    <div className="about-shell">
      <header className="about-header">
        <Link href="/" className="about-wordmark" data-testid="link-about-home">
          <span className="about-mark" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
          <span>Plano</span>
        </Link>
        <nav className="about-header__nav" aria-label="Navegación principal">
          <Link href="/" className="about-nav-link" data-testid="link-about-editor">
            Volver al editor <ArrowUpRight size={15} aria-hidden="true" />
          </Link>
        </nav>
      </header>

      <main className="about-main">
        <section className="about-hero" aria-labelledby="about-title">
          <div className="about-hero__copy">
            <p className="about-eyebrow">
              <span className="about-eyebrow__line" />
              Una herramienta para pensar en espacios
            </p>
            <h1 id="about-title">
              Del primer trazo
              <br />
              <span>al plano terminado.</span>
            </h1>
            <p className="about-lede">
              Un editor de planos en el navegador para dibujar, probar distribuciones y
              preparar una versión clara de tu espacio, sin perder de vista el proceso.
            </p>
            <Link href="/" className="about-primary-link" data-testid="link-about-start">
              Abrir el editor <MoveRight size={17} aria-hidden="true" />
            </Link>
          </div>

          <div className="plan-illustration" role="img" aria-label="Ilustración de un plano arquitectónico con habitaciones, puertas y cotas">
            <div className="plan-illustration__topline">
              <span>ESTUDIO · 01</span>
              <span>PLANTA / PROPUESTA A</span>
            </div>
            <svg viewBox="0 0 520 390" aria-hidden="true">
              <defs>
                <pattern id="plan-grid" width="18" height="18" patternUnits="userSpaceOnUse">
                  <path d="M 18 0 L 0 0 0 18" fill="none" stroke="currentColor" strokeWidth=".55" opacity=".3" />
                </pattern>
              </defs>
              <rect x="20" y="20" width="480" height="340" fill="url(#plan-grid)" />
              <g className="plan-room-fill">
                <path d="M112 78h179v103H112z" />
                <path d="M112 181h114v129H112z" />
                <path d="M226 231h168v79H226z" />
                <path d="M291 78h103v153H291z" />
              </g>
              <g className="plan-walls">
                <path d="M91 57h324v274H91z" />
                <path d="M291 57v67 M291 159v91 M291 286v45" />
                <path d="M91 181h53 M180 181h132" />
                <path d="M224 181v150" />
                <path d="M224 249h191" />
                <path d="M415 57v100 M415 190v141" />
              </g>
              <g className="plan-openings">
                <path d="M291 124a35 35 0 0 1 35 35" />
                <path d="M144 181a36 36 0 0 1 36 36" />
                <path d="M224 249a35 35 0 0 1 35 35" />
                <path d="M415 157a33 33 0 0 1-33 33" />
                <path d="M155 57v13m18-13v13M351 57v13m18-13v13M91 267h9m-9 17h9" />
              </g>
              <g className="plan-furniture">
                <rect x="137" y="94" width="72" height="43" rx="2" />
                <path d="M145 102h56v27h-56zM145 115h56M173 102v27" />
                <rect x="130" y="226" width="53" height="48" rx="2" />
                <path d="M137 233h39v34h-39zM137 250h39" />
                <rect x="316" y="91" width="51" height="26" rx="13" />
                <path d="M341 117v16m-12 0h24" />
                <rect x="284" y="267" width="47" height="26" rx="2" />
                <path d="M293 267v26m29-26v26" />
              </g>
              <g className="plan-dimensions">
                <path d="M91 39h324m-324-5v10m324-10v10M70 57v274m-5-274h10m-10 274h10" />
                <text x="247" y="32">8,40 m</text>
                <text x="54" y="202" transform="rotate(-90 54 202)">6,20 m</text>
                <circle cx="415" cy="331" r="3" />
              </g>
            </svg>
            <div className="plan-illustration__caption">
              <span>PLANTA DE DISTRIBUCIÓN</span>
              <span>ESC. 1:50</span>
            </div>
            <span className="plan-stamp">DIBUJA<br />AJUSTA<br />COMPARTE</span>
          </div>
          <div className="about-index" aria-hidden="true">01 / 03</div>
        </section>

        <section className="about-intro" aria-labelledby="about-intro-title">
          <div className="about-intro__label">
            <span>01</span>
            <span>Qué puedes hacer</span>
          </div>
          <div className="about-intro__content">
            <h2 id="about-intro-title">Un espacio de trabajo, no una caja negra.</h2>
            <p>
              El editor reúne las herramientas esenciales para construir un plano
              directamente sobre el lienzo. Cada decisión —una pared, una medida, un
              mueble— permanece visible y editable mientras afinas la distribución.
            </p>
          </div>
        </section>

        <figure className="about-figure">
          <img
            src={SITE.ogImage}
            alt={SITE.ogImageAlt}
            width={SITE.ogImageWidth}
            height={SITE.ogImageHeight}
            loading="lazy"
            decoding="async"
          />
          <figcaption>Home Design 2D · Editor de planos 2D online</figcaption>
        </figure>

        <section className="about-features" aria-label="Herramientas del editor">
          {features.map(({ number, title, description, icon: Icon }) => (
            <article className="about-feature" key={number} data-testid={`feature-${number}`}>
              <div className="about-feature__top">
                <span>{number}</span>
                <Icon size={20} strokeWidth={1.5} aria-hidden="true" />
              </div>
              <h3>{title}</h3>
              <p>{description}</p>
              <span className="about-feature__rule" />
            </article>
          ))}
        </section>

        <section className="about-method" aria-labelledby="about-method-title">
          <div className="about-method__diagram" aria-hidden="true">
            <div className="method-square method-square--outer" />
            <div className="method-square method-square--inner" />
            <span className="method-cross method-cross--one" />
            <span className="method-cross method-cross--two" />
            <span className="method-axis method-axis--x">X / 0°</span>
            <span className="method-axis method-axis--y">Y / 90°</span>
            <span className="method-dot" />
          </div>
          <div className="about-method__copy">
            <p className="about-eyebrow about-eyebrow--dark">Hecho para trabajar con claridad</p>
            <h2 id="about-method-title">Precisión donde importa.<br />Libertad donde ayuda.</h2>
            <p>
              Ajusta trazos a la cuadrícula o a ángulos habituales, mide sobre el plano
              y conserva el control con deshacer y rehacer. Los estilos de color,
              degradado y efecto permiten distinguir los elementos sin complicar el
              dibujo. Todo ocurre en tu navegador: el plano se guarda en local y
              solo sale de él si decides exportarlo.
            </p>
            <div className="about-method__note">
              <ArrowDownRight size={17} aria-hidden="true" />
              El plano se construye en el lienzo, pieza a pieza.
            </div>
          </div>
        </section>

        <section className="about-stack" aria-labelledby="about-stack-title">
          <div className="about-stack__heading">
            <p className="about-eyebrow about-eyebrow--dark">Bajo el plano</p>
            <h2 id="about-stack-title">Tecnología, sin misterio.</h2>
            <p>Las herramientas que hacen funcionar este editor, de principio a fin.</p>
          </div>
          <div className="stack-list">
            <div className="stack-row">
              <span className="stack-row__number">01</span>
              <strong>Interfaz</strong>
              <span>React 19 · TypeScript</span>
              <span className="stack-row__detail">Componentes tipados para el espacio de trabajo</span>
            </div>
            <div className="stack-row">
              <span className="stack-row__number">02</span>
              <strong>Estilos y rutas</strong>
              <span>CSS propio · wouter</span>
              <span className="stack-row__detail">Una sola hoja de estilos y navegación sin recargas</span>
            </div>
            <div className="stack-row">
              <span className="stack-row__number">03</span>
              <strong>Datos</strong>
              <span>Zod · localStorage</span>
              <span className="stack-row__detail">Validación de archivos importados y autoguardado local</span>
            </div>
            <div className="stack-row">
              <span className="stack-row__number">04</span>
              <strong>Dibujo y salida</strong>
              <span>SVG · jsPDF · html2canvas</span>
              <span className="stack-row__detail">Representación vectorial y exportación a PNG y PDF</span>
            </div>
            <div className="stack-row">
              <span className="stack-row__number">05</span>
              <strong>Desarrollo</strong>
              <span>Vite · pnpm workspaces</span>
              <span className="stack-row__detail">Entorno rápido y paquetes organizados</span>
            </div>
            <div className="stack-row">
              <span className="stack-row__number">06</span>
              <strong>Alojamiento</strong>
              <span>Cloudflare Pages</span>
              <span className="stack-row__detail">Publicación estática y distribución global</span>
            </div>
          </div>
        </section>

        <section className="about-creator" aria-labelledby="about-creator-title">
          <div className="about-creator__mark" aria-hidden="true">ASG</div>
          <div className="about-creator__copy">
            <p className="about-eyebrow">Una herramienta independiente</p>
            <h2 id="about-creator-title">Creado por Aitor Sánchez Gutiérrez.</h2>
            <p>
              Este editor forma parte de un trabajo personal en torno a herramientas
              digitales útiles y sencillas de usar. Si quieres conocer más proyectos,
              consultar el blog o ponerte en contacto, aquí tienes los enlaces.
            </p>
            <dl className="about-contact">
              <div>
                <dt>Autor</dt>
                <dd>{AUTHOR.name}</dd>
              </div>
              <div>
                <dt>Blog</dt>
                <dd>
                  <a href={AUTHOR.blog} target="_blank" rel="noopener noreferrer">
                    aitorsanchez.pages.dev
                  </a>
                </dd>
              </div>
              <div>
                <dt>Proyectos</dt>
                <dd>
                  <a href={AUTHOR.hub} target="_blank" rel="noopener noreferrer">
                    aitorhub.vercel.app
                  </a>
                </dd>
              </div>
              <div>
                <dt>Contacto</dt>
                <dd>
                  <a href={AUTHOR.contact} target="_blank" rel="noopener noreferrer">
                    aitorsanchez.pages.dev/contacto
                  </a>
                </dd>
              </div>
            </dl>
          </div>
          <nav className="about-creator__links" aria-label="Datos de contacto de Aitor Sánchez Gutiérrez">
            <a href={AUTHOR.blog} target="_blank" rel="noopener noreferrer" data-testid="link-about-blog">
              Blog <ArrowUpRight size={15} aria-hidden="true" />
            </a>
            <a href={AUTHOR.hub} target="_blank" rel="noopener noreferrer" data-testid="link-about-hub">
              Aitor Hub <ArrowUpRight size={15} aria-hidden="true" />
            </a>
            <a href={AUTHOR.contact} target="_blank" rel="noopener noreferrer" data-testid="link-about-contact">
              Contacto <ArrowUpRight size={15} aria-hidden="true" />
            </a>
          </nav>
        </section>

        <section className="about-cta" aria-label="Volver al editor">
          <p>El siguiente trazo es tuyo.</p>
          <Link href="/" className="about-cta__link" data-testid="link-about-editor-bottom">
            Volver al plano <MoveRight size={18} aria-hidden="true" />
          </Link>
        </section>
      </main>
      <PageFooter />
    </div>
  );
}
