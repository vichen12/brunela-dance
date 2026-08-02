import Stripe from "stripe";
import { NextResponse } from "next/server";
import { getAppUrl, getStripeServerEnv, hasStripeServerEnv } from "@/src/lib/env";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";
import { createSupabaseAdminClient } from "@/src/lib/supabase/admin";

/**
 * Opens the Stripe Billing Portal so the member can update or cancel their plan.
 */
export async function POST() {
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

  const admin = createSupabaseAdminClient();
  const { data: sub } = await admin
    .from("subscriptions")
    .select("provider_customer_id")
    .eq("user_id", user.id)
    .not("provider_customer_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ provider_customer_id: string | null }>();

  if (!sub?.provider_customer_id) {
    return NextResponse.json({ error: "No tenes una suscripcion activa." }, { status: 400 });
  }

  const env = getStripeServerEnv();
  const stripe = new Stripe(env.STRIPE_SECRET_KEY);
  const appUrl = getAppUrl();

  const portal = await stripe.billingPortal.sessions.create({
    customer: sub.provider_customer_id,
    return_url: `${appUrl}/dashboard/plan`
  });

  return NextResponse.json({ url: portal.url });
}
