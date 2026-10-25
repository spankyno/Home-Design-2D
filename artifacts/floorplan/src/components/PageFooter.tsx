import { Link } from "wouter";
import { AUTHOR } from "../lib/site";

export default function PageFooter() {
  return (
    <footer className="page-footer" data-testid="page-footer">
      <p className="page-footer__copyright">
        Autor: Aitor Sánchez Gutiérrez (c) 2026 Todos los derechos reservados
      </p>
      <nav className="page-footer__links" aria-label="Enlaces del autor">
        <a
          href={AUTHOR.blog}
          target="_blank"
          rel="noopener noreferrer"
          data-testid="link-footer-blog"
        >
          Blog
        </a>
        <a
          href={AUTHOR.hub}
          target="_blank"
          rel="noopener noreferrer"
          data-testid="link-footer-hub"
        >
          Aitor Hub
        </a>
        <a
          href={AUTHOR.contact}
          target="_blank"
          rel="noopener noreferrer"
          data-testid="link-footer-contacto"
        >
          Contacto
        </a>
        <Link href="/acerca-de" className="page-footer__about" data-testid="link-footer-acerca">
          Acerca de
        </Link>
      </nav>
    </footer>
  );
}
