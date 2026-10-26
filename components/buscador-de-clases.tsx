"use client";

import { useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Clock, Play, Search } from "lucide-react";
import { buscarClases, urlParaEditarClase, type ClaseParaBuscar } from "@/src/features/admin/buscar-clases";

/**
 * La caja de busqueda de /admin/videos, con sugerencias mientras se escribe.
 *
 * VA DENTRO DEL <form method="get"> DE AdminBuscador (prop `entrada`), con el
 * mismo name="q": Enter sin ninguna sugerencia elegida sigue mandando la
 * busqueda normal al servidor, y los filtros de al lado siguen viajando juntos.
 *
 * LOS DATOS VIENEN POR PROPS: la lista liviana de TODAS las clases (son
 * decenas). Filtrar en el navegador no cuesta nada y contesta en cada tecla;
 * pedirle al servidor por tecla seria un viaje a Frankfurt por letra.
 *
 * TECLADO: flechas para moverse, Enter abre la marcada, Esc cierra.
 * Patron combobox de WAI-ARIA (input con aria-activedescendant).
 */

const ESTADO: Record<ClaseParaBuscar["estado"], { clase: string; label: string }> = {
  published: { clase: "bcl-chip--pub", label: "Publicada" },
  draft: { clase: "bcl-chip--borr", label: "Borrador" },
  archived: { clase: "bcl-chip--arch", label: "Archivada" },
};

const MAXIMO = 8;

/**
 * El mismo buscador sirve para los planes de trabajo (/admin/programs): `de="plan"`
 * cambia los textos, a donde lleva la sugerencia y la unidad (dias, no minutos).
 * Para un plan, `duracionMin` lleva sus DIAS y `categorias` lo que diga debajo.
 */
const TEXTOS = {
  clase: { lista: "Clases que coinciden", ninguna: "Ninguna clase coincide", abre: "abre la clase", unidad: "min", estado: { published: "Publicada", draft: "Borrador", archived: "Archivada" } },
  plan: { lista: "Planes que coinciden", ninguna: "Ningún plan coincide", abre: "abre el plan", unidad: "días", estado: { published: "Publicado", draft: "Borrador", archived: "Archivado" } },
  // Alumnas: `titulo` = nombre, `slug` = correo, `categorias` = su plan.
  alumna: { lista: "Alumnas que coinciden", ninguna: "Ninguna alumna coincide", abre: "abre su ficha", unidad: "", estado: { published: "", draft: "", archived: "" } },
} as const;

export function BuscadorDeClases({ q, placeholder, clases, de = "clase" }: { q: string; placeholder: string; clases: ClaseParaBuscar[]; de?: "clase" | "plan" | "alumna" }) {
  const t = TEXTOS[de];
  const router = useRouter();
  const idLista = useId();
  const [texto, setTexto] = useState(q);
  const [abierto, setAbierto] = useState(false);
  const [marcada, setMarcada] = useState(-1);
  const input = useRef<HTMLInputElement>(null);

  const sugerencias = useMemo(() => buscarClases(clases, texto, { max: MAXIMO }), [clases, texto]);
  const visible = abierto && texto.trim().length > 0;

  function abrirClase(c: ClaseParaBuscar) {
    setAbierto(false);
    router.push((
      de === "plan" ? `/admin/programs/${encodeURIComponent(c.id)}`
      : de === "alumna" ? `/admin/users/${encodeURIComponent(c.id)}`
      : urlParaEditarClase(c.id)
    ) as never);
  }

  function alTeclear(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setAbierto(true);
      setMarcada((m) => (sugerencias.length ? (m + 1) % sugerencias.length : -1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setAbierto(true);
      setMarcada((m) => (sugerencias.length ? (m <= 0 ? sugerencias.length - 1 : m - 1) : -1));
    } else if (e.key === "Escape") {
      if (visible) {
        e.preventDefault();
        setAbierto(false);
        setMarcada(-1);
      }
    } else if (e.key === "Enter") {
      // Con una marcada, abre esa. Sin ninguna, no se toca: el formulario se
      // envia solo y el servidor busca como siempre.
      const c = visible && marcada >= 0 ? sugerencias[marcada] : null;
      if (c) {
        e.preventDefault();
        abrirClase(c);
      }
    }
  }

  const idOpcion = (i: number) => `${idLista}-op-${i}`;

  return (
    <div className="abus-buscar bcl" onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setAbierto(false); }}>
      <Search size={17} strokeWidth={1.8} className="abus-buscar-ico" aria-hidden="true" />
      <input
        ref={input}
        type="search"
        name="q"
        value={texto}
        placeholder={placeholder}
        aria-label={placeholder}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={visible}
        aria-controls={idLista}
        aria-activedescendant={visible && marcada >= 0 ? idOpcion(marcada) : undefined}
        autoComplete="off"
        onChange={(e) => { setTexto(e.target.value); setAbierto(true); setMarcada(-1); }}
        onFocus={() => setAbierto(true)}
        onKeyDown={alTeclear}
      />
      <button type="submit" className="abus-buscar-btn" aria-label="Buscar">
        <ArrowRight size={16} strokeWidth={2} />
      </button>

      {visible && (
        <div className="bcl-panel">
          {sugerencias.length === 0 ? (
            <p className="bcl-vacio">{t.ninguna} con «{texto.trim()}».</p>
          ) : (
            <ul id={idLista} role="listbox" aria-label={t.lista} className="bcl-lista">
              {sugerencias.map((c, i) => {
                const st = ESTADO[c.estado] ?? ESTADO.draft;
                return (
                  <li
                    key={c.id}
                    id={idOpcion(i)}
                    role="option"
                    aria-selected={i === marcada}
                    className={"bcl-op" + (i === marcada ? " es-marcada" : "")}
                    // mousedown y no click: el click llega DESPUES del blur del
                    // input, y para entonces la lista ya se cerro.
                    onMouseDown={(e) => { e.preventDefault(); abrirClase(c); }}
                    onMouseEnter={() => setMarcada(i)}
                  >
                    <span className="bcl-mini">
                      {de === "alumna"
                        ? <span className="bcl-inicial">{(c.titulo || c.slug)[0]?.toUpperCase()}</span>
                        : c.portada ? <img src={c.portada} alt="" loading="lazy" /> : <Play size={14} strokeWidth={2} fill="currentColor" aria-hidden="true" />}
                    </span>
                    <span className="bcl-txt">
                      <span className="bcl-titulo">{c.titulo || c.slug}</span>
                      {de === "alumna"
                        ? <span className="bcl-sub">{c.slug}</span>
                        : c.categorias && <span className="bcl-sub">{c.categorias}</span>}
                    </span>
                    {de === "alumna" ? (
                      <span className="bcl-chip bcl-chip--pub">{c.categorias}</span>
                    ) : (
                      <>
                        <span className={"bcl-chip " + st.clase}>{t.estado[c.estado] ?? st.label}</span>
                        <span className="bcl-dur"><Clock size={11} strokeWidth={2.4} aria-hidden="true" /> {c.duracionMin} {t.unidad}</span>
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          <p className="bcl-pie">
            <kbd>↑</kbd><kbd>↓</kbd> para elegir · <kbd>Enter</kbd> {marcada >= 0 ? t.abre : "busca en la lista"} · <kbd>Esc</kbd> cierra
          </p>
        </div>
      )}
      <style>{CSS}</style>
    </div>
  );
}

const CSS = `
.bcl-inicial { width: 100%; height: 100%; display: grid; place-items: center; font-weight: 900; font-size: 15px; color: var(--pink-deep); background: linear-gradient(135deg, var(--melocoton, #FFD9C4), var(--pink-soft, #FFDADA)); }

.bcl { position: relative; }
/* La barra del buscador por ENCIMA de la lista de clases: sin esto el panel de
   sugerencias quedaba detras de las tarjetas (cada una arma su propia capa). */
.abus:has(.bcl) { position: relative; z-index: 30; }
.bcl-panel {
  position: absolute; z-index: 40; left: 0; right: 0; top: calc(100% + 8px); min-width: 300px;
  background: #fff; border: 1.5px solid var(--linea-fuerte); border-radius: 22px; overflow: hidden;
  box-shadow: 0 24px 48px -24px rgba(176, 70, 70, .45), var(--sombra);
  animation: bcl-abre .22s var(--curva) both;
}
@keyframes bcl-abre { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: none; } }
.bcl-lista { list-style: none; margin: 0; padding: 6px; max-height: 420px; overflow-y: auto; }
.bcl-op {
  display: grid; grid-template-columns: 56px minmax(0, 1fr) auto auto; align-items: center; gap: 12px;
  padding: 7px 10px 7px 7px; border-radius: 16px; cursor: pointer; transition: background .15s;
}
.bcl-op.es-marcada { background: var(--rubor); }
.bcl-mini {
  width: 56px; height: 36px; border-radius: 10px; overflow: hidden; display: grid; place-items: center;
  color: var(--pink); background: linear-gradient(145deg, #FFF1EC, #FDE3E0);
}
.bcl-mini img { width: 100%; height: 100%; object-fit: cover; display: block; }
.bcl-txt { min-width: 0; display: flex; flex-direction: column; gap: 1px; }
.bcl-titulo { font-size: 14px; font-weight: 800; color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.bcl-sub { font-size: 12px; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.bcl-chip { font-size: 11.5px; font-weight: 800; padding: 3px 10px; border-radius: 99px; white-space: nowrap; }
.bcl-chip--pub { color: var(--pink-deep); background: var(--pink-wash); }
.bcl-chip--borr { color: var(--melocoton-deep); background: #FFEBDF; }
.bcl-chip--arch { color: var(--muted); background: #F6EEEA; }
.bcl-dur { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; font-weight: 800; color: var(--muted); white-space: nowrap; }
.bcl-dur svg { color: var(--pink-deep); }
.bcl-vacio { margin: 0; padding: 16px 18px; font-size: 13.5px; color: var(--muted); }
.bcl-pie { margin: 0; padding: 9px 16px; font-size: 11.5px; color: var(--muted); background: var(--crema); border-top: 1px solid var(--linea); }
.bcl-pie kbd { font: inherit; font-weight: 800; color: var(--ink); padding: 1px 6px; margin-right: 3px; border-radius: 6px; background: #fff; border: 1px solid var(--linea-fuerte); }
@media (max-width: 640px) {
  .bcl-op { grid-template-columns: 48px minmax(0, 1fr) auto; }
  .bcl-mini { width: 48px; height: 32px; }
  .bcl-dur { display: none; }
  .bcl-pie { display: none; }
}
@media (prefers-reduced-motion: reduce) { .bcl-panel { animation: none; } }
`;
