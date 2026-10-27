import type { SupabaseClient } from "@supabase/supabase-js";
import { stripeMode } from "@/src/lib/stripe/catalog";
import { asegurarPrecio } from "@/src/lib/stripe/asegurar-precio";

/**
 * Deja el pack cobrando en Stripe lo que dice su `price_cents`.
 *
 * Se llama DESPUES de guardar el importe, desde las tres puertas que lo tocan:
 * crear el pack, editarlo (el panel del pack o /admin/precios) y publicarlo.
 * Si el importe no cambio no crea nada (asegurarPrecio lo compara).
 *
 * Escribe solo el codigo del modo que cobra; el del otro modo no se toca.
 *
 * ⚠️ Sin "use server": se importa desde acciones, no es una accion. Una
 *    funcion exportada de un archivo "use server" es un endpoint publico.
 */
export async function asegurarPrecioDePack(
  supabase: SupabaseClient,
  packId: string
): Promise<{ ok: true } | { fallo: string }> {
  const { data: pack } = await supabase
    .from("packs")
    .select("id, slug, name_i18n, price_cents, currency, stripe_price_id_test, stripe_price_id_live")
    .eq("id", packId)
    .maybeSingle<{
      id: string;
      slug: string;
      name_i18n: Record<string, string> | null;
      price_cents: number;
      currency: string;
      stripe_price_id_test: string | null;
      stripe_price_id_live: string | null;
    }>();
  if (!pack) return { fallo: "Ese pack ya no existe." };

  const modo = stripeMode(process.env.STRIPE_SECRET_KEY);
  const columna = modo === "live" ? "stripe_price_id_live" : "stripe_price_id_test";
  const nombre = pack.name_i18n?.es ?? pack.slug;

  try {
    const { id } = await asegurarPrecio({
      actual: pack[columna],
      centimos: pack.price_cents,
      moneda: pack.currency,
      intervalo: null,
      producto: `Pack · ${nombre}`,
      metadata: { pack_id: pack.id },
    });
    if (id !== pack[columna]) {
      const { error } = await supabase.from("packs").update({ [columna]: id }).eq("id", pack.id);
      if (error) return { fallo: error.message };
    }
    return { ok: true };
  } catch (e) {
    const m = (e as { message?: string })?.message ?? "error desconocido";
    return { fallo: `El precio se guardó, pero Stripe no respondió bien (${m}). Volvé a guardar en un rato y se arregla solo.` };
  }
}
