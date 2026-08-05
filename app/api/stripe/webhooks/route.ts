import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import { NextResponse } from "next/server";
import { getStripeServerEnv } from "@/src/lib/env";
import { getSubscriptionCatalog, resolveTierFromPriceId } from "@/src/lib/stripe/catalog";

function createServiceRoleClient() {
  const env = getStripeServerEnv();
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
}

async function resolveMembershipTierFromPriceId(priceId: string | null) {
  if (!priceId) {
    return null;
  }

  const catalog = await getSubscriptionCatalog();
  if (!catalog) return null;
  return resolveTierFromPriceId(catalog, priceId);
}

async function persistWebhookAudit(event: Stripe.Event, processingError: string | null) {
  const supabase = createServiceRoleClient();

  await supabase.from("subscription_webhook_events").upsert(
    {
      provider: "stripe",
      provider_event_id: event.id,
      event_type: event.type,
      payload: event as unknown as Record<string, unknown>,
      processed_at: processingError ? null : new Date().toISOString(),
      processing_error: processingError
    },
    {
      onConflict: "provider_event_id"
    }
  );
}

/**
 * Statuses a subscription can never come back from.
 *
 * Stripe does not resurrect a cancelled subscription: if the member signs up
 * again they get a NEW subscription with a NEW id, which lands in its own row.
 * So for one provider_subscription_id, reaching 'canceled' is final.
 *
 * This is NOT the same as cancelling from the Billing Portal, which by default
 * only sets cancel_at_period_end and leaves the status 'active' until the paid
 * period runs out. That path never reaches a terminal status, so a member who
 * cancels and then changes their mind before the period ends is unaffected.
 */
const TERMINAL_STATUSES = new Set<string>(["canceled", "incomplete_expired"]);

type SyncOutcome = { applied: true } | { applied: false; reason: string };

async function syncSubscription(event: Stripe.Event): Promise<SyncOutcome> {
  if (
    event.type !== "customer.subscription.created" &&
    event.type !== "customer.subscription.updated" &&
    event.type !== "customer.subscription.deleted"
  ) {
    return { applied: false, reason: `evento ${event.type} no afecta suscripciones` };
  }

  const subscription = event.data.object as Stripe.Subscription;
  const supabase = createServiceRoleClient();
  const userId = subscription.metadata.user_id;
  const priceId = subscription.items.data[0]?.price.id ?? null;

  // These two used to share one message, which made them impossible to tell
  // apart from the Stripe dashboard. They have completely different fixes.
  if (!userId) {
    throw new Error(
      `La suscripcion ${subscription.id} no trae metadata.user_id. Solo las creadas ` +
        `desde /api/stripe/checkout lo llevan; si esta se creo a mano en el panel de ` +
        `Stripe, agregale user_id en Metadata y reenvia el evento.`
    );
  }

  const membershipTier = await resolveMembershipTierFromPriceId(priceId);
  if (!membershipTier) {
    throw new Error(
      `El precio ${priceId ?? "(ninguno)"} no esta mapeado a ningun plan, ni en test ni ` +
        `en live. Pegalo en site_settings -> subscriptions.catalog, en prices.test o ` +
        `prices.live segun de donde venga, y reenvia el evento; Stripe reintenta solo y ` +
        `esto se resuelve sin perder nada.`
    );
  }

  // event.created is stamped by Stripe, so it orders events correctly even
  // though DELIVERY order is not guaranteed and failed deliveries are retried.
  const eventAt = new Date(event.created * 1000).toISOString();

  const { data: existing } = await supabase
    .from("subscriptions")
    .select("status, last_event_at")
    .eq("provider_subscription_id", subscription.id)
    .maybeSingle<{ status: string; last_event_at: string | null }>();

  // GUARD 1 -- ordering. Anything older than what we already applied is stale.
  // Equal timestamps are allowed through: that is a replay of the same event,
  // which rewrites identical data and is a no-op.
  if (existing?.last_event_at && Date.parse(existing.last_event_at) > Date.parse(eventAt)) {
    return {
      applied: false,
      reason:
        `evento de ${eventAt} descartado: la fila ya tiene uno mas nuevo ` +
        `(${existing.last_event_at})`
    };
  }

  // GUARD 2 -- terminal state. Guard 1 alone is not enough: Stripe can stamp two
  // events with the SAME second, so a 'deleted' and a stale 'updated' can tie,
  // and the tie would slip through and set the row back to active. That is the
  // exact failure that hands free access to someone who cancelled, so cancelled
  // is treated as final regardless of timestamps.
  if (
    existing &&
    TERMINAL_STATUSES.has(existing.status) &&
    !TERMINAL_STATUSES.has(subscription.status)
  ) {
    return {
      applied: false,
      reason:
        `la suscripcion ya estaba en '${existing.status}', que es definitivo; ` +
        `no se revive con '${subscription.status}'`
    };
  }

  const payload = {
    user_id: userId,
    provider: "stripe",
    provider_customer_id:
      typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id ?? null,
    provider_subscription_id: subscription.id,
    provider_price_id: priceId,
    membership_tier: membershipTier,
    status: subscription.status,
    cancel_at_period_end: subscription.cancel_at_period_end,
    trial_starts_at: subscription.trial_start ? new Date(subscription.trial_start * 1000).toISOString() : null,
    trial_ends_at: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
    current_period_starts_at: subscription.items.data[0]?.current_period_start
      ? new Date(subscription.items.data[0].current_period_start * 1000).toISOString()
      : null,
    current_period_ends_at: subscription.items.data[0]?.current_period_end
      ? new Date(subscription.items.data[0].current_period_end * 1000).toISOString()
      : null,
    canceled_at: subscription.canceled_at ? new Date(subscription.canceled_at * 1000).toISOString() : null,
    ended_at: subscription.ended_at ? new Date(subscription.ended_at * 1000).toISOString() : null,
    last_webhook_event_id: event.id,
    last_event_at: eventAt,
    metadata: subscription.metadata
  };

  const { error } = await supabase.from("subscriptions").upsert(payload, {
    onConflict: "provider_subscription_id"
  });

  // This used to be unchecked: a failed write answered 200 and Stripe never
  // retried, so the subscription silently never reached the database.
  if (error) {
    throw new Error(`No se pudo guardar la suscripcion ${subscription.id}: ${error.message}`);
  }

  return { applied: true };
}

/**
 * Registra la compra de un pack (pago unico).
 *
 * ⚠️ ES ADITIVO: no toca `syncSubscription` ni nada de lo que ya andaba. Los dos
 *    caminos miran tipos de evento distintos y ninguno puede pisar al otro.
 *
 * ⚠️ LA METADATA ESTA EN OTRO LADO. Una suscripcion trae `metadata.user_id` en
 *    el objeto suscripcion; en un pago unico NO HAY objeto suscripcion, y viaja
 *    en `session.metadata`. Es la trampa 1 con otro disfraz.
 *
 * ⚠️ IDEMPOTENCIA. Sincronizar una suscripcion es naturalmente idempotente:
 *    escribe el estado actual. Esto es un INSERT, y Stripe REINTENTA ante
 *    cualquier duda. El `unique` sobre stripe_checkout_session_id es lo que
 *    impide dos packs por un pago; aca se trata el 23505 como exito, porque el
 *    estado deseado ya esta.
 */
async function registrarCompraDePack(event: Stripe.Event): Promise<SyncOutcome> {
  if (event.type !== "checkout.session.completed") {
    return { applied: false, reason: `evento ${event.type} no es una compra de pack` };
  }

  const session = event.data.object as Stripe.Checkout.Session;

  // El mismo evento lo dispara tambien el checkout de suscripciones. Ese camino
  // lo resuelve customer.subscription.*, asi que aca se ignora.
  if (session.mode !== "payment") {
    return { applied: false, reason: `la sesion ${session.id} no es un pago unico` };
  }

  if (session.payment_status !== "paid") {
    return { applied: false, reason: `la sesion ${session.id} todavia no esta pagada` };
  }

  const userId = session.metadata?.user_id;
  const packId = session.metadata?.pack_id;

  // Se separan a proposito: tienen arreglos distintos y con un solo mensaje eran
  // imposibles de distinguir desde el panel de Stripe.
  if (!userId) {
    throw new Error(
      `La sesion de pago ${session.id} no trae metadata.user_id. Solo las creadas desde ` +
        `/api/stripe/checkout-pack lo llevan; si se creo a mano, hay que asignar el pack a mano.`
    );
  }
  if (!packId) {
    throw new Error(
      `La sesion de pago ${session.id} no trae metadata.pack_id, asi que no se puede saber ` +
        `que pack se compro. Revisar /api/stripe/checkout-pack.`
    );
  }

  const supabase = createServiceRoleClient();
  const { error } = await supabase.from("pack_purchases").insert({
    user_id: userId,
    pack_id: packId,
    stripe_checkout_session_id: session.id,
    stripe_payment_intent_id:
      typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id ?? null,
    // Lo que se cobro DE VERDAD, ya con el cupon aplicado. El precio del pack
    // puede cambiar manana; lo que ella pago, no.
    amount_total_cents: session.amount_total,
    currency: session.currency,
    // null = para siempre. Es la decision tomada para los packs.
    expires_at: null,
  });

  if (error) {
    if (error.code === "23505") {
      return { applied: false, reason: `la compra de la sesion ${session.id} ya estaba registrada` };
    }
    // Se lanza para devolver 500 y que Stripe reintente: alguien pago y todavia
    // no tiene su pack.
    throw new Error(`No se pudo registrar la compra de la sesion ${session.id}: ${error.message}`);
  }

  return { applied: true };
}

/**
 * Receives Stripe webhooks, stores an audit trail and keeps subscriptions synchronized.
 */
export async function POST(request: Request) {
  const env = getStripeServerEnv();
  const stripe = new Stripe(env.STRIPE_SECRET_KEY);
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing stripe signature" }, { status: 400 });
  }

  const payload = await request.text();

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(payload, signature, env.STRIPE_WEBHOOK_SECRET);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid webhook signature";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    // Los dos caminos, en serie y no en paralelo: cada uno ignora los eventos
    // del otro devolviendo un motivo, asi que a lo sumo uno hace algo. Si el de
    // packs lanza, no se llega a auditar como exito -- que es lo correcto.
    const suscripcion = await syncSubscription(event);
    const pack = await registrarCompraDePack(event);
    const outcome: SyncOutcome = suscripcion.applied
      ? suscripcion
      : pack.applied
        ? pack
        : { applied: false, reason: suscripcion.reason };

    await persistWebhookAudit(event, null);

    // A skip is a correct outcome, not an error, so it is audited as processed.
    // The reason travels in the response so it shows up in `stripe listen` and
    // in the event log of the Stripe dashboard instead of vanishing.
    return NextResponse.json(
      outcome.applied ? { received: true } : { received: true, skipped: outcome.reason }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unhandled webhook error";
    await persistWebhookAudit(event, message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
