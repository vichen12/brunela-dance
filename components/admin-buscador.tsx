import { Desplegable } from "@/components/desplegable";
import Link from "next/link";
import { ArrowRight, Search, X } from "lucide-react";

/**
 * Buscador y filtros de los listados del panel.
 *
 * POR QUE EXISTE
 *   Las cuatro pantallas de admin no tenian NI buscador NI filtros. La
 *   biblioteca de las alumnas si: buscador por texto y cuatro filtros. O sea
 *   que quien administra el estudio tenia menos herramientas para encontrar una
 *   clase que quien la mira. Eso esta al reves.
 *
 * FORMULARIO GET, SIN JAVASCRIPT
 *   Se envia como querystring y lo resuelve el servidor, igual que la
 *   biblioteca. Asi el filtrado convive con la paginacion: si se filtrara en
 *   memoria sobre la pagina ya traida, "estado: borrador" mostraria solo los
 *   borradores DE ESA PAGINA y pareceria que hay menos de los que hay.
 */

export type OpcionFiltro = { key: string; label: string };

export function AdminBuscador({
  action,
  q,
  placeholder,
  filtros = [],
  total,
  mostrando,
}: {
  /** Ruta del listado, p. ej. "/admin/videos". */
  action: string;
  q: string;
  placeholder: string;
  /** Cada filtro: nombre del parametro, valor actual y sus opciones. */
  filtros?: { name: string; valor: string; etiqueta: string; opciones: OpcionFiltro[] }[];
  total: number;
  mostrando: number;
}) {
  const hayAlgo = Boolean(q) || filtros.some((f) => f.valor);

  return (
    <form method="get" action={action} className="abus" role="search">
      <label className="abus-buscar">
        <Search size={17} strokeWidth={1.8} className="abus-buscar-ico" aria-hidden="true" />
        <input type="search" name="q" defaultValue={q} placeholder={placeholder} aria-label={placeholder} />
        <button type="submit" className="abus-buscar-btn" aria-label="Buscar">
          <ArrowRight size={16} strokeWidth={2} />
        </button>
      </label>

      {filtros.map((f) => (
        <Desplegable
          key={f.name}
          variante="pildora"
          name={f.name}
          defaultValue={f.valor}
          etiqueta={f.etiqueta}
          prefijo={f.etiqueta}
          autoEnviar
          opciones={f.opciones.map((o) => ({ value: o.key, label: o.label }))}
        />
      ))}

      {hayAlgo && (
        <Link href={action as never} className="abus-quitar">
          <X size={13} strokeWidth={2.2} aria-hidden="true" /> Quitar filtros
        </Link>
      )}

      <span className="abus-cuenta">
        {hayAlgo ? <><strong>{mostrando}</strong> de {total}</> : <><strong>{total}</strong> en total</>}
      </span>
    </form>
  );
}
