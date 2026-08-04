import Link from "next/link";

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
    <form
      method="get"
      action={action}
      style={{
        display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center",
        marginBottom: 16,
      }}
    >
      <input
        type="search"
        name="q"
        defaultValue={q}
        placeholder={placeholder}
        aria-label={placeholder}
        style={{
          flex: "1 1 240px", minWidth: 200, minHeight: 42,
          padding: "11px 16px", borderRadius: 999,
          border: "1.5px solid #f0eeec", background: "#fff",
          fontSize: 13, color: "#1c1917", outline: "none", fontFamily: "inherit",
        }}
      />

      {filtros.map((f) => (
        <select
          key={f.name}
          name={f.name}
          defaultValue={f.valor}
          aria-label={f.etiqueta}
          style={{
            minHeight: 42, padding: "10px 14px", borderRadius: 999,
            border: `1.5px solid ${f.valor ? "var(--pink)" : "#f0eeec"}`,
            background: f.valor ? "var(--pink-wash)" : "#fff",
            color: f.valor ? "var(--pink-deep)" : "var(--muted)",
            fontSize: 12.5, fontWeight: f.valor ? 700 : 500,
            fontFamily: "inherit", cursor: "pointer", outline: "none",
          }}
        >
          {f.opciones.map((o) => (
            <option key={o.key} value={o.key}>{o.label}</option>
          ))}
        </select>
      ))}

      <button type="submit" style={{
        minHeight: 42, padding: "10px 22px", borderRadius: 999, cursor: "pointer",
        background: "var(--pink)", color: "#fff", border: "none",
        fontSize: 12.5, fontWeight: 700, fontFamily: "inherit",
      }}>Buscar</button>

      {hayAlgo && (
        <Link href={action as never} style={{
          minHeight: 42, display: "inline-flex", alignItems: "center",
          padding: "10px 16px", borderRadius: 999, textDecoration: "none",
          color: "var(--pink-deep)", fontSize: 12.5, fontWeight: 700,
        }}>Quitar</Link>
      )}

      <span style={{ fontSize: 11.5, color: "#a8a29e", marginLeft: "auto" }}>
        {hayAlgo ? `${mostrando} de ${total}` : `${total} en total`}
      </span>
    </form>
  );
}
