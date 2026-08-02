import Stripe from "stripe";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getAppUrl, getStripeServerEnv, hasStripeServerEnv } from "@/src/lib/env";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";
import { createSupabaseAdminClient } from "@/src/lib/supabase/admin";
import {
  catalogHasPerModePrices,
  getSubscriptionCatalog,
  resolvePriceId,
  stripeMode,
  type BillingInterval
} from "@/src/lib/stripe/catalog";

const schema = z.object({
  tier: z.enum(["corps_de_ballet", "solista", "principal"]),
  interval: z.enum(["monthly", "yearly"])
});

/**
 * Creates a Stripe Checkout Session for the chosen plan + interval, with a
 * 7-day trial, and returns the redirect URL. The webhook (already implemented)
 * reads metadata.user_id to sync the subscription back to Supabase.
 */
export async function POST(request: Request) {
  if (!hasStripeServerEnv()) {
    return NextResponse.json({ error: "Stripe no esta configurado." }, { status: 503 });
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  const catalog = await getSubscriptionCatalog();
  if (!catalog) {
    return NextResponse.json({ error: "Catalogo de precios no configurado." }, { status: 500 });
  }

  if (!catalogHasPerModePrices(catalog)) {
    return NextResponse.json(
      {
        error:
          "El catalogo todavia guarda un solo juego de price ids. Corre la migracion " +
          "20260730_stripe_price_ids_per_mode.sql."
      },
      { status: 500 }
    );
  }

  const env = getStripeServerEnv();

  // The mode comes from the secret key, so the key alone decides which set of
  // price ids is used. There is no second switch to keep in sync.
  const mode = stripeMode(env.STRIPE_SECRET_KEY);
  const priceId = resolvePriceId(catalog, parsed.data.tier, parsed.data.interval as BillingInterval, mode);

  if (!priceId) {
    return NextResponse.json(
      {
        error:
          `Falta el precio de Stripe del modo ${mode} para este plan. Cargalo en ` +
          `site_settings -> subscriptions.catalog, en prices.${mode}.` +
          (mode === "test"
            ? " (La clave configurada es de prueba; si esperabas produccion, revisa STRIPE_SECRET_KEY.)"
            : " (La clave configurada es de PRODUCCION.)")
      },
      { status: 500 }
    );
  }

  const stripe = new Stripe(env.STRIPE_SECRET_KEY);
  const appUrl = getAppUrl();

  // Reuse an existing Stripe customer if we already have one for this user.
  const admin = createSupabaseAdminClient();
  const { data: existingSub } = await admin
    .from("subscriptions")
    .select("provider_customer_id")
    .eq("user_id", user.id)
    .not("provider_customer_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ provider_customer_id: string | null }>();

  let customerId = existingSub?.provider_customer_id ?? undefined;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email ?? undefined,
      metadata: { user_id: user.id }
    });
    customerId = customer.id;
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    subscription_data: {
      trial_period_days: catalog.trial_days ?? 7,
      metadata: { user_id: user.id, tier: parsed.data.tier }
    },
    metadata: { user_id: user.id, tier: parsed.data.tier },
    success_url: `${appUrl}/dashboard/plan?success=Suscripcion%20activada`,
    cancel_url: `${appUrl}/dashboard/plan?error=Pago%20cancelado`,
    allow_promotion_codes: true
  });

  return NextResponse.json({ url: session.url });
}
