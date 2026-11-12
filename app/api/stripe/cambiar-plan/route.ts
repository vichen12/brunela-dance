import Stripe from "stripe";
import { NextResponse } from "next/server";
import { getStripeServerEnv, hasStripeServerEnv } from "@/src/lib/env";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";
import { createSupabaseAdminClient } from "@/src/lib/supabase/admin";
import { getSubscriptionCatalog, resolvePriceId, stripeMode, type BillingInterval, type CatalogTier } from "@/src/lib/stripe/catalog";

/**
 * Cambiar de plan con la suscripcion que YA tiene, cobrando solo la diferencia.
 *
 * POR QUE EXISTE (2026-11-09)
 *   "Cambiar a este plan" abria el portal de Stripe, que tenia el cambio de plan
 *   prendido pero SIN NINGUN PLAN cargado para elegir: la alumna no podia
 *   cambiar. Esto hace el cambio directo, en dos pasos:
 *
 *   1. { confirmar: false } -> cuanto se cobra HOY (la diferencia por lo que
 *      queda del periodo) o cuanto le queda a favor si baja. No cambia nada.
 *   2. { confirmar: true, fecha } -> el cambio, con la MISMA fecha de prorrateo
 *      del paso 1, asi se cobra exactamente lo que se le mostro.
 *
 * COMO SE COBRA
 *   proration_behavior 'always_invoice': la diferencia se factura y se cobra en
 *   el momento (una bajada deja saldo a favor para el proximo cobro).
 *   payment_behavior 'pending_if_incomplete': si el pago falla o el banco pide
 *   verificacion, el plan NO cambia hasta que se pague. Nunca queda con el plan
 *   nuevo sin haberlo pagado.
 *
 * LA BASE LA ACTUALIZA EL WEBHOOK (customer.subscription.updated), como con
 * cualquier otro cambio de Stripe: aca no se escribe el plan a mano.
 *
 * Del navegador sale solo { tier, interval }: el precio lo resuelve el servidor
 * contra el catalogo, igual que en el checkout.
 */

const TIERS: CatalogTier["tier"][] = ["corps_de_ballet", "solista", "principal"];
const INTERVALOS: BillingInterval[] = ["monthly", "yearly"];
/** La fecha del presupuesto vale media hora: despues se recalcula. */
const VIGENCIA_PRESUPUESTO_S = 30 * 60;

function error(mensaje: string, status = 400) {
  return NextResponse.json({ error: mensaje }, { status });
}

export async function POST(request: Request) {
  if (!hasStripeServerEnv()) return error("Los pagos no están disponibles ahora.", 503);

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return error("Tenés que entrar a tu cuenta.", 401);

  const body = (await request.json().catch(() => null)) as { tier?: string; interval?: string; confirmar?: boolean; fecha?: number } | null;
  const tier = TIERS.find((t) => t === body?.tier);
  const interval = INTERVALOS.find((i) => i === body?.interval);
  if (!tier || !interval) return error("Elegí un plan.");

  const admin = createSupabaseAdminClient();
  const { data: sub } = await admin
    .from("subscriptions")
    .select("provider_subscription_id")
    .eq("user_id", user.id)
    .in("status", ["active", "trialing"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ provider_subscription_id: string }>();
  if (!sub?.provider_subscription_id) return error("No tenés un plan activo para cambiar.");

  const catalog = await getSubscriptionCatalog();
  const env = getStripeServerEnv();
  const priceId = catalog ? resolvePriceId(catalog, tier, interval, stripeMode(env.STRIPE_SECRET_KEY)) : null;
  if (!priceId) return error("Ese plan todavía no se puede contratar.");

  // Con tope de espera: la alumna esta mirando el boton.
  const stripe = new Stripe(env.STRIPE_SECRET_KEY, { timeout: 15_000, maxNetworkRetries: 1 });

  try {
    const s = await stripe.subscriptions.retrieve(sub.provider_subscription_id);
    if (s.status !== "active" && s.status !== "trialing") return error("Tu plan no está activo. Revisá tu tarjeta en «Gestionar».");
    const item = s.items.data[0];
    if (!item) return error("No encontramos tu plan en Stripe. Escribinos y lo resolvemos.");
    if (item.price.id === priceId) return error("Ya estás en ese plan.");

    const ahora = Math.floor(Date.now() / 1000);
    const fecha = body?.confirmar && typeof body.fecha === "number" && body.fecha <= ahora && ahora - body.fecha < VIGENCIA_PRESUPUESTO_S
      ? Math.floor(body.fecha)
      : ahora;
    const items = [{ id: item.id, price: priceId }];

    if (!body?.confirmar) {
      const p = await stripe.invoices.createPreview({
        customer: typeof s.customer === "string" ? s.customer : s.customer.id,
        subscription: s.id,
        subscription_details: { items, proration_behavior: "always_invoice", proration_date: fecha },
      });
      return NextResponse.json({
        fecha,
        moneda: p.currency,
        cobroHoyCentimos: Math.max(0, p.amount_due),
        aFavorCentimos: p.total < 0 ? -p.total : 0,
        enPrueba: s.status === "trialing",
      });
    }

    const actualizada = await stripe.subscriptions.update(s.id, {
      items,
      proration_behavior: "always_invoice",
      proration_date: fecha,
      payment_behavior: "pending_if_incomplete",
      expand: ["latest_invoice"],
    });

    // El banco pidio verificacion o el pago fallo: el plan sigue igual hasta pagar.
    if (actualizada.pending_update) {
      const factura = actualizada.latest_invoice as Stripe.Invoice | null;
      return NextResponse.json({ estado: "pendiente", url: factura?.hosted_invoice_url ?? null });
    }

    // Si habia pedido la baja, cambiar de plan es querer seguir.
    //
    // La espera es a proposito: Stripe fecha los avisos por SEGUNDO, y dos
    // cambios en el mismo segundo pueden llegar en cualquier orden; el del
    // plan viejo podia pisar al nuevo.
    if (actualizada.cancel_at_period_end) {
      await new Promise((r) => setTimeout(r, 1200));
      await stripe.subscriptions.update(s.id, { cancel_at_period_end: false });
    }
    return NextResponse.json({ estado: "listo" });
  } catch (e) {
    const err = e as Stripe.errors.StripeError;
    console.error("[cambiar-plan]", err?.message ?? e);
    if (err?.type === "StripeCardError") return error("Tu tarjeta rechazó el cobro de la diferencia. El plan no cambió.");
    return error("No pudimos cambiar el plan ahora. Probá de nuevo en un rato; si ves un cobro que no corresponde, escribinos.", 502);
  }
}
