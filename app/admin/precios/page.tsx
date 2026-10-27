import Link from "next/link";
import { requireAdmin } from "@/src/features/auth/guards";
import { Check, CircleCheck, FlaskConical, Info, Package, TriangleAlert } from "lucide-react";
import { AdminCabecera } from "@/components/admin-ui";
import { BotonEnviar } from "@/components/boton-enviar";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";
import { getSubscriptionCatalog, stripeMode } from "@/src/lib/stripe/catalog";
import { verificarPrecio, estadoDelCobro } from "@/src/lib/stripe/verificar-precio";
import {
  guardarPreciosDePlanesAction,
  guardarPrecioDePackAction,
} from "@/src/features/admin/precios-actions";

export const dynamic = "force-dynamic";

/**
 * Precios: los tres planes y los packs, en un solo lugar.
 *
 * REHECHA EL 2026-10-27, A PEDIDO
 *   "Que literalmente pueda modificar aca y que quede todo bien." Antes eran
 *   dieciocho casilleros de codigos de Stripe (mensual y anual, prueba y
 *   produccion, por plan) y para cambiar un precio habia que crearlo en Stripe
 *   y pegar el codigo. Ahora se escribe el importe y se guarda: el codigo lo
 *   crea el sistema (src/lib/stripe/asegurar-precio.ts).
 *
 *   Debajo de cada importe sigue la comprobacion contra Stripe, pero en una
 *   frase ("Stripe cobra 16 €"), y solo del modo que cobra. El juego del otro
 *   modo no se muestra: en produccion los codigos de prueba no le sirven a
 *   nadie y verlos hacia pensar que algo estaba en prueba.
 *
 *   Los codigos siguen visibles, de solo lectura, en "Detalles de Stripe".
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

const NOMBRE: Record<string, string> = {
  corps_de_ballet: "Corps de Ballet",
  solista: "Solista",
  principal: "Principal",
};

function Estado({ tono, texto }: { tono: "ok" | "aviso" | "gris"; texto: string }) {
  return (
    <p className={"pr-estado pr-estado--" + tono}>
      {tono === "ok" ? <CircleCheck size={14} strokeWidth={2.4} aria-hidden="true" /> : tono === "aviso" ? <TriangleAlert size={14} strokeWidth={2.4} aria-hidden="true" /> : <Info size={14} strokeWidth={2.4} aria-hidden="true" />}
      {texto}
    </p>
  );
}

function Monto({ name, valor, etiqueta }: { name: string; valor: number; etiqueta: string }) {
  return (
    <label className="pr-campo">
      <span className="pr-etq">{etiqueta}</span>
      <span className="pr-monto">
        <input
          name={name}
          // "24,90", no "24,9"; y "16", no "16,00".
          defaultValue={valor.toLocaleString("es-ES", { useGrouping: false, minimumFractionDigits: Number.isInteger(valor) ? 0 : 2, maximumFractionDigits: 2 })}
          inputMode="decimal"
          required
          pattern="\s*\d+([.,]\d{1,2})?\s*"
          title="Un importe como 16 o 24,90"
          autoComplete="off"
        />
        <span aria-hidden="true">€</span>
      </span>
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
  const error = typeof params.error === "string" ? params.error : null;
  const listo = typeof params.listo === "string" ? params.listo : null;

  const supabase = await createSupabaseServerClient();
  const [catalogo, { data: packsData }] = await Promise.all([
    getSubscriptionCatalog(),
    supabase
      .from("packs")
      .select("id, slug, name_i18n, price_cents, currency, stripe_price_id_test, stripe_price_id_live, is_published")
      .order("display_order"),
  ]);

  const packs = (packsData ?? []) as PackFila[];
  const modo = stripeMode(process.env.STRIPE_SECRET_KEY);
  const consultar = (id: string | null | undefined) => (id ? verificarPrecio(id, modo) : Promise.resolve(null));

  // Todas las consultas a Stripe en paralelo: es red, y son hasta 6 + 1 por pack.
  const [planes, packsConEstado] = await Promise.all([
    Promise.all(
      (catalogo?.tiers ?? []).map(async (t) => {
        const [m, a] = await Promise.all([consultar(t.prices?.[modo]?.monthly), consultar(t.prices?.[modo]?.yearly)]);
        return {
          t,
          mensual: estadoDelCobro(m, Math.round(t.amount_monthly * 100), " por mes"),
          anual: estadoDelCobro(a, Math.round(t.amount_yearly * 100), " por año"),
        };
      })
    ),
    Promise.all(
      packs.map(async (p) => {
        const id = modo === "live" ? p.stripe_price_id_live : p.stripe_price_id_test;
        return { p, id, estado: estadoDelCobro(await consultar(id), p.price_cents) };
      })
    ),
  ]);

  return (
    <main className="pr">
      <style>{CSS}</style>

      <AdminCabecera
        eyebrow="Precios"
        titulo="Lo que pagan tus alumnas"
        lede="Cambiá el número y guardá. Stripe se actualiza solo: no hace falta entrar ahí ni copiar nada."
      />

      <section className="pr-cuerpo">
        {listo && (
          <div role="status" className="pr-banda pr-banda--ok">
            <CircleCheck size={18} strokeWidth={2.4} aria-hidden="true" />
            <span>Listo, guardado. La web y Stripe ya tienen {listo === "pack" ? "el precio nuevo del pack" : "los precios nuevos"}.</span>
          </div>
        )}
        {error && (
          <div role="alert" className="pr-banda pr-banda--error">
            <TriangleAlert size={18} strokeWidth={2.4} aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}
        {modo === "test" && (
          <div className="pr-banda pr-banda--prueba">
            <FlaskConical size={18} strokeWidth={2.4} aria-hidden="true" />
            <span>Modo prueba: acá no se cobra de verdad.</span>
          </div>
        )}

        {/* ── PLANES ─────────────────────────────────────────────────────── */}
        {!catalogo ? (
          <div className="pr-caja"><p className="pr-error">No se encontró el catálogo de planes. Avisale a Vincenzo.</p></div>
        ) : (
          <form action={guardarPreciosDePlanesAction} className="pr-caja">
            <h2 className="pr-h2">Planes</h2>
            <p className="pr-sub">Suscripción con renovación automática. En el anual va el total del año.</p>

            <div className="pr-planes">
              {planes.map(({ t, mensual, anual }) => (
                <div key={t.tier} className={"pr-plan pr-plan--" + t.tier}>
                  <p className="pr-plan-nombre">{NOMBRE[t.tier] ?? t.tier}</p>
                  <Monto name={`${t.tier}_mensual`} valor={t.amount_monthly} etiqueta="Por mes" />
                  <Estado {...mensual} />
                  <Monto name={`${t.tier}_anual`} valor={t.amount_yearly} etiqueta="Por año" />
                  <Estado {...anual} />
                </div>
              ))}
            </div>

            <div className="pr-pie">
              <BotonEnviar pendingLabel="Guardando…" className="pf-guardar">
                <Check size={16} strokeWidth={2.4} aria-hidden="true" /> Guardar planes
              </BotonEnviar>
            </div>
          </form>
        )}

        {/* ── PACKS ──────────────────────────────────────────────────────── */}
        <div className="pr-caja">
          <h2 className="pr-h2">Packs de clases</h2>
          <p className="pr-sub">
            Pago único, acceso para siempre. Las clases de cada pack y las ofertas se arman en{" "}
            <Link href="/admin/packs">Packs</Link>.
          </p>

          {packsConEstado.length === 0 ? (
            <div className="pr-vacio">
              <Package size={18} strokeWidth={2.2} aria-hidden="true" />
              <p>Todavía no hay packs. Cuando crees uno en <Link href="/admin/packs">Packs</Link>, su precio aparece acá.</p>
            </div>
          ) : (
            <div className="pr-packs">
              {packsConEstado.map(({ p, estado }) => (
                <form key={p.id} action={guardarPrecioDePackAction} className="pr-pack">
                  <input type="hidden" name="id" value={p.id} />
                  <div className="pr-pack-nombre">
                    <p>{p.name_i18n?.es ?? p.slug}</p>
                    {!p.is_published && <span className="pr-sin-publicar">Sin publicar</span>}
                  </div>
                  <div className="pr-pack-precio">
                    <Monto name="precio" valor={p.price_cents / 100} etiqueta="Precio" />
                    <Estado {...estado} />
                  </div>
                  <BotonEnviar pendingLabel="Guardando…" className="pr-btn-sec">
                    <Check size={15} strokeWidth={2.4} aria-hidden="true" /> Guardar
                  </BotonEnviar>
                </form>
              ))}
            </div>
          )}
        </div>

        <p className="pr-nota">
          <Info size={16} strokeWidth={2.2} aria-hidden="true" />
          <span>
            Quien ya está suscripta sigue pagando lo que contrató. El precio nuevo vale para
            las que se suman desde que guardás.
          </span>
        </p>

        {/* Solo lectura: por si algun dia hay que buscar algo en Stripe. */}
        <details className="pr-detalles">
          <summary>Detalles de Stripe</summary>
          <p>Códigos que se están usando para cobrar ({modo === "live" ? "producción" : "prueba"}). Los pone el sistema; no hace falta tocarlos.</p>
          <ul>
            {(catalogo?.tiers ?? []).map((t) => (
              <li key={t.tier}>
                <span>{NOMBRE[t.tier] ?? t.tier}</span>
                <code>{t.prices?.[modo]?.monthly ?? "—"}</code>
                <code>{t.prices?.[modo]?.yearly ?? "—"}</code>
              </li>
            ))}
            {packsConEstado.map(({ p, id }) => (
              <li key={p.id}>
                <span>{p.name_i18n?.es ?? p.slug}</span>
                <code>{id ?? "—"}</code>
              </li>
            ))}
          </ul>
        </details>
      </section>
    </main>
  );
}

const CSS = `
.pr { display: flex; flex-direction: column; }
.pr .ad-mast { margin-bottom: 0; }
.pr-cuerpo { width: 100%; padding: 22px 0 40px; display: flex; flex-direction: column; gap: 18px; }

.pr-banda { display: flex; align-items: center; gap: 10px; padding: 13px 18px; border-radius: 18px; font-size: 14px; font-weight: 700; line-height: 1.45; }
.pr-banda svg { flex-shrink: 0; }
.pr-banda--ok { background: var(--salvia); color: var(--salvia-deep); border: 1px solid #CFE3C9; }
.pr-banda--error { background: #FFF0EE; color: var(--pink-deep); border: 1px solid var(--pink-line); }
.pr-banda--prueba { background: #FFF4E8; color: var(--melocoton-deep); border: 1px solid #F6D9C6; }

.pr-caja { padding: clamp(20px, 3vw, 30px); border-radius: 28px; background: #fff; border: 1px solid var(--linea); box-shadow: var(--sombra); }
.pr-h2 { font-size: 20px; font-weight: 900; letter-spacing: -0.02em; color: var(--ink); }
.pr-sub { margin-top: 4px; font-size: 14px; line-height: 1.55; color: var(--muted); }
.pr-sub a, .pr-vacio a { color: var(--pink-deep); font-weight: 800; text-decoration: underline; text-underline-offset: 3px; }
.pr-error { font-size: 14px; font-weight: 700; color: var(--pink-deep); }

.pr-planes { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; margin-top: 20px; }
.pr-plan { display: flex; flex-direction: column; gap: 8px; padding: 20px; border-radius: 24px; border: 1px solid var(--linea); }
.pr-plan--corps_de_ballet { background: linear-gradient(160deg, #FFF6F2, #fff 70%); }
.pr-plan--solista { background: linear-gradient(160deg, #FFEEDB, #fff 70%); }
.pr-plan--principal { background: linear-gradient(160deg, #FFE5E3, #fff 70%); }
.pr-plan-nombre { margin-bottom: 4px; font-size: 17px; font-weight: 900; letter-spacing: -0.01em; color: var(--ink); }
.pr-plan .pr-campo + .pr-estado + .pr-campo { margin-top: 8px; }

.pr-campo { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.pr-etq { font-size: 12.5px; font-weight: 800; letter-spacing: .02em; color: var(--muted); }
.pr-monto { display: flex; align-items: center; height: 52px; padding: 0 16px; border-radius: 16px; border: 1.5px solid var(--linea-fuerte); background: #fff; transition: border-color .2s, box-shadow .2s; }
.pr-monto:focus-within { border-color: var(--pink); box-shadow: 0 0 0 4px rgba(230,79,85,.1); }
.pr-monto input { flex: 1; min-width: 0; border: 0; outline: none; background: transparent; font: inherit; font-size: 22px; font-weight: 900; letter-spacing: -0.02em; color: var(--ink); }
.pr-monto span { font-size: 18px; font-weight: 800; color: var(--muted); }

.pr-estado { display: flex; align-items: flex-start; gap: 6px; font-size: 12.5px; font-weight: 700; line-height: 1.4; }
.pr-estado svg { flex-shrink: 0; margin-top: 1px; }
.pr-estado--ok { color: var(--salvia-deep); }
.pr-estado--aviso { color: var(--melocoton-deep); }
.pr-estado--gris { color: var(--muted); }

.pr-pie { margin-top: 20px; }

.pr-packs { display: flex; flex-direction: column; gap: 10px; margin-top: 18px; }
.pr-pack { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 260px) auto; align-items: center; gap: 16px; padding: 16px 20px; border-radius: 22px; background: var(--crema); border: 1px solid var(--linea); }
.pr-pack-nombre { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; min-width: 0; }
.pr-pack-nombre p { font-size: 16px; font-weight: 900; color: var(--ink); }
.pr-pack-precio { display: flex; flex-direction: column; gap: 6px; }
.pr-pack .pr-etq { display: none; }
.pr-sin-publicar { padding: 2px 10px; border-radius: 99px; background: #FFF4E8; color: var(--melocoton-deep); font-size: 11.5px; font-weight: 800; }
.pr-btn-sec { display: inline-flex; align-items: center; gap: 7px; height: 44px; padding: 0 18px; border-radius: 99px; border: 1.5px solid var(--linea-fuerte); background: #fff; color: var(--ink); cursor: pointer; font: inherit; font-size: 14px; font-weight: 800; transition: background .2s, border-color .2s, transform .3s var(--curva); }
.pr-btn-sec:hover { background: var(--rubor); border-color: var(--pink-line); transform: translateY(-1px); }
.pr-vacio { display: flex; align-items: center; gap: 12px; margin-top: 16px; padding: 16px; border-radius: 20px; background: var(--crema); border: 1.5px dashed var(--linea-fuerte); font-size: 14px; color: var(--muted); }
.pr-vacio svg { flex-shrink: 0; color: var(--melocoton-deep); }

.pr-nota { display: flex; align-items: flex-start; gap: 10px; padding: 14px 18px; border-radius: 18px; background: #FBF8FD; border: 1px solid #EFE3F4; font-size: 13.5px; line-height: 1.55; color: var(--muted); }
.pr-nota svg { flex-shrink: 0; margin-top: 2px; }

.pr-detalles { padding: 0 4px; font-size: 13px; color: var(--muted); }
.pr-detalles summary { cursor: pointer; font-weight: 800; width: fit-content; }
.pr-detalles p { margin: 10px 0 8px; line-height: 1.5; }
.pr-detalles ul { display: flex; flex-direction: column; gap: 6px; }
.pr-detalles li { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.pr-detalles li span { min-width: 130px; font-weight: 700; color: var(--ink); }
.pr-detalles code { padding: 2px 8px; border-radius: 8px; background: var(--crema); font-size: 11.5px; overflow-wrap: anywhere; }

@media (max-width: 980px) {
  .pr-planes { grid-template-columns: minmax(0, 1fr); }
}
@media (max-width: 680px) {
  .pr-pack { grid-template-columns: minmax(0, 1fr); gap: 10px; }
  .pr-pack .pr-btn-sec { justify-self: start; }
}
`;
