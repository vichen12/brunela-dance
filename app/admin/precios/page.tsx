import { requireAdmin } from "@/src/features/auth/guards";
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

const inp: React.CSSProperties = {
  width: "100%", borderRadius: 10, border: "1px solid #e7e5e4",
  background: "#fff", color: "#1c1917", padding: "9px 13px",
  fontSize: 13, outline: "none", fontFamily: "inherit",
};

const caja: React.CSSProperties = {
  borderRadius: 22, border: "1.5px solid var(--pink-line)",
  background: "#fff", padding: "22px 24px",
};

function Lbl({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ display: "block", fontSize: 10, fontWeight: 700, letterSpacing: "0.09em", color: "#78716c", textTransform: "uppercase", marginBottom: 5 }}>
      {children}
    </span>
  );
}

/** El cartelito debajo de cada price id. */
function Aviso({ tono, texto }: { tono: "ok" | "aviso" | "gris"; texto: string }) {
  const c =
    tono === "ok" ? { fg: "#166534", bg: "#f0fdf4", bd: "#bbf7d0" }
    : tono === "aviso" ? { fg: "#92400e", bg: "#fffbeb", bd: "#fde68a" }
    : { fg: "#78716c", bg: "#fafaf9", bd: "#f0eeec" };

  return (
    <p style={{
      marginTop: 6, fontSize: 11.5, lineHeight: 1.45, fontWeight: 600,
      color: c.fg, background: c.bg, border: `1px solid ${c.bd}`,
      borderRadius: 9, padding: "6px 10px",
    }}>{texto}</p>
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
    <label style={{ display: "block" }}>
      <Lbl>{etiqueta}</Lbl>
      <input style={inp} name={name} defaultValue={valor ?? ""} placeholder="price_1AbC..." autoComplete="off" spellCheck={false} />
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
    <main style={{ fontFamily: "inherit" }}>
      <header className="hero-stage">
        <p className="eyebrow">Precios</p>
        <h1 className="display" style={{ fontSize: 34, marginTop: 6 }}>Planes y packs</h1>
        <p style={{ fontSize: 14, color: "var(--ink-soft)", marginTop: 8, maxWidth: 620, lineHeight: 1.6 }}>
          Acá cambiás lo que se cobra. Cada precio tiene dos partes: el <strong>importe
          que se muestra</strong> en la web, y el <strong>identificador de Stripe</strong>,
          que es lo que cobra de verdad. Tienen que decir lo mismo — debajo de cada
          identificador te digo cuánto vale en Stripe.
        </p>
      </header>

      <section style={{ maxWidth: 980, margin: "0 auto", padding: "26px 28px", display: "flex", flexDirection: "column", gap: 18 }}>

        {error && (
          <div style={{
            borderRadius: 14, padding: "11px 16px", fontSize: 13, fontWeight: 600,
            background: "#fef2f2", color: "#991b1b", border: "1px solid #fecaca",
          }}>{error}</div>
        )}

        {/* Cual de los dos juegos esta cobrando ahora mismo. Sin esto, los dos
            bloques se ven igual de importantes y no lo son. */}
        <div style={{
          borderRadius: 14, padding: "11px 16px", fontSize: 13,
          background: modoActivo === "live" ? "#f0fdf4" : "#fffbeb",
          color: modoActivo === "live" ? "#166534" : "#92400e",
          border: `1px solid ${modoActivo === "live" ? "#bbf7d0" : "#fde68a"}`,
        }}>
          {modoActivo === "live"
            ? "El sistema está cobrando DE VERDAD. Los identificadores de «Producción» son los que se usan."
            : "El sistema está en modo prueba. Se usan los identificadores de «Prueba»; los de «Producción» todavía no cobran nada."}
        </div>

        {/* ── PLANES ─────────────────────────────────────────────────────── */}

        {!catalogo ? (
          <div style={caja}>
            <p style={{ fontSize: 13, color: "#991b1b" }}>
              No se encontró el catálogo de planes en la configuración. Avisale a Vincenzo.
            </p>
          </div>
        ) : (
          <form action={guardarPreciosDePlanesAction} style={{ ...caja, display: "flex", flexDirection: "column", gap: 22 }}>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 800 }}>Los tres planes</h2>
              <p style={{ fontSize: 12.5, color: "var(--ink-soft)", marginTop: 4 }}>
                Los importes van en euros. Para el anual poné el total del año, no el mensual.
              </p>
            </div>

            {catalogo.tiers.map((t) => (
              <div key={t.tier} style={{ borderTop: "1px solid #f0eeec", paddingTop: 18 }}>
                <p style={{ fontSize: 13.5, fontWeight: 800, marginBottom: 12 }}>
                  {t.tier === "corps_de_ballet" ? "Corps de Ballet" : t.tier === "solista" ? "Solista" : "Principal"}
                </p>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 16 }}>
                  <label>
                    <Lbl>Precio por mes (€)</Lbl>
                    <input style={inp} name={`${t.tier}_mensual`} defaultValue={t.amount_monthly} inputMode="decimal" />
                  </label>
                  <label>
                    <Lbl>Precio del año entero (€)</Lbl>
                    <input style={inp} name={`${t.tier}_anual`} defaultValue={t.amount_yearly} inputMode="decimal" />
                  </label>
                </div>

                {MODOS.map(({ modo, label, ayuda }) => (
                  <div key={modo} style={{ marginBottom: 14 }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: "#57534e", marginBottom: 8 }}>
                      {label}{" "}
                      <span style={{ fontWeight: 500, color: "#a8a29e" }}>— {ayuda}</span>
                      {modo === modoActivo && (
                        <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 700, color: "var(--pink-mid)" }}>EN USO</span>
                      )}
                    </p>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
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
              <BotonEnviar pendingLabel="Guardando…" style={{
                background: "#1c1917", color: "#fff", border: "none", borderRadius: 99,
                padding: "10px 24px", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", cursor: "pointer",
              }}>GUARDAR PRECIOS</BotonEnviar>
            </div>
          </form>
        )}

        {/* ── PACKS ──────────────────────────────────────────────────────── */}

        <div style={caja}>
          <h2 style={{ fontSize: 16, fontWeight: 800 }}>Packs de clases</h2>
          <p style={{ fontSize: 12.5, color: "var(--ink-soft)", marginTop: 4, marginBottom: 16 }}>
            Se pagan una vez y el acceso queda para siempre. Qué clases trae cada
            pack se arma en <strong>Packs</strong>; acá sólo el precio.
          </p>

          {packs.length === 0 ? (
            <p style={{ fontSize: 13, color: "#a8a29e" }}>
              Todavía no hay ningún pack.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              {packs.map((p) => (
                <form
                  key={p.id}
                  action={guardarPrecioDePackAction}
                  style={{ borderTop: "1px solid #f0eeec", paddingTop: 16 }}
                >
                  <input type="hidden" name="id" value={p.id} />

                  <p style={{ fontSize: 13.5, fontWeight: 800, marginBottom: 12 }}>
                    {p.name_i18n?.es ?? p.slug}
                    {!p.is_published && (
                      <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 700, color: "#a8a29e" }}>SIN PUBLICAR</span>
                    )}
                  </p>

                  <div style={{ display: "grid", gridTemplateColumns: "160px 1fr 1fr", gap: 14, alignItems: "start" }}>
                    <label>
                      <Lbl>Precio (€)</Lbl>
                      <input style={inp} name="precio" defaultValue={(p.price_cents / 100).toString()} inputMode="decimal" />
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

                  <div style={{ marginTop: 12 }}>
                    <BotonEnviar pendingLabel="Guardando…" style={{
                      background: "transparent", color: "#1c1917", border: "1px solid #e7e5e4",
                      borderRadius: 99, padding: "8px 18px", fontSize: 11, fontWeight: 700,
                      letterSpacing: "0.08em", cursor: "pointer",
                    }}>GUARDAR ESTE PACK</BotonEnviar>
                  </div>
                </form>
              ))}
            </div>
          )}
        </div>

        <p style={{ fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.6 }}>
          <strong>Un identificador de Stripe no se edita: se reemplaza.</strong> Si querés
          cambiar un precio, en Stripe se crea uno nuevo y se pega acá el nuevo
          identificador. Quien ya está suscripta sigue pagando lo que contrató.
        </p>
      </section>
    </main>
  );
}
