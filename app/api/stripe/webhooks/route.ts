import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import { NextResponse } from "next/server";
import { env } from "@/src/lib/env";

const stripe = new Stripe(env.STRIPE_SECRET_KEY);

type SubscriptionCatalogSetting = {
  tier: "corps_de_ballet" | "solista" | "principal";
  stripe_price_id: string | null;
  display_order: number;
};

function createServiceRoleClient() {
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
}

async function resolveMembershipTierFromPriceId(priceId: string | null) {
  if (!priceId) {
    return null;
  }

  const supabase = createServiceRoleClient();
  const { data } = await supabase
    .from("site_settings")
    .select("value")
    .eq("setting_key", "subscriptions.catalog")
    .single<{ value: { tiers?: SubscriptionCatalogSetting[] } }>();

  const tiers = data?.value?.tiers ?? [];
  return tiers.find((tier) => tier.stripe_price_id === priceId)?.tier ?? null;
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

async function syncSubscription(event: Stripe.Event) {
  if (
    event.type !== "customer.subscription.created" &&
    event.type !== "customer.subscription.updated" &&
    event.type !== "customer.subscription.deleted"
  ) {
    return;
  }

  const subscription = event.data.object as Stripe.Subscription;
  const supabase = createServiceRoleClient();
  const userId = subscription.metadata.user_id;
  const priceId = subscription.items.data[0]?.price.id ?? null;
  const membershipTier = await resolveMembershipTierFromPriceId(priceId);

  if (!userId || !membershipTier) {
    throw new Error("Stripe subscription is missing metadata.user_id or a mapped price id");
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
    metadata: subscription.metadata
  };

  await supabase.from("subscriptions").upsert(payload, {
    onConflict: "provider_subscription_id"
  });
}

/**
 * Receives Stripe webhooks, stores an audit trail and keeps subscriptions synchronized.
 */
export async function POST(request: Request) {
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
    await syncSubscription(event);
    await persistWebhookAudit(event, null);
    return NextResponse.json({ received: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unhandled webhook error";
    await persistWebhookAudit(event, message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
