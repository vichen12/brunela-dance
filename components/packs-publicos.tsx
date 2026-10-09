import Link from "next/link";
import { ArrowRight, Lock, Package } from "lucide-react";
import { T } from "@/components/language-provider";

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
  /**
   * "Solista y Principal" si el pack es solo para algunos planes, o null.
   * NO sale de la vista: lo arma app/page.tsx con una consulta aparte (slug +
   * lista) que tolera que la migracion 20261009_4 no este corrida.
   */
  solo_para?: string | null;
};

function precio(centimos: number, moneda: string) {
  return `${(centimos / 100).toLocaleString("es-ES", {
    minimumFractionDigits: centimos % 100 === 0 ? 0 : 2,
  })} ${moneda.toUpperCase()}`;
}

/*
 * Los estilos viven en app/estilos/landing.css (bloque "PACKS"). Los textos de
 * la interfaz van por <T>, que es de cliente pero recibe solo una cadena: no
 * cruza ninguna funcion por la frontera. El nombre y la descripcion del pack
 * siguen en espanol, como los carga Brunela.
 */
export function PacksPublicos({ packs }: { packs: PackPublico[] }) {
  return (
    <div className="lp-packs">
      <div className="lp-packs-cabeza" data-lp-revelar>
        <span className="lp-burbuja lp-burbuja-melocoton" aria-hidden>
          <Package size={19} strokeWidth={2} />
        </span>
        <h3 className="lp-packs-titulo">
          <T id="packs.title" />
        </h3>
        <p className="lp-bajada">
          <T id="packs.lead" />
        </p>
      </div>

      <div className="lp-packs-grid">
        {packs.map((p) => (
          <article key={p.slug} className={`lp-pack${p.is_featured ? " is-featured" : ""}`} data-lp-revelar>
            {p.cover_image_url && (
              <div
                className="lp-pack-portada lp-foto"
                style={{ backgroundImage: `url(${p.cover_image_url})` }}
                role="presentation"
              />
            )}

            <div className="lp-pack-cuerpo">
              {p.is_featured && (
                <span className="lp-pack-recomendado">
                  <T id="packs.featured" />
                </span>
              )}

              <h4 className="lp-pack-nombre">{p.name_i18n?.es ?? p.slug}</h4>

              {p.description_i18n?.es && <p className="lp-pack-desc">{p.description_i18n.es}</p>}

              <p className="lp-pack-meta">
                <span className="lp-pack-chip">
                  {p.cantidad_clases === 1 ? (
                    <T id="packs.oneClass" />
                  ) : (
                    <T id="packs.nClasses" replacements={{ n: p.cantidad_clases }} />
                  )}
                </span>
                <span className="lp-pack-chip es-melocoton">
                  <T id="packs.forever" />
                </span>
              </p>

              {p.solo_para && (
                <span className="lp-pack-solo">
                  <Lock size={12} strokeWidth={2.6} aria-hidden />
                  <T id="packs.onlyFor" replacements={{ planes: p.solo_para }} />
                </span>
              )}

              <p className="lp-pack-precio">
                {precio(p.price_cents, p.currency)}
                <span>
                  <T id="packs.oneTime" />
                </span>
              </p>

              {/* Mismo camino que los planes: se reusa /registro, que valida el
                  parametro contra la base. El precio no viaja por la URL. */}
              {/* Solo para algunos planes: quien llega desde la portada todavia
                  no tiene ninguno, asi que no se la manda a pagar algo que el
                  checkout le va a rechazar. Primero el plan. */}
              {p.solo_para ? (
                <Link href={"#planes" as never} className="lp-pack-accion">
                  <T id="packs.seePlans" />
                  <ArrowRight size={15} strokeWidth={2.4} aria-hidden />
                </Link>
              ) : (
                <Link href={`/registro?pack=${p.slug}` as never} className="lp-pack-accion">
                  <T id="packs.cta" />
                  <ArrowRight size={15} strokeWidth={2.4} aria-hidden />
                </Link>
              )}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
