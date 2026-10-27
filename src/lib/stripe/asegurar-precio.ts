import Stripe from "stripe";
import { getStripeServerEnv } from "@/src/lib/env";

/**
 * Deja en Stripe un precio que cobra EXACTAMENTE lo que Brunela escribio.
 *
 * POR QUE EXISTE (2026-10-27)
 *   Antes, cambiar un precio era: entrar a Stripe, crear el precio nuevo,
 *   copiar un codigo `price_1Tyyx...` y pegarlo en el panel, en el casillero del
 *   modo correcto. Dieciocho casilleros para los planes. Brunela pidio poder
 *   escribir el numero, guardar, y que quede todo bien. Esto es ese "todo bien".
 *
 * QUE HACE
 *   - Si el precio actual ya cobra ese importe, en esa moneda y cada ese
 *     intervalo, no toca nada y devuelve el mismo id. Guardar sin cambiar nada
 *     no crea precios.
 *   - Si no, crea uno nuevo en el MISMO producto (o en uno nuevo, la primera
 *     vez) y archiva el viejo.
 *
 * ⚠️ UN PRECIO DE STRIPE NO SE EDITA: SE REEMPLAZA
 *   Quien ya esta suscripta sigue con su precio viejo aunque este archivado:
 *   archivar solo impide usarlo en compras NUEVAS. Por eso el viejo se marca con
 *   la misma `metadata` que el nuevo antes de archivarlo: el webhook reconoce el
 *   plan de una suscripcion vieja por esa marca cuando su codigo ya no esta en
 *   el catalogo (ver resolveTierFromPrice en catalog.ts).
 *
 * ⚠️ USA STRIPE_SECRET_KEY, o sea el modo que COBRA
 *   En produccion crea precios de produccion. Es lo que se quiere: el panel
 *   guarda el codigo en el juego del modo activo y el otro no se toca.
 */

export type PedidoDePrecio = {
  /** El codigo que hay hoy, si hay. */
  actual: string | null;
  centimos: number;
  moneda: string;
  /** null = pago unico (packs). */
  intervalo: "month" | "year" | null;
  /** Nombre del producto en Stripe, solo si hay que crearlo. */
  producto: string;
  /** Va en el precio nuevo Y en el viejo: { tier } en planes, { pack_id } en packs. */
  metadata: Record<string, string>;
};

export async function asegurarPrecio(p: PedidoDePrecio): Promise<{ id: string; creado: boolean }> {
  const stripe = new Stripe(getStripeServerEnv().STRIPE_SECRET_KEY);
  const moneda = p.moneda.toLowerCase();

  let viejo: Stripe.Price | null = null;
  if (p.actual) {
    try {
      viejo = await stripe.prices.retrieve(p.actual);
    } catch {
      // No existe en este modo (codigo mal pegado, o de prueba en produccion):
      // se crea uno bueno y listo.
      viejo = null;
    }
  }

  const sirve =
    viejo &&
    viejo.active &&
    viejo.unit_amount === p.centimos &&
    viejo.currency === moneda &&
    (viejo.recurring?.interval ?? null) === p.intervalo;

  if (viejo && sirve) {
    // Los precios cargados a mano no tienen la marca: se les pone ahora, que
    // es gratis, para que el dia que se reemplacen ya la lleven.
    if (Object.entries(p.metadata).some(([k, v]) => viejo!.metadata?.[k] !== v)) {
      await stripe.prices.update(viejo.id, { metadata: p.metadata });
    }
    return { id: viejo.id, creado: false };
  }

  const producto = viejo
    ? typeof viejo.product === "string" ? viejo.product : viejo.product.id
    : (await stripe.products.create({ name: p.producto, metadata: p.metadata })).id;

  const nuevo = await stripe.prices.create({
    product: producto,
    unit_amount: p.centimos,
    currency: moneda,
    ...(p.intervalo ? { recurring: { interval: p.intervalo } } : {}),
    metadata: p.metadata,
  });

  if (viejo) {
    await stripe.prices.update(viejo.id, { active: false, metadata: p.metadata });
  }

  return { id: nuevo.id, creado: true };
}

/** El error de Stripe en una frase que Brunela pueda leer. */
export function errorDeStripe(e: unknown): string {
  const m = (e as { message?: string })?.message ?? "error desconocido";
  return `Stripe no respondió bien (${m}). No se guardó nada: probá de nuevo en un rato.`;
}
