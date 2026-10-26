import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Ofertas por tiempo limitado de los packs (20261026_3_ofertas_de_packs.sql).
 *
 * UNA regla, la usan todos: el cobro (crear-checkout.ts), la tienda, la
 * portada, Mi plan y el panel. Una oferta vale si tiene precio, es mas barata
 * que el precio normal y todavia no paso su fecha. Fuera de fecha el pack
 * vuelve solo a su precio: no hace falta apagarla.
 *
 * Sin import de servidor: la usan pantallas y pruebas.
 */

export type OfertaPack = { precioCentimos: number; hasta: string };

export function ofertaVigente(
  f: { price_cents: number; oferta_precio_cents?: number | null; oferta_hasta?: string | null },
  ahora = Date.now()
): OfertaPack | null {
  const precio = f.oferta_precio_cents;
  const hasta = f.oferta_hasta;
  if (!precio || !hasta) return null;
  if (precio <= 0 || precio >= f.price_cents) return null;
  if (!(Date.parse(hasta) > ahora)) return null;
  return { precioCentimos: precio, hasta };
}

/** 42703: la columna no existe (sin la migracion). */
export function esFaltaDeColumnaOferta(error: { code?: string; message?: string } | null | undefined) {
  return !!error && (error.code === "42703" || /oferta_/.test(error.message ?? ""));
}

/**
 * Las ofertas VIGENTES por id y por slug, en una consulta aparte y tolerante:
 * sin la migracion devuelve vacio y todo se vende a precio normal.
 */
export async function leerOfertasVigentes(db: SupabaseClient): Promise<Map<string, OfertaPack>> {
  const { data, error } = await db
    .from("packs")
    .select("id, slug, price_cents, oferta_precio_cents, oferta_hasta")
    .not("oferta_hasta", "is", null);
  const out = new Map<string, OfertaPack>();
  if (error) return out;
  for (const f of (data ?? []) as { id: string; slug: string; price_cents: number; oferta_precio_cents: number | null; oferta_hasta: string | null }[]) {
    const o = ofertaVigente(f);
    if (o) { out.set(f.id, o); out.set(f.slug, o); }
  }
  return out;
}

/** "-30%": el descuento redondeado, para la etiqueta. */
export function porcentajeDeDescuento(precio: number, oferta: number) {
  return Math.round((1 - oferta / precio) * 100);
}
