import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { BrunelaFooter } from "@/components/ui/hover-footer";
import { LEGAL_ACTUALIZADO, PAGINAS_LEGALES } from "@/src/lib/legal";

/**
 * Esqueleto comun de las cuatro paginas legales: marca, titulo, fecha de
 * revision, pestañas entre las cuatro, el texto y el pie del sitio.
 *
 * Son paginas PUBLICAS y fuera de la puerta de acceso anticipado: la LSSI pide
 * que el aviso legal sea accesible "de forma permanente, facil, directa y
 * gratuita", y las condiciones se tienen que poder leer ANTES de pagar.
 * Estilos en app/estilos/acceso.css (bloque "Paginas legales").
 */
export function PaginaLegal({
  href,
  titulo,
  bajada,
  children,
}: {
  href: string;
  titulo: string;
  bajada: string;
  children: ReactNode;
}) {
  return (
    <>
      <main className="lg-page">
        <span className="acc-mancha acc-mancha-1" aria-hidden />
        <span className="acc-mancha acc-mancha-2" aria-hidden />

        <header className="lg-top">
          <Link href="/" className="lg-volver">
            <ArrowLeft size={15} strokeWidth={2.4} aria-hidden="true" /> Inicio
          </Link>
          <Link href="/" className="lg-marca" aria-label="Brunela Dance Trainer, inicio">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/brunela-dance-trainer-wordmark.png" alt="" />
          </Link>
        </header>

        <section className="lg-hero">
          <p className="lg-kicker">Información legal</p>
          <h1 className="lg-titulo">{titulo}</h1>
          <p className="lg-bajada">{bajada}</p>
          <p className="lg-fecha">Última actualización: {LEGAL_ACTUALIZADO}</p>
        </section>

        <nav className="lg-tabs" aria-label="Páginas legales">
          {PAGINAS_LEGALES.map((p) => (
            <Link
              key={p.href}
              href={p.href as never}
              className={"lg-tab" + (p.href === href ? " activa" : "")}
              aria-current={p.href === href ? "page" : undefined}
            >
              {p.titulo}
            </Link>
          ))}
        </nav>

        <article className="lg-texto">{children}</article>
      </main>
      <BrunelaFooter />
    </>
  );
}
