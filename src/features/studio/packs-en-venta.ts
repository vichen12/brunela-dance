import { createSupabaseAdminClient } from "@/src/lib/supabase/admin";
import { leerOfertasVigentes } from "@/src/features/studio/ofertas";
import { normalizarPlanesDeCompra, planesDeCompraEnTexto } from "@/src/features/studio/packs-reglas";
import type { PackPublico } from "@/components/packs-publicos";

/**
 * Los packs para quien NO tiene cuenta: /packs y /packs/[slug], el enlace que
 * Brunela comparte en Instagram (pedido 2026-11-06: "mucha gente no se quiere
 * hacer cuenta para ver nomas").
 *
 * A DIFERENCIA DE LA PORTADA, mira `is_published` y no `show_on_landing`: "a la
 * venta" alcanza para tener enlace. "Mostrar en portada" sigue decidiendo solo
 * si aparece en la landing.
 *
 * ⚠️ PAGINA PUBLICA CON service_role. Las columnas van escritas a mano y nada de
 *    lo que vuelve lleva ids de video ni price ids: se piden para filtrar y se
 *    descartan antes de devolver.
 *
 * ⚠️ NO SE ANUNCIA LO QUE NO SE PUEDE COBRAR NI LO QUE ESTA VACIO: sin precio del
 *    modo activo o sin clases, no aparece.
 */
type Fila = Omit<PackPublico, "cantidad_clases" | "solo_para" | "oferta"> & {
  id: string;
  stripe_price_id_test: string | null;
  stripe_price_id_live: string | null;
};

/** Nunca lanza: una pagina publica sin base muestra "todavia no hay packs". */
export async function leerPacksEnVenta(): Promise<(PackPublico & { id: string })[]> {
  try {
    const db = createSupabaseAdminClient();
    const live = /^(?:sk|rk)_live_/.test((process.env.STRIPE_SECRET_KEY ?? "").trim());
    const [{ data, error }, { data: relaciones }, restringidos, ofertas] = await Promise.all([
      db
        .from("packs")
        .select("id, slug, name_i18n, description_i18n, price_cents, currency, cover_image_url, is_featured, stripe_price_id_test, stripe_price_id_live")
        .eq("is_published", true)
        .order("display_order"),
      db.from("pack_videos").select("pack_id"),
      // Aparte y tolerante, como en la portada: sin 20261009_4 la columna no existe.
      db
        .from("packs")
        .select("id, planes_que_pueden_comprar")
        .not("planes_que_pueden_comprar", "is", null)
        .then(({ data: filas, error: e }) =>
          e
            ? new Map<string, string>()
            : new Map(
                ((filas ?? []) as { id: string; planes_que_pueden_comprar: string[] | null }[])
                  .filter((f) => normalizarPlanesDeCompra(f.planes_que_pueden_comprar))
                  .map((f) => [f.id, planesDeCompraEnTexto(f.planes_que_pueden_comprar)])
              )
        ),
      leerOfertasVigentes(db),
    ]);
    if (error) {
      console.error("[packs en venta]", error.message);
      return [];
    }
    const cuantas = new Map<string, number>();
    for (const r of (relaciones ?? []) as { pack_id: string }[]) cuantas.set(r.pack_id, (cuantas.get(r.pack_id) ?? 0) + 1);

    return ((data ?? []) as Fila[])
      .filter((p) => (live ? p.stripe_price_id_live : p.stripe_price_id_test) && cuantas.get(p.id))
      .map((p) => ({
        id: p.id,
        slug: p.slug,
        name_i18n: p.name_i18n,
        description_i18n: p.description_i18n,
        price_cents: p.price_cents,
        currency: p.currency,
        cover_image_url: p.cover_image_url,
        is_featured: p.is_featured,
        cantidad_clases: cuantas.get(p.id) ?? 0,
        solo_para: restringidos.get(p.id) ?? null,
        oferta: ofertas.get(p.id) ?? null,
      }));
  } catch (e) {
    console.error("[packs en venta]", e instanceof Error ? e.message : String(e));
    return [];
  }
}
