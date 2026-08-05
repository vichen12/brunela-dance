import Link from "next/link";

/**
 * Los packs, en la portada pública.
 *
 * ⚠️ ESTE COMPONENTE NUNCA VE UN ID DE VIDEO. Recibe lo que devuelve la vista
 *    `packs_publicos`, que no los selecciona. El identificador publico de un
 *    pack es su SLUG, y con el slug solo no se reproduce nada: el precio se
 *    resuelve en el servidor y el acceso lo decide RLS.
 *
 * ⚠️ ES UN SERVER COMPONENT A PROPOSITO. No necesita estado, y asi no cruza
 *    nada por la frontera servidor/cliente -- que es la trampa 6.
 */

export type PackPublico = {
  slug: string;
  name_i18n: Record<string, string>;
  description_i18n: Record<string, string>;
  price_cents: number;
  currency: string;
  cover_image_url: string | null;
  is_featured: boolean;
  cantidad_clases: number;
};

function precio(centimos: number, moneda: string) {
  return `${(centimos / 100).toLocaleString("es-ES", {
    minimumFractionDigits: centimos % 100 === 0 ? 0 : 2,
  })} ${moneda.toUpperCase()}`;
}

export function PacksPublicos({ packs }: { packs: PackPublico[] }) {
  return (
    <div style={{ marginTop: 64 }}>
      <div style={{ textAlign: "center", maxWidth: 560, margin: "0 auto 28px" }}>
        <h3 className="display" style={{ fontSize: 26 }}>¿No querés una suscripción?</h3>
        <p style={{ fontSize: 14.5, color: "var(--ink-soft)", marginTop: 8, lineHeight: 1.6 }}>
          Llevate un pack de clases con un solo pago. Son tuyas para siempre, sin
          renovación ni compromiso.
        </p>
      </div>

      <div style={{
        display: "grid", gap: 18,
        gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
        maxWidth: 940, margin: "0 auto",
      }}>
        {packs.map((p) => (
          <article
            key={p.slug}
            style={{
              borderRadius: 22, overflow: "hidden", background: "#fff",
              border: `1.5px solid ${p.is_featured ? "var(--pink-mid)" : "var(--pink-line)"}`,
              display: "flex", flexDirection: "column",
            }}
          >
            {p.cover_image_url && (
              <div
                style={{
                  height: 132, backgroundColor: "var(--pink-wash)",
                  backgroundImage: `url(${p.cover_image_url})`,
                  backgroundSize: "cover", backgroundPosition: "center",
                }}
                role="presentation"
              />
            )}

            <div style={{ padding: "20px 22px", display: "flex", flexDirection: "column", flex: 1, gap: 10 }}>
              {p.is_featured && (
                <span style={{
                  alignSelf: "flex-start", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em",
                  color: "#fff", background: "var(--pink-mid)", borderRadius: 99, padding: "3px 10px",
                }}>RECOMENDADO</span>
              )}

              <h4 style={{ fontSize: 17, fontWeight: 800, color: "var(--ink)" }}>
                {p.name_i18n?.es ?? p.slug}
              </h4>

              {p.description_i18n?.es && (
                <p style={{ fontSize: 13.5, color: "var(--ink-soft)", lineHeight: 1.6 }}>
                  {p.description_i18n.es}
                </p>
              )}

              <p style={{ fontSize: 12.5, color: "var(--ink-soft)", fontWeight: 600 }}>
                {p.cantidad_clases === 1 ? "1 clase" : `${p.cantidad_clases} clases`} · acceso permanente
              </p>

              <p style={{ fontSize: 26, fontWeight: 800, color: "var(--ink)", marginTop: "auto" }}>
                {precio(p.price_cents, p.currency)}
                <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink-soft)", marginLeft: 8 }}>
                  pago único
                </span>
              </p>

              {/* Mismo camino que los planes: se reusa /registro, que valida el
                  parametro contra la base. El precio no viaja por la URL. */}
              <Link
                href={`/registro?pack=${p.slug}` as never}
                style={{
                  display: "inline-block", textAlign: "center", textDecoration: "none",
                  background: "var(--pink-mid)", color: "#fff", borderRadius: 99,
                  padding: "11px 20px", fontSize: 12, fontWeight: 700, letterSpacing: "0.08em",
                }}
              >
                LLEVAR ESTE PACK
              </Link>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
