import Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAppUrl, getStripeServerEnv, hasStripeServerEnv } from "@/src/lib/env";
import { createSupabaseAdminClient } from "@/src/lib/supabase/admin";
import {
  catalogHasPerModePrices,
  getSubscriptionCatalog,
  resolvePriceId,
  stripeMode,
  type BillingInterval,
  type CatalogTier,
} from "@/src/lib/stripe/catalog";
import {
  destinosPackPorDefecto,
  destinosSuscripcionPorDefecto,
  parametrosCheckoutPack,
  parametrosCheckoutSuscripcion,
  type Destinos,
} from "@/src/lib/stripe/parametros-checkout";
import {
  errorSoloPara,
  esFaltaDeColumnaPlanes,
  normalizarPlanesDeCompra,
  puedeComprarPack,
} from "@/src/features/studio/packs-reglas";

/**
 * Crear una sesion de Stripe Checkout: UNA implementacion, tres entradas.
 *
 *   · /api/stripe/checkout       (botones de /dashboard/plan)
 *   · /api/stripe/checkout-pack  (packs desde /dashboard/plan)
 *   · el onboarding y /registro/plan (server actions de registro.ts)
 *
 * Antes las dos rutas tenian esto escrito adentro. El onboarding necesitaba
 * cobrar igual, y copiarlo dejaba dos versiones del unico camino que cobra
 * plata real: la proxima correccion entraria en una y no en la otra.
 *
 * ⚠️ QUIEN paga viene SIEMPRE de la sesion (lo resuelve quien llama, con
 *    getUser), nunca del navegador. Del navegador llega un tier + intervalo o
 *    un slug de pack, y el precio sale de aca: del catalogo o de la tabla.
 *
 * Devuelve un resultado y no una Response: cada entrada lo traduce a lo suyo
 * (JSON con el mismo status de siempre, o un redirect). Los mensajes y los
 * status son exactamente los que devolvian las rutas.
 */

export type ResultadoCheckout =
  | { ok: true; url: string | null; sessionId: string }
  | { ok: false; status: number; error: string };

export type QuienPaga = { id: string; email?: string | null };

/**
 * Reusa el cliente de Stripe que ya tenga por una suscripcion, para que en el
 * panel de Stripe no aparezca como dos personas distintas.
 */
async function clienteDeStripe(stripe: Stripe, admin: SupabaseClient, user: QuienPaga): Promise<string> {
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
      metadata: { user_id: user.id },
    });
    customerId = customer.id;
  }
  return customerId;
}

/**
 * Suscripcion con prueba gratis (trial_days del catalogo) para el plan y el
 * intervalo elegidos. El webhook lee metadata.user_id para escribir el plan.
 */
export async function crearCheckoutDeSuscripcion(a: {
  user: QuienPaga;
  tier: CatalogTier["tier"];
  interval: BillingInterval;
  destinos?: (appUrl: string) => Destinos;
}): Promise<ResultadoCheckout> {
  if (!hasStripeServerEnv()) {
    return { ok: false, status: 503, error: "Stripe no esta configurado." };
  }

  const catalog = await getSubscriptionCatalog();
  if (!catalog) {
    return { ok: false, status: 500, error: "Catalogo de precios no configurado." };
  }

  if (!catalogHasPerModePrices(catalog)) {
    return {
      ok: false,
      status: 500,
      error:
        "El catalogo todavia guarda un solo juego de price ids. Corre la migracion " +
        "20260730_stripe_price_ids_per_mode.sql.",
    };
  }

  const env = getStripeServerEnv();

  // The mode comes from the secret key, so the key alone decides which set of
  // price ids is used. There is no second switch to keep in sync.
  const mode = stripeMode(env.STRIPE_SECRET_KEY);
  const priceId = resolvePriceId(catalog, a.tier, a.interval, mode);

  if (!priceId) {
    return {
      ok: false,
      status: 500,
      error:
        `Falta el precio de Stripe del modo ${mode} para este plan. Cargalo en ` +
        `site_settings -> subscriptions.catalog, en prices.${mode}.` +
        (mode === "test"
          ? " (La clave configurada es de prueba; si esperabas produccion, revisa STRIPE_SECRET_KEY.)"
          : " (La clave configurada es de PRODUCCION.)"),
    };
  }

  const stripe = new Stripe(env.STRIPE_SECRET_KEY);
  const appUrl = getAppUrl();
  const admin = createSupabaseAdminClient();
  const customerId = await clienteDeStripe(stripe, admin, a.user);

  const session = await stripe.checkout.sessions.create(
    parametrosCheckoutSuscripcion({
      userId: a.user.id,
      tier: a.tier,
      priceId,
      trialDays: catalog.trial_days ?? 7,
      customerId,
      destinos: (a.destinos ?? destinosSuscripcionPorDefecto)(appUrl),
    })
  );

  return { ok: true, url: session.url, sessionId: session.id };
}

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

/**
 * Compra de un pack: pago UNICO, sin suscripcion.
 *
 * ⚠️ EL PRECIO NO VIENE DEL NAVEGADOR: llega un SLUG y el price id sale de la
 *    tabla. Si el precio viajara por la request, alguien podria mandar el slug
 *    del pack caro con el price id del barato.
 */
export async function crearCheckoutDePack(a: {
  user: QuienPaga;
  packSlug: string;
  destinos?: (appUrl: string) => Destinos;
}): Promise<ResultadoCheckout> {
  if (!hasStripeServerEnv()) {
    return { ok: false, status: 503, error: "Stripe no esta configurado." };
  }

  const admin = createSupabaseAdminClient();
  const { data: pack } = await admin
    .from("packs")
    .select("id, slug, name_i18n, price_cents, currency, stripe_price_id_test, stripe_price_id_live, is_published")
    .eq("slug", a.packSlug)
    .maybeSingle<PackFila>();

  // Un pack sin publicar no se compra ni con el enlace directo. Se responde 404
  // y no 403: que no exista y que este oculto se ven igual desde afuera.
  if (!pack || !pack.is_published) {
    return { ok: false, status: 404, error: "Ese pack no existe." };
  }

  // ¿Ya lo tiene? Cobrarselo de nuevo seria cobrar dos veces por lo mismo.
  const { data: yaLoTiene } = await admin
    .from("pack_purchases")
    .select("id")
    .eq("user_id", a.user.id)
    .eq("pack_id", pack.id)
    .limit(1)
    .maybeSingle<{ id: string }>();

  if (yaLoTiene) {
    return { ok: false, status: 409, error: "Ya tenés este pack." };
  }

  // ¿Es un pack solo para algunos planes? (20261009_4_packs_por_plan.sql)
  //
  // ⚠️ AQUI SE IMPONE, no en la pantalla: la tienda, la portada y el registro
  //    solo esconden el boton. Esta funcion es la unica puerta a Stripe para
  //    un pack, asi que lo que no pasa aca no se cobra.
  //
  // ⚠️ CONSULTA APARTE, y no una columna mas en el select de arriba: antes de
  //    correr la migracion la columna no existe (42703) y el select entero
  //    fallaria -> `pack` null -> "Ese pack no existe" para TODOS los packs.
  //    Sin la columna = sin restriccion, que es el comportamiento de siempre.
  //
  // El plan se lee con service_role del perfil de quien paga (a.user.id sale
  // de la sesion, nunca del navegador). Ante cualquier otro error se frena:
  // es el camino que cobra, y es mejor reintentar que vender lo que no va.
  const { data: restriccion, error: errorRestriccion } = await admin
    .from("packs")
    .select("planes_que_pueden_comprar")
    .eq("id", pack.id)
    .maybeSingle<{ planes_que_pueden_comprar: string[] | null }>();

  if (errorRestriccion && !esFaltaDeColumnaPlanes(errorRestriccion)) {
    return { ok: false, status: 503, error: "No pudimos comprobar para quién es este pack. Probá de nuevo en un momento." };
  }

  const soloPara = errorRestriccion ? null : normalizarPlanesDeCompra(restriccion?.planes_que_pueden_comprar);
  if (soloPara) {
    const { data: perfil, error: errorPerfil } = await admin
      .from("profiles")
      .select("membership_tier")
      .eq("id", a.user.id)
      .maybeSingle<{ membership_tier: string | null }>();

    if (errorPerfil) {
      return { ok: false, status: 503, error: "No pudimos comprobar tu plan. Probá de nuevo en un momento." };
    }
    if (!puedeComprarPack(perfil?.membership_tier, soloPara)) {
      return { ok: false, status: 403, error: errorSoloPara(soloPara) };
    }
  }

  const env = getStripeServerEnv();
  const mode = stripeMode(env.STRIPE_SECRET_KEY);
  const priceId = mode === "live" ? pack.stripe_price_id_live : pack.stripe_price_id_test;

  if (!priceId) {
    return {
      ok: false,
      status: 500,
      error:
        `Al pack "${pack.name_i18n?.es ?? pack.slug}" le falta el identificador de Stripe ` +
        `del modo ${mode === "live" ? "produccion" : "prueba"}. Se carga en /admin/precios.`,
    };
  }

  const stripe = new Stripe(env.STRIPE_SECRET_KEY);
  const appUrl = getAppUrl();
  const customerId = await clienteDeStripe(stripe, admin, a.user);

  const session = await stripe.checkout.sessions.create(
    parametrosCheckoutPack({
      userId: a.user.id,
      pack: { id: pack.id, slug: pack.slug },
      priceId,
      customerId,
      destinos: (a.destinos ?? destinosPackPorDefecto)(appUrl),
    })
  );

  return { ok: true, url: session.url, sessionId: session.id };
}
