import Link from "next/link";

/**
 * Paginacion comun a todo el sistema (pedido de la duena: "¡paginá!", y que
 * se vea igual en todos lados).
 *
 * Es de SERVIDOR a proposito: `href` es una funcion, y una funcion no puede
 * cruzar como prop a un componente de cliente (trampa 6 del CLAUDE.md). Si
 * alguna vez hace falta en una pantalla de cliente, se le pasan los enlaces
 * ya armados, no la funcion.
 *
 * - `pagina` empieza en 0 (igual que `?pagina=` en todas las pantallas: la
 *   primera no lleva parametro).
 * - `total` es la cantidad de ELEMENTOS, no de paginas.
 * - `href(n)` recibe la pagina en base 0 y devuelve el enlace conservando
 *   los demas parametros de la URL; eso es responsabilidad de quien llama.
 * - Con una sola pagina no se dibuja nada.
 */
export function Paginacion({
  pagina,
  total,
  porPagina,
  href,
  etiqueta = "Páginas",
  compacta = false,
}: {
  pagina: number;
  total: number;
  porPagina: number;
  href: (n: number) => string;
  etiqueta?: string;
  /** Para columnas angostas (barras laterales): flechas sin texto. */
  compacta?: boolean;
}) {
  const totalPaginas = Math.max(1, Math.ceil(total / porPagina));
  if (totalPaginas <= 1) return null;
  const actual = Math.max(0, Math.min(pagina, totalPaginas - 1));

  // Hasta 7 paginas van todas; si hay mas: primera, ultima y +-1 de la actual.
  const numeros = Array.from({ length: totalPaginas }, (_, n) => n).filter(
    (n) => totalPaginas <= 7 || n === 0 || n === totalPaginas - 1 || Math.abs(n - actual) <= 1,
  );

  return (
    <nav className={"pag" + (compacta ? " pag--compacta" : "")} aria-label={etiqueta}>
      <style href="paginacion-comun" precedence="default">{CSS}</style>
      {actual > 0 ? (
        <Link href={href(actual - 1) as never} className="pag-flecha" rel="prev" aria-label="Anteriores"><>←{!compacta && <span className="pag-txt">Anteriores</span>}</></Link>
      ) : (
        <span className="pag-flecha es-off" aria-hidden="true"><>←{!compacta && <span className="pag-txt">Anteriores</span>}</></span>
      )}
      <span className="pag-nums">
        {numeros.map((n, k) => (
          <span key={n} className="pag-celda">
            {k > 0 && n - numeros[k - 1] > 1 && <span className="pag-puntos" aria-hidden="true">…</span>}
            <Link
              href={href(n) as never}
              className={"pag-num" + (n === actual ? " es-activa" : "")}
              aria-current={n === actual ? "page" : undefined}
              aria-label={`Página ${n + 1}`}
            >
              {n + 1}
            </Link>
          </span>
        ))}
      </span>
      {actual < totalPaginas - 1 ? (
        <Link href={href(actual + 1) as never} className="pag-flecha" rel="next" aria-label="Siguientes"><>{!compacta && <span className="pag-txt">Siguientes</span>}→</></Link>
      ) : (
        <span className="pag-flecha es-off" aria-hidden="true"><>{!compacta && <span className="pag-txt">Siguientes</span>}→</></span>
      )}
    </nav>
  );
}

/**
 * Arma un `href` que conserva todos los parametros actuales y solo cambia
 * `pagina` (la 0 no lleva parametro). `params` es el searchParams ya resuelto.
 */
export function hrefConPagina(
  ruta: string,
  params: Record<string, string | string[] | undefined>,
  clave = "pagina",
) {
  return (n: number) => {
    const u = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (k === clave || v === undefined) continue;
      if (Array.isArray(v)) v.forEach((x) => u.append(k, x));
      else if (v !== "") u.set(k, v);
    }
    if (n > 0) u.set(clave, String(n));
    const qs = u.toString();
    return qs ? `${ruta}?${qs}` : ruta;
  };
}

const CSS = `
.pag { display: flex; align-items: center; justify-content: center; gap: 12px; flex-wrap: wrap; padding-top: 28px; }
.pag-nums { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; justify-content: center; }
.pag-celda { display: contents; }
.pag-num { min-width: 42px; height: 42px; padding: 0 12px; border-radius: 99px; display: grid; place-items: center; font-size: 14px; font-weight: 800; text-decoration: none; color: var(--ink); background: #fff; border: 1.5px solid var(--linea-fuerte); transition: background .2s, border-color .2s, transform .25s var(--curva); }
.pag-num:hover { background: var(--rubor); border-color: var(--pink-line); transform: translateY(-1px); }
.pag-num.es-activa { background: var(--pink); border-color: var(--pink); color: #fff; box-shadow: 0 10px 20px -12px rgba(230,79,85,.9); }
.pag-num:focus-visible, .pag-flecha:focus-visible { outline: 2px solid var(--pink); outline-offset: 2px; }
.pag-puntos { color: var(--muted); font-weight: 800; padding: 0 2px; }
.pag-flecha { height: 42px; padding: 0 18px; border-radius: 99px; display: inline-flex; align-items: center; font-size: 13.5px; font-weight: 800; text-decoration: none; color: var(--ink); background: var(--rubor); white-space: nowrap; transition: background .2s; }
.pag-flecha { gap: 6px; }
.pag-flecha:hover { background: var(--pink-wash); }
.pag-flecha.es-off { opacity: .4; pointer-events: none; }
.pag--compacta { gap: 6px; padding-top: 0; flex-wrap: nowrap; }
.pag--compacta .pag-nums { gap: 4px; flex-wrap: nowrap; }
.pag--compacta .pag-num { min-width: 34px; height: 34px; padding: 0 8px; font-size: 13px; }
.pag--compacta .pag-flecha { height: 34px; padding: 0 12px; font-size: 14px; }
@media (max-width: 560px) {
  .pag { gap: 8px; }
  .pag-flecha { padding: 0 14px; font-size: 14px; height: 38px; }
  .pag-txt { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
  .pag-num { min-width: 38px; height: 38px; padding: 0 10px; }
}
`;
