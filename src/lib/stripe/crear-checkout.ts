import Stripe from "stripe";
import { ofertaVigente } from "@/src/features/studio/ofertas";
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
    // ¿Ya tiene un cliente en Stripe aunque nunca se haya suscripto? Pasa con
    // quien invito a una amiga antes de pagar: su mes gratis la espera en ESE
    // cliente, y creando otro el regalo se perdia (2026-11-12). Si la busqueda
    // falla se sigue como siempre.
    try {
      const hallados = await stripe.customers.search({ query: `metadata['user_id']:'${user.id}'`, limit: 5 });
      const conSaldo = hallados.data.find((c) => (c.balance ?? 0) < 0) ?? hallados.data[0];
      if (conSaldo) customerId = conSaldo.id;
    } catch { /* la busqueda no esta disponible: se crea uno nuevo */ }
  }
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
    return { ok: false, status: 503, error: "Los pagos no están disponibles ahora." };
  }

  // 🔴 NUNCA UNA SEGUNDA SUSCRIPCION (2026-10-25). Una alumna que ya pagaba veia
  //    en "Mi plan" los otros planes con "Empezar 7 dias gratis"; tocarlo abria
  //    un checkout NUEVO y Stripe le habria cobrado dos planes a la vez. Cambiar
  //    de plan se hace desde el portal ("Gestionar"), que modifica la suscripcion
  //    existente. Esto lo impone el servidor: la pantalla solo deja de ofrecerlo.
  const { data: yaTiene, error: errorYaTiene } = await createSupabaseAdminClient()
    .from("subscriptions")
    .select("status")
    .eq("user_id", a.user.id)
    .in("status", ["active", "trialing", "past_due"])
    .limit(1)
    .maybeSingle<{ status: string }>();
  if (errorYaTiene) {
    return { ok: false, status: 503, error: "No pudimos comprobar tu plan actual. Probá de nuevo en un momento." };
  }
  if (yaTiene) {
    return { ok: false, status: 409, error: "Ya tenés un plan activo. Para cambiarlo, tocá «Gestionar» en Mi plan." };
  }

  const catalog = await getSubscriptionCatalog();
  if (!catalog) {
    return { ok: false, status: 500, error: "Los planes no están disponibles ahora. Probá de nuevo en un momento." };
  }

  if (!catalogHasPerModePrices(catalog)) {
    return {
      ok: false,
      status: 500,
      error: "Ese plan todavía no se puede contratar. Escribinos y lo resolvemos.",
    };
  }

  const env = getStripeServerEnv();

  // The mode comes from the secret key, so the key alone decides which set of
  // price ids is used. There is no second switch to keep in sync.
  const mode = stripeMode(env.STRIPE_SECRET_KEY);
  const priceId = resolvePriceId(catalog, a.tier, a.interval, mode);

  if (!priceId) {
    // El detalle va al registro, no a la pantalla de la alumna.
    console.error(`[checkout] falta el precio de Stripe del modo ${mode} para ${a.tier}/${a.interval}`);
    return { ok: false, status: 500, error: "Ese plan todavía no se puede contratar. Escribinos y lo resolvemos." };
  }

  const stripe = new Stripe(env.STRIPE_SECRET_KEY, { timeout: 20_000, maxNetworkRetries: 1 });
  const appUrl = getAppUrl();
  const admin = createSupabaseAdminClient();
  const customerId = await clienteDeStripe(stripe, admin, a.user);

  // 🔴 LA PRUEBA GRATIS ES UNA SOLA VEZ (2026-11-12). Antes se regalaba en CADA
  //    checkout: suscribirse, cancelar el dia 6 y volver a suscribirse daba
  //    siete dias mas, para siempre, sin pagar nunca. Quien ya tuvo una
  //    suscripcion (cualquiera, en cualquier estado) paga desde el primer dia.
  //    Si no se puede comprobar, no se regala: es el camino que cobra.
  const { count: anteriores, error: errorAnteriores } = await admin
    .from("subscriptions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", a.user.id);
  if (errorAnteriores) {
    return { ok: false, status: 503, error: "No pudimos comprobar tu plan actual. Probá de nuevo en un momento." };
  }
  const yaTuvoPrueba = (anteriores ?? 0) > 0;

  const session = await stripe.checkout.sessions.create(
    parametrosCheckoutSuscripcion({
      userId: a.user.id,
      tier: a.tier,
      priceId,
      trialDays: yaTuvoPrueba ? 0 : catalog.trial_days ?? 7,
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
    return { ok: false, status: 503, error: "Los pagos no están disponibles ahora." };
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
    console.error(`[checkout] al pack ${pack.slug} le falta el precio de Stripe del modo ${mode}`);
    return { ok: false, status: 500, error: "Este pack todavía no se puede comprar. Escribinos y lo resolvemos." };
  }

  const stripe = new Stripe(env.STRIPE_SECRET_KEY, { timeout: 20_000, maxNetworkRetries: 1 });
  const appUrl = getAppUrl();
  const customerId = await clienteDeStripe(stripe, admin, a.user);

  // OFERTA POR TIEMPO LIMITADO (20261026_3). Se lee ACA, con la fecha de la
  // base: la cuenta regresiva de la pantalla no decide nada. Consulta aparte y
  // tolerante: sin la migracion no hay oferta y se cobra el precio normal.
  //
  // El descuento va como cupon de Stripe por la diferencia, con un id fijo
  // por (pack, precio, fin): la primera compra lo crea y las demas lo reusan.
  // Vence solo (redeem_by) aunque alguien deje el checkout abierto.
  const { data: filaOferta } = await admin
    .from("packs")
    .select("price_cents, oferta_precio_cents, oferta_hasta")
    .eq("id", pack.id)
    .maybeSingle<{ price_cents: number; oferta_precio_cents: number | null; oferta_hasta: string | null }>();
  const oferta = filaOferta ? ofertaVigente(filaOferta) : null;
  let cupon: string | null = null;
  if (oferta) {
    const finSeg = Math.floor(Date.parse(oferta.hasta) / 1000);
    // El precio normal va en el id (2026-11-12): el cupon descuenta una
    // DIFERENCIA fija, y si Brunela cambiaba el precio del pack con la oferta
    // andando se reusaba el cupon viejo y se cobraba otro importe que el de
    // la pantalla.
    const idCupon = `oferta-${pack.id.slice(0, 8)}-${pack.price_cents}-${oferta.precioCentimos}-${finSeg}`;
    try {
      cupon = (await stripe.coupons.retrieve(idCupon)).id;
    } catch (e) {
      // Solo "no existe" significa que hay que crearlo. Un corte de red no.
      if ((e as { code?: string })?.code !== "resource_missing") throw e;
      cupon = (await stripe.coupons.create({
        id: idCupon,
        amount_off: pack.price_cents - oferta.precioCentimos,
        currency: pack.currency.toLowerCase(),
        duration: "once",
        redeem_by: finSeg,
        name: `Oferta: ${pack.name_i18n?.es ?? pack.slug}`.slice(0, 40),
      })).id;
    }
  }

  const session = await stripe.checkout.sessions.create(
    parametrosCheckoutPack({
      cupon,
      // Con oferta, el pago abierto se cierra cuando la oferta termina (Stripe
      // pide media hora como minimo): no se paga el precio rebajado al dia siguiente.
      venceEn: oferta ? Math.max(Math.floor(Date.now() / 1000) + 31 * 60, Math.min(Math.floor(Date.parse(oferta.hasta) / 1000), Math.floor(Date.now() / 1000) + 23 * 3600)) : null,
      userId: a.user.id,
      pack: { id: pack.id, slug: pack.slug },
      priceId,
      customerId,
      destinos: (a.destinos ?? destinosPackPorDefecto)(appUrl),
    })
  );

  return { ok: true, url: session.url, sessionId: session.id };
}
