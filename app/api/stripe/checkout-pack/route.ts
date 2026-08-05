import Stripe from "stripe";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getAppUrl, getStripeServerEnv, hasStripeServerEnv } from "@/src/lib/env";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";
import { createSupabaseAdminClient } from "@/src/lib/supabase/admin";
import { stripeMode } from "@/src/lib/stripe/catalog";

/**
 * Compra de un pack: pago UNICO, sin suscripcion.
 *
 * ⚠️ POR QUE ES UNA RUTA APARTE Y NO UNA RAMA DE /api/stripe/checkout
 *   Esa ruta cobra las suscripciones, esta verificada y funciona. Meterle un
 *   `if` que cambie `mode`, el arbol de precios, la metadata Y el destino de
 *   vuelta es tocar el unico camino de cobro que hoy anda, para agregar uno que
 *   todavia no. Separadas, un error aca no puede romper aquello.
 *
 * ⚠️ EL PRECIO NO VIENE DEL NAVEGADOR
 *   Del cliente llega un SLUG y nada mas. El importe y el price id salen de la
 *   base. Si el precio viajara por la request, alguien podria mandar el slug del
 *   pack caro con el price id del barato.
 *
 * ⚠️ LA METADATA VA EN LA SESION, NO EN UNA SUSCRIPCION
 *   En un pago unico NO EXISTE objeto suscripcion. El webhook de suscripciones
 *   lee `subscription.metadata.user_id`; aca eso no existe y hay que leerlo de
 *   `session.metadata`. Es la trampa 1 con otro disfraz: si se pierde, entra el
 *   pago y la alumna no recibe el acceso.
 */

const schema = z.object({ pack: z.string().min(1).max(120) });

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

export async function POST(request: Request) {
  if (!hasStripeServerEnv()) {
    return NextResponse.json({ error: "Stripe no esta configurado." }, { status: 503 });
  }

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const { data: pack } = await admin
    .from("packs")
    .select("id, slug, name_i18n, price_cents, currency, stripe_price_id_test, stripe_price_id_live, is_published")
    .eq("slug", parsed.data.pack)
    .maybeSingle<PackFila>();

  // Un pack sin publicar no se compra ni con el enlace directo. Se responde 404
  // y no 403: que no exista y que este oculto se ven igual desde afuera.
  if (!pack || !pack.is_published) {
    return NextResponse.json({ error: "Ese pack no existe." }, { status: 404 });
  }

  // ¿Ya lo tiene? Cobrarselo de nuevo seria cobrar dos veces por lo mismo.
  const { data: yaLoTiene } = await admin
    .from("pack_purchases")
    .select("id")
    .eq("user_id", user.id)
    .eq("pack_id", pack.id)
    .limit(1)
    .maybeSingle<{ id: string }>();

  if (yaLoTiene) {
    return NextResponse.json({ error: "Ya tenés este pack." }, { status: 409 });
  }

  const env = getStripeServerEnv();
  const mode = stripeMode(env.STRIPE_SECRET_KEY);
  const priceId = mode === "live" ? pack.stripe_price_id_live : pack.stripe_price_id_test;

  if (!priceId) {
    return NextResponse.json(
      {
        error:
          `Al pack "${pack.name_i18n?.es ?? pack.slug}" le falta el identificador de Stripe ` +
          `del modo ${mode === "live" ? "produccion" : "prueba"}. Se carga en /admin/precios.`,
      },
      { status: 500 }
    );
  }

  const stripe = new Stripe(env.STRIPE_SECRET_KEY);
  const appUrl = getAppUrl();

  // Se reusa el cliente de Stripe que ya tenga por su suscripcion, para que en
  // el panel de Stripe no aparezca como dos personas distintas.
  const { data: subPrevia } = await admin
    .from("subscriptions")
    .select("provider_customer_id")
    .eq("user_id", user.id)
    .not("provider_customer_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ provider_customer_id: string | null }>();

  let customerId = subPrevia?.provider_customer_id ?? undefined;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email ?? undefined,
      metadata: { user_id: user.id },
    });
    customerId = customer.id;
  }

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    // 🔴 De aca lo lee el webhook. Sin esto, el pago entra y nadie sabe de quien
    //    es ni que compro.
    metadata: {
      user_id: user.id,
      pack_id: pack.id,
      pack_slug: pack.slug,
    },
    // El texto reconoce la demora a proposito: Stripe redirige al instante y
    // el webhook puede tardar unos segundos en llegar. Prometer que ya estan
    // desbloqueadas y que no aparezcan es peor que avisar.
    success_url: `${appUrl}/dashboard/library?success=${encodeURIComponent(
      "¡Listo! Ya es tuyo. Si no ves las clases nuevas todavía, recargá en unos segundos."
    )}`,
    cancel_url: `${appUrl}/dashboard/plan?error=${encodeURIComponent("Compra cancelada")}`,
    allow_promotion_codes: true,
  });

  return NextResponse.json({ url: session.url });
}
