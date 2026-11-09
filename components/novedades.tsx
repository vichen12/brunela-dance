import Link from "next/link";
import { ListChecks, Megaphone, Package, PlayCircle } from "lucide-react";
import type { Novedad, TipoNovedad } from "@/src/features/studio/novedades-reglas";

const ETIQUETA: Record<TipoNovedad, string> = { clase: "Clase nueva", plan: "Plan nuevo", pack: "Pack nuevo", anuncio: "Novedad" };

function Icono({ tipo }: { tipo: TipoNovedad }) {
  if (tipo === "plan") return <ListChecks size={22} strokeWidth={2} aria-hidden="true" />;
  if (tipo === "pack") return <Package size={22} strokeWidth={2} aria-hidden="true" />;
  if (tipo === "anuncio") return <Megaphone size={22} strokeWidth={2} aria-hidden="true" />;
  return <PlayCircle size={22} strokeWidth={2} aria-hidden="true" />;
}

/** Lo ultimo del estudio, en el inicio de la alumna. Sin novedades no deja un hueco. */
export function Novedades({ novedades }: { novedades: Novedad[] }) {
  if (novedades.length === 0) return null;
  return (
    <section className="nvd" aria-labelledby="nvd-titulo">
      <style>{CSS}</style>
      <h2 id="nvd-titulo" className="ini-h2 nvd-h2">Novedades</h2>
      <div className="nvd-fila">
        {novedades.map((n) => {
          const contenido = (
            <>
              <span className="nvd-img">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {n.imagen ? <img src={n.imagen} alt="" loading="lazy" /> : <Icono tipo={n.tipo} />}
              </span>
              <span className="nvd-txt">
                <span className={"nvd-etq nvd-etq--" + n.tipo}>{n.gratis ? "Gratis" : ETIQUETA[n.tipo]}</span>
                <strong className="nvd-titulo">{n.titulo}</strong>
                {n.detalle && <small className="nvd-detalle">{n.detalle}</small>}
              </span>
            </>
          );
          return n.href
            ? <Link key={n.clave} href={n.href as never} className="nvd-card nvd-card--link">{contenido}</Link>
            : <article key={n.clave} className="nvd-card">{contenido}</article>;
        })}
      </div>
    </section>
  );
}

const CSS = `
.nvd { margin: 0 0 26px; min-width: 0; }
.nvd-h2 { margin-bottom: 14px; }
.nvd-fila { display: flex; gap: 14px; overflow-x: auto; padding: 2px 2px 10px; scroll-snap-type: x proximity; scrollbar-width: thin; }
.nvd-card { flex: 0 0 240px; scroll-snap-align: start; display: flex; flex-direction: column; border-radius: 22px; overflow: hidden; background: #fff; border: 1px solid var(--linea, #F6E7E1); box-shadow: 0 10px 24px -20px rgba(120,50,40,.5); color: inherit; text-decoration: none; transition: transform .25s ease, box-shadow .25s ease; }
.nvd-card--link { cursor: pointer; }
.nvd-card--link:hover { transform: translateY(-3px); box-shadow: 0 16px 30px -20px rgba(120,50,40,.6); }
.nvd-img { position: relative; display: grid; place-items: center; aspect-ratio: 16 / 9; background: linear-gradient(135deg, #FFF1EC, #FFDADA); color: var(--pink-deep, #B03A3E); overflow: hidden; }
/* Absoluta: con height 100% dentro de la grilla, una foto vertical mostraba solo su parte de arriba. */
.nvd-img img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: center; display: block; }
.nvd-txt { display: flex; flex-direction: column; align-items: flex-start; gap: 6px; padding: 12px 14px 15px; min-width: 0; }
.nvd-etq { padding: 3px 10px; border-radius: 99px; font-size: 11.5px; font-weight: 800; background: var(--rubor, #FFF2EE); color: var(--pink-deep, #B03A3E); }
.nvd-etq--pack { background: #FFF4E8; color: var(--melocoton-deep, #C25E3A); }
.nvd-titulo { font-size: 14.5px; font-weight: 800; line-height: 1.3; color: var(--ink); display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; }
.nvd-detalle { font-size: 12.5px; line-height: 1.4; color: var(--muted); display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 3; overflow: hidden; }
@media (prefers-reduced-motion: reduce) { .nvd-card { transition: none; } .nvd-card--link:hover { transform: none; } }
`;
