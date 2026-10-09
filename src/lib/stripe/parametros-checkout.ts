import type Stripe from "stripe";

/**
 * Los PARAMETROS de las dos sesiones de pago, y nada mas.
 *
 * POR QUE ESTA SEPARADO DE crear-checkout.ts
 *   Es la parte que decide que se le manda a Stripe: modo, precio, prueba
 *   gratis, metadata, cupones y el texto legal. Aislada asi, sin base, sin
 *   sesion y sin alias de rutas, se puede probar entera (tests/sistema) y
 *   mandarla a Stripe de prueba desde un script suelto para confirmar que la
 *   acepta. Lo que va a la red vive en crear-checkout.ts.
 *
 * ⚠️ ESTO ES EL UNICO CAMINO QUE COBRA PLATA DE VERDAD. Antes estaba escrito
 *    dentro de las dos rutas de /api/stripe; se movio aca sin cambiar un solo
 *    campo para que el onboarding pueda cobrar con exactamente lo mismo. Si se
 *    toca algo, cambia para las tres entradas a la vez.
 */

export type Destinos = { successUrl: string; cancelUrl: string };

/** A donde vuelve desde /dashboard/plan (el camino de siempre). */
export function destinosSuscripcionPorDefecto(appUrl: string): Destinos {
  return {
    successUrl: `${appUrl}/dashboard/plan?success=Suscripcion%20activada`,
    cancelUrl: `${appUrl}/dashboard/plan?error=Pago%20cancelado`,
  };
}

/**
 * El texto reconoce la demora a proposito: Stripe redirige al instante y el
 * webhook puede tardar unos segundos en llegar. Prometer que ya estan
 * desbloqueadas y que no aparezcan es peor que avisar.
 */
export function destinosPackPorDefecto(appUrl: string): Destinos {
  return {
    successUrl: `${appUrl}/dashboard/library?success=${encodeURIComponent(
      "¡Listo! Ya es tuyo. Si no ves las clases nuevas todavía, recargá en unos segundos."
    )}`,
    cancelUrl: `${appUrl}/dashboard/plan?error=${encodeURIComponent("Compra cancelada")}`,
  };
}

/**
 * Consentimiento expreso para empezar ya y perder el desistimiento
 * (art. 103.m TRLGDCU). Va justo encima del boton de pagar: pulsarlo es el acto
 * expreso. Tiene que coincidir con el punto 7 de app/legal/condiciones/page.tsx.
 */
export const TEXTO_LEGAL_SUSCRIPCION =
  "Al confirmar aceptás las Condiciones de contratación (bruneladance.com/legal/condiciones). " +
  "Tenés 7 días de prueba gratis: si cancelás antes, no se cobra nada. " +
  "Pedís acceso inmediato al contenido digital y reconocés que, una vez empezado, perdés el derecho de desistimiento de 14 días.";

export const TEXTO_LEGAL_PACK =
  "Al pagar aceptás las Condiciones de contratación (bruneladance.com/legal/condiciones). " +
  "Pedís acceso inmediato a las clases del pack y reconocés que, una vez empezado, perdés el derecho de desistimiento de 14 días.";

export function parametrosCheckoutSuscripcion(a: {
  userId: string;
  tier: "corps_de_ballet" | "solista" | "principal";
  priceId: string;
  trialDays: number;
  customerId: string;
  destinos: Destinos;
}): Stripe.Checkout.SessionCreateParams {
  return {
    mode: "subscription",
    customer: a.customerId,
    line_items: [{ price: a.priceId, quantity: 1 }],
    subscription_data: {
      trial_period_days: a.trialDays,
      // 🔴 De aca lo lee el webhook (customer.subscription.*). Sin esto, el
      //    pago entra y la alumna no recibe el plan: trampa 1 con otro disfraz.
      metadata: { user_id: a.userId, tier: a.tier },
    },
    metadata: { user_id: a.userId, tier: a.tier },
    success_url: a.destinos.successUrl,
    cancel_url: a.destinos.cancelUrl,
    allow_promotion_codes: true,
    custom_text: { submit: { message: TEXTO_LEGAL_SUSCRIPCION } },
  };
}

export function parametrosCheckoutPack(a: {
  userId: string;
  pack: { id: string; slug: string };
  priceId: string;
  customerId: string;
  destinos: Destinos;
}): Stripe.Checkout.SessionCreateParams {
  return {
    mode: "payment",
    customer: a.customerId,
    line_items: [{ price: a.priceId, quantity: 1 }],
    // 🔴 En un pago unico NO hay objeto suscripcion: el webhook lo lee de la
    //    metadata de la SESION. Sin esto, el pago entra y nadie sabe de quien
    //    es ni que compro.
    metadata: {
      user_id: a.userId,
      pack_id: a.pack.id,
      pack_slug: a.pack.slug,
    },
    success_url: a.destinos.successUrl,
    cancel_url: a.destinos.cancelUrl,
    allow_promotion_codes: true,
    custom_text: { submit: { message: TEXTO_LEGAL_PACK } },
  };
}
