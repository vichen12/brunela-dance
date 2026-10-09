import { NextResponse } from "next/server";
import { z } from "zod";
import { hasStripeServerEnv } from "@/src/lib/env";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";
import { crearCheckoutDeSuscripcion } from "@/src/lib/stripe/crear-checkout";

const schema = z.object({
  tier: z.enum(["corps_de_ballet", "solista", "principal"]),
  interval: z.enum(["monthly", "yearly"])
});

/**
 * Creates a Stripe Checkout Session for the chosen plan + interval, with a
 * 7-day trial, and returns the redirect URL. The webhook (already implemented)
 * reads metadata.user_id to sync the subscription back to Supabase.
 *
 * La sesion la arma src/lib/stripe/crear-checkout.ts, la MISMA funcion que usa
 * el onboarding: un solo lugar decide precio, prueba, metadata y texto legal.
 * Esta ruta solo pone la sesion, valida la entrada y traduce el resultado a
 * JSON con los mismos status de siempre.
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

  const resultado = await crearCheckoutDeSuscripcion({
    user: { id: user.id, email: user.email },
    tier: parsed.data.tier,
    interval: parsed.data.interval
  });

  if (!resultado.ok) {
    return NextResponse.json({ error: resultado.error }, { status: resultado.status });
  }

  return NextResponse.json({ url: resultado.url });
}
