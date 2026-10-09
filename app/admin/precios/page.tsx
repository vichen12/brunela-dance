import { requireAdmin } from "@/src/features/auth/guards";
import { Check, CreditCard, Crown, FlaskConical, Info, Package } from "lucide-react";
import { AdminCabecera } from "@/components/admin-ui";
import { BotonEnviar } from "@/components/boton-enviar";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";
import { getSubscriptionCatalog, stripeMode, type StripeMode } from "@/src/lib/stripe/catalog";
import { verificarPrecio, leerVerificacion } from "@/src/lib/stripe/verificar-precio";
import {
  guardarPreciosDePlanesAction,
  guardarPrecioDePackAction,
} from "@/src/features/admin/precios-actions";

export const dynamic = "force-dynamic";

/**
 * Precios: los tres planes y los packs, en un solo lugar.
 *
 * POR QUE ESTA PANTALLA EXISTE
 *   Los precios vivian en `subscriptions.catalog`, dentro de la lista de ajustes
 *   BLOQUEADOS de /admin/settings: se veian y no se editaban. La razon era
 *   buena -- eran doce price ids en un textarea de JSON crudo, y una coma de mas
 *   dejaba de cobrar.
 *
 *   Pero eso dejaba a Brunela sin poder cambiar un precio. Ahora los edita, con
 *   campos de verdad en vez de JSON, y con la salvaguarda de abajo.
 *
 * ⚠️ LA SALVAGUARDA MUESTRA, NO BLOQUEA
 *   El importe que se anuncia y el price id de Stripe son dos datos separados
 *   que tienen que decir lo mismo, y NADA los ata. Se puede cambiar el precio en
 *   Stripe y olvidarse del panel: la landing anuncia 16 EUR y en el checkout
 *   aparecen 20.
 *
 *   Al cargar, esta pantalla le PREGUNTA a Stripe cuanto vale cada price id y lo
 *   muestra al lado. Si no coinciden, avisa. No impide guardar: hay un momento
 *   legitimo en el que no coinciden, que es mientras se esta migrando de precio.
 *
 * ⚠️ POR QUE TARDA UN POCO EN CARGAR
 *   Son hasta 12 consultas a Stripe para los planes mas 2 por pack. Van todas en
 *   paralelo, pero es red: contar con medio segundo. Es el precio de que el
 *   aviso sea real y no una suposicion.
 */

type PackFila = {
  id: string;
  slug: string;
  name_i18n: Record<string, string>;
  price_cents: number;
  currency: string;
  stripe_price_id_test: string | null;
  stripe_price_id_live: string | null;
  is_published: boolean;
};

const MODOS: { modo: StripeMode; label: string; ayuda: string }[] = [
  { modo: "test", label: "Prueba", ayuda: "Para probar sin cobrar de verdad" },
  { modo: "live", label: "Producción", ayuda: "El que cobra de verdad" },
];

/** El cartelito debajo de cada price id. */
function Aviso({ tono, texto }: { tono: "ok" | "aviso" | "gris"; texto: string }) {
  return (
    <p className={"pr-aviso pr-aviso--" + tono}>{texto}</p>
  );
}

/**
 * Un price id con su comprobacion.
 *
 * `esperadoCentimos` es lo que Brunela anuncia; se compara contra lo que dice
 * Stripe. Va en centimos porque es la unidad de Stripe y evita redondeos.
 */
async function CampoPrecio({
  name, valor, modo, esperadoCentimos, moneda, etiqueta,
}: {
  name: string;
  valor: string | null;
  modo: StripeMode;
  esperadoCentimos: number | null;
  moneda: string | null;
  etiqueta: string;
}) {
  const r = valor ? await verificarPrecio(valor, modo) : null;
  const leido = r ? leerVerificacion(r, esperadoCentimos, moneda) : null;

  return (
    <label className="pf-campo pr-campo">
      <span className="pf-etq">{etiqueta}</span>
      <input className="pr-inp pr-inp--id" name={name} defaultValue={valor ?? ""} placeholder="price_1AbC..." autoComplete="off" spellCheck={false} />
      {leido && <Aviso tono={leido.tono} texto={leido.texto} />}
    </label>
  );
}

export default async function AdminPreciosPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const params = (await searchParams) ?? {};
  const error = typeof params.error === "string" ? decodeURIComponent(params.error) : null;

  const supabase = await createSupabaseServerClient();
  const [catalogo, { data: packsData }] = await Promise.all([
    getSubscriptionCatalog(),
    supabase
      .from("packs")
      .select("id, slug, name_i18n, price_cents, currency, stripe_price_id_test, stripe_price_id_live, is_published")
      .order("display_order"),
  ]);

  const packs = (packsData ?? []) as PackFila[];
  const modoActivo = stripeMode(process.env.STRIPE_SECRET_KEY);
  const moneda = catalogo?.currency ?? "eur";

  return (
    <main className="pr">
      <style>{CSS}</style>

      <AdminCabecera
        eyebrow="Precios"
        titulo="Planes y packs"
        lede={<>
          Acá cambiás lo que se cobra. Cada precio tiene dos partes: el <strong>importe
          que se muestra</strong> en la web, y el <strong>identificador de Stripe</strong>,
          que es lo que cobra de verdad. Tienen que decir lo mismo — debajo de cada
          identificador te digo cuánto vale en Stripe.
        </>}
      />

      <section className="pr-cuerpo">

        {error && (
          <div role="status" className="ad-aviso ad-aviso--error">{error}</div>
        )}

        {/* Cual de los dos juegos esta cobrando ahora mismo. Sin esto, los dos
            bloques se ven igual de importantes y no lo son. */}
        <div className={"pr-modo " + (modoActivo === "live" ? "pr-modo--live" : "pr-modo--test")}>
          <span className="pr-modo-ico" aria-hidden="true">
            {modoActivo === "live" ? <CreditCard size={18} strokeWidth={2.2} /> : <FlaskConical size={18} strokeWidth={2.2} />}
          </span>
          <span>
          {modoActivo === "live"
            ? "El sistema está cobrando DE VERDAD. Los identificadores de «Producción» son los que se usan."
            : "El sistema está en modo prueba. Se usan los identificadores de «Prueba»; los de «Producción» todavía no cobran nada."}
          </span>
        </div>

        {/* ── PLANES ─────────────────────────────────────────────────────── */}

        {!catalogo ? (
          <div className="pr-caja">
            <p className="pr-error">
              No se encontró el catálogo de planes en la configuración. Avisale a Vincenzo.
            </p>
          </div>
        ) : (
          <form action={guardarPreciosDePlanesAction} className="pr-caja pr-planes">
            <div className="pr-caja-cab">
              <span className="pr-burbuja"><Crown size={19} strokeWidth={2.2} aria-hidden="true" /></span>
              <div>
                <h2 className="pr-h2">Los tres planes</h2>
                <p className="pr-sub">
                  Los importes van en euros. Para el anual poné el total del año, no el mensual.
                </p>
              </div>
            </div>

            {catalogo.tiers.map((t) => (
              <div key={t.tier} className={"pr-plan pr-plan--" + t.tier}>
                <p className="pr-plan-nombre">
                  {t.tier === "corps_de_ballet" ? "Corps de Ballet" : t.tier === "solista" ? "Solista" : "Principal"}
                </p>

                <div className="pr-grilla pr-importes">
                  <label className="pf-campo">
                    <span className="pf-etq">Precio por mes (€)</span>
                    <input className="pr-inp pr-inp--importe" name={`${t.tier}_mensual`} defaultValue={t.amount_monthly} inputMode="decimal" />
                  </label>
                  <label className="pf-campo">
                    <span className="pf-etq">Precio del año entero (€)</span>
                    <input className="pr-inp pr-inp--importe" name={`${t.tier}_anual`} defaultValue={t.amount_yearly} inputMode="decimal" />
                  </label>
                </div>

                {MODOS.map(({ modo, label, ayuda }) => (
                  <div key={modo} className={"pr-modo-bloque" + (modo === modoActivo ? " es-en-uso" : "")}>
                    <p className="pr-modo-titulo">
                      {label}{" "}
                      <span className="pr-modo-ayuda">— {ayuda}</span>
                      {modo === modoActivo && (
                        <span className="pr-en-uso">En uso</span>
                      )}
                    </p>
                    <div className="pr-grilla">
                      <CampoPrecio
                        name={`${t.tier}_${modo}_mensual`}
                        valor={t.prices?.[modo]?.monthly ?? null}
                        modo={modo}
                        esperadoCentimos={Math.round(t.amount_monthly * 100)}
                        moneda={moneda}
                        etiqueta="Identificador mensual"
                      />
                      <CampoPrecio
                        name={`${t.tier}_${modo}_anual`}
                        valor={t.prices?.[modo]?.yearly ?? null}
                        modo={modo}
                        esperadoCentimos={Math.round(t.amount_yearly * 100)}
                        moneda={moneda}
                        etiqueta="Identificador anual"
                      />
                    </div>
                  </div>
                ))}
              </div>
            ))}

            <div>
              <BotonEnviar pendingLabel="Guardando…" className="pf-guardar">
                <Check size={16} strokeWidth={2.4} aria-hidden="true" /> Guardar precios
              </BotonEnviar>
            </div>
          </form>
        )}

        {/* ── PACKS ──────────────────────────────────────────────────────── */}

        <div className="pr-caja">
          <div className="pr-caja-cab">
            <span className="pr-burbuja pr-burbuja--melo"><Package size={19} strokeWidth={2.2} aria-hidden="true" /></span>
            <div>
              <h2 className="pr-h2">Packs de clases</h2>
              <p className="pr-sub">
                Se pagan una vez y el acceso queda para siempre. Qué clases trae cada
                pack se arma en <strong>Packs</strong>; acá sólo el precio.
              </p>
            </div>
          </div>

          {packs.length === 0 ? (
            <div className="pr-vacio">
              <span className="pr-burbuja pr-burbuja--melo"><Package size={18} strokeWidth={2.2} aria-hidden="true" /></span>
              <p>Todavía no hay ningún pack.</p>
            </div>
          ) : (
            <div className="pr-packs">
              {packs.map((p) => (
                <form
                  key={p.id}
                  action={guardarPrecioDePackAction}
                  className="pr-pack"
                >
                  <input type="hidden" name="id" value={p.id} />

                  <p className="pr-plan-nombre">
                    {p.name_i18n?.es ?? p.slug}
                    {!p.is_published && (
                      <span className="pr-sin-publicar">Sin publicar</span>
                    )}
                  </p>

                  <div className="pr-grilla pr-grilla--pack">
                    <label className="pf-campo">
                      <span className="pf-etq">Precio (€)</span>
                      <input className="pr-inp pr-inp--importe" name="precio" defaultValue={(p.price_cents / 100).toString()} inputMode="decimal" />
                    </label>
                    <CampoPrecio
                      name="priceTest"
                      valor={p.stripe_price_id_test}
                      modo="test"
                      esperadoCentimos={p.price_cents}
                      moneda={p.currency}
                      etiqueta="Identificador — prueba"
                    />
                    <CampoPrecio
                      name="priceLive"
                      valor={p.stripe_price_id_live}
                      modo="live"
                      esperadoCentimos={p.price_cents}
                      moneda={p.currency}
                      etiqueta="Identificador — producción"
                    />
                  </div>

                  <div className="pr-pack-pie">
                    <BotonEnviar pendingLabel="Guardando…" className="pr-btn-sec">
                      <Check size={15} strokeWidth={2.4} aria-hidden="true" /> Guardar este pack
                    </BotonEnviar>
                  </div>
                </form>
              ))}
            </div>
          )}
        </div>

        <p className="pr-nota">
          <span className="pr-burbuja pr-burbuja--chica"><Info size={16} strokeWidth={2.2} aria-hidden="true" /></span>
          <span>
          <strong>Un identificador de Stripe no se edita: se reemplaza.</strong> Si querés
          cambiar un precio, en Stripe se crea uno nuevo y se pega acá el nuevo
          identificador. Quien ya está suscripta sigue pagando lo que contrató.
          </span>
        </p>
      </section>
    </main>
  );
}

const CSS = `
.pr { display: flex; flex-direction: column; }
.pr .ad-mast { margin-bottom: 0; }
.pr .ad-lede strong { color: var(--ink); }
.pr-cuerpo { width: 100%; padding: 22px 0 40px; display: flex; flex-direction: column; gap: 18px; }

.pr-modo { display: flex; align-items: center; gap: 12px; padding: 14px 18px; border-radius: 20px; font-size: 14px; font-weight: 700; line-height: 1.5; }
.pr-modo-ico { width: 38px; height: 38px; border-radius: 13px; flex-shrink: 0; display: grid; place-items: center; background: #fff; }
.pr-modo--live { background: var(--salvia); color: var(--salvia-deep); border: 1px solid #CFE3C9; }
.pr-modo--test { background: #FFF4E8; color: var(--melocoton-deep); border: 1px solid #F6D9C6; }

.pr-caja { padding: clamp(20px, 3vw, 30px); border-radius: 28px; background: #fff; border: 1px solid var(--linea); box-shadow: var(--sombra); }
.pr-planes { display: flex; flex-direction: column; gap: 16px; }
.pr-caja-cab { display: flex; align-items: flex-start; gap: 14px; margin-bottom: 4px; }
.pr-burbuja { width: 42px; height: 42px; border-radius: 14px; flex-shrink: 0; display: grid; place-items: center; background: var(--rubor); color: var(--pink-deep); }
.pr-burbuja--melo { background: #FFF4E8; color: var(--melocoton-deep); }
.pr-burbuja--chica { width: 32px; height: 32px; border-radius: 11px; background: #F7F0FA; color: #7A4F8C; }
.pr-h2 { font-size: 19px; font-weight: 900; letter-spacing: -0.02em; color: var(--ink); }
.pr-sub { margin-top: 3px; font-size: 13.5px; line-height: 1.55; color: var(--muted); }
.pr-sub strong { color: var(--ink); }
.pr-error { font-size: 14px; font-weight: 700; color: var(--pink-deep); }

.pr-plan { padding: 20px; border-radius: 24px; border: 1px solid var(--linea); }
.pr-plan--corps_de_ballet { background: linear-gradient(150deg, #FFF6F2, #fff 60%); }
.pr-plan--solista { background: linear-gradient(150deg, #FFEEDB, #fff 60%); }
.pr-plan--principal { background: linear-gradient(150deg, #FFE5E3, #fff 60%); }
.pr-plan-nombre { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 14px; font-size: 16px; font-weight: 900; letter-spacing: -0.01em; color: var(--ink); }
.pr-grilla { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; align-items: start; }
.pr-grilla--pack { grid-template-columns: 170px minmax(0, 1fr) minmax(0, 1fr); }
.pr-importes { margin-bottom: 14px; }
.pr-inp { width: 100%; height: 46px; padding: 0 14px; border-radius: 16px; border: 1.5px solid var(--linea-fuerte); background: #fff; color: var(--ink); font: inherit; font-size: 14px; outline: none; transition: border-color .2s, box-shadow .2s; }
.pr-inp:focus { border-color: var(--pink); box-shadow: 0 0 0 4px rgba(230,79,85,.1); }
.pr-inp--importe { font-size: 16px; font-weight: 800; }
.pr-inp--id { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12.5px; }
.pr-campo { min-width: 0; }

.pr-modo-bloque { padding: 14px; border-radius: 20px; background: rgba(255,255,255,.75); border: 1px dashed var(--linea-fuerte); }
.pr-modo-bloque + .pr-modo-bloque { margin-top: 10px; }
.pr-modo-bloque.es-en-uso { border-style: solid; border-color: var(--pink-line); background: #fff; }
.pr-modo-titulo { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; margin-bottom: 10px; font-size: 13.5px; font-weight: 800; color: var(--ink); }
.pr-modo-ayuda { font-weight: 600; color: var(--muted); }
.pr-en-uso { margin-left: 4px; padding: 2px 10px; border-radius: 99px; background: var(--pink); color: #fff; font-size: 11.5px; font-weight: 800; }

.pr-aviso { display: flex; align-items: flex-start; gap: 7px; margin-top: 4px; padding: 8px 12px; border-radius: 14px; font-size: 12.5px; line-height: 1.45; font-weight: 700; }
.pr-aviso svg { flex-shrink: 0; margin-top: 1px; }
.pr-aviso--ok { background: var(--salvia); color: var(--salvia-deep); }
.pr-aviso--aviso { background: #FFF4E8; color: var(--melocoton-deep); border: 1px solid #F6D9C6; }
.pr-aviso--gris { background: var(--crema); color: var(--muted); border: 1px solid var(--linea); }

.pr-packs { display: flex; flex-direction: column; gap: 12px; margin-top: 16px; }
.pr-pack { padding: 18px 20px; border-radius: 24px; background: var(--crema); border: 1px solid var(--linea); }
.pr-sin-publicar { padding: 2px 10px; border-radius: 99px; background: #FFF4E8; color: var(--melocoton-deep); font-size: 11.5px; font-weight: 800; letter-spacing: 0; }
.pr-pack-pie { margin-top: 14px; }
.pr-btn-sec { display: inline-flex; align-items: center; gap: 7px; height: 42px; padding: 0 18px; border-radius: 99px; border: 1.5px solid var(--linea-fuerte); background: #fff; color: var(--ink); cursor: pointer; font: inherit; font-size: 13.5px; font-weight: 800; transition: background .2s, border-color .2s, transform .3s var(--curva); }
.pr-btn-sec:hover { background: var(--rubor); border-color: var(--pink-line); transform: translateY(-1px); }
.pr-vacio { display: flex; align-items: center; gap: 12px; margin-top: 16px; padding: 16px; border-radius: 20px; background: var(--crema); border: 1.5px dashed var(--linea-fuerte); font-size: 14px; color: var(--muted); }

.pr-nota { display: flex; align-items: flex-start; gap: 12px; padding: 16px 18px; border-radius: 20px; background: #FBF8FD; border: 1px solid #EFE3F4; font-size: 13.5px; line-height: 1.6; color: var(--muted); }
.pr-nota strong { color: var(--ink); }

@media (max-width: 760px) {
  .pr-grilla, .pr-grilla--pack { grid-template-columns: minmax(0, 1fr); }
  .pr-plan, .pr-pack { padding: 16px; }
  .pr-modo-bloque { padding: 12px; }
}
`;
