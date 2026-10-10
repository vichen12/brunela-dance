import { createSupabaseServerClient } from "@/src/lib/supabase/server";
import { createSupabaseAdminClient } from "@/src/lib/supabase/admin";
import { resolveI18nText } from "@/src/features/studio/helpers";
import { esFaltaDeColumnaPlanes, normalizarPlanesDeCompra, puedeComprarPack, textoSoloPara } from "@/src/features/studio/packs-reglas";
import { portadaDeClase } from "@/src/lib/video/portada";

/**
 * Packs como los ve la alumna: la tienda (/dashboard/packs) y la pagina de
 * cada uno (/dashboard/packs/[slug]).
 *
 * ⚠️ NO SE OFRECE LO QUE NO SE PUEDE COBRAR. Igual que en Mi plan: un pack sin
 *    price del modo activo de Stripe no aparece. El modo sale de la clave, igual
 *    que en el checkout.
 *
 * Los packs y sus compras se leen con el cliente DE ELLA (policies
 * packs_select_published y pack_purchases_select_own).
 */
export type PackTienda = {
  id: string;
  slug: string;
  nombre: string;
  descripcion: string;
  precioCentimos: number;
  moneda: string;
  portada: string | null;
  destacado: boolean;
  clases: number;
  compradoEl: string | null;
  /** "Solo para alumnas de Solista y Principal", o null si es para todas. */
  soloPara: string | null;
  /**
   * ¿Lo puede pagar con su plan de HOY? Es solo para la pantalla (candado y
   * boton a Mi plan): quien lo impone es crearCheckoutDePack.
   */
  puedeComprar: boolean;
};

/**
 * Para que planes es cada pack (id -> lista, solo los restringidos).
 *
 * CONSULTA APARTE Y TOLERANTE: antes de 20261009_4_packs_por_plan.sql la
 * columna no existe (42703). Meterla en el select principal tiraria la tienda
 * entera; asi, sin la columna, todos los packs son para todas -- que es lo que
 * eran.
 */
export async function getRestriccionesDePacks(): Promise<Map<string, string[]>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("packs").select("id, planes_que_pueden_comprar");
  if (error) {
    if (!esFaltaDeColumnaPlanes(error)) console.error("[packs] planes que pueden comprar:", error.message);
    return new Map();
  }
  const mapa = new Map<string, string[]>();
  for (const f of (data ?? []) as { id: string; planes_que_pueden_comprar: string[] | null }[]) {
    const planes = normalizarPlanesDeCompra(f.planes_que_pueden_comprar);
    if (planes) mapa.set(f.id, planes);
  }
  return mapa;
}

const modoEsLive = () => /^(?:sk|rk)_live_/.test((process.env.STRIPE_SECRET_KEY ?? "").trim());

export async function getPacksTienda(tierActual: string | null = null): Promise<PackTienda[]> {
  const supabase = await createSupabaseServerClient();
  // Las compras se filtran por QUIEN MIRA: RLS le devuelve a una admin las de
  // todas las alumnas, y sin este filtro Brunela veria "Ya es tuyo" en los
  // packs que compro cualquiera.
  const { data: { user } } = await supabase.auth.getUser();
  const [{ data: packs }, { data: compras }, { data: rel }, restricciones] = await Promise.all([
    supabase
      .from("packs")
      .select("id, slug, name_i18n, description_i18n, price_cents, currency, cover_image_url, is_featured, is_published, stripe_price_id_test, stripe_price_id_live")
      .eq("is_published", true)
      .order("display_order"),
    supabase.from("pack_purchases").select("pack_id, purchased_at").eq("user_id", user?.id ?? "00000000-0000-0000-0000-000000000000"),
    supabase.from("pack_videos").select("pack_id"),
    getRestriccionesDePacks(),
  ]);
  const comprado = new Map(((compras ?? []) as { pack_id: string; purchased_at: string }[]).map((c) => [c.pack_id, c.purchased_at]));
  const cuantas = ((rel ?? []) as { pack_id: string }[]).reduce<Record<string, number>>((a, r) => { a[r.pack_id] = (a[r.pack_id] ?? 0) + 1; return a; }, {});
  const live = modoEsLive();
  type F = { id: string; slug: string; name_i18n: Record<string, string>; description_i18n: Record<string, string>; price_cents: number; currency: string; cover_image_url: string | null; is_featured: boolean; stripe_price_id_test: string | null; stripe_price_id_live: string | null };
  return ((packs ?? []) as F[])
    // Uno ya comprado se muestra siempre, aunque hoy no se pueda cobrar.
    .filter((p) => (live ? p.stripe_price_id_live : p.stripe_price_id_test) !== null || comprado.has(p.id))
    .map((p) => ({
      id: p.id,
      slug: p.slug,
      nombre: resolveI18nText(p.name_i18n) || p.slug,
      descripcion: resolveI18nText(p.description_i18n) || "",
      precioCentimos: p.price_cents,
      moneda: p.currency,
      portada: p.cover_image_url,
      destacado: p.is_featured,
      clases: cuantas[p.id] ?? 0,
      compradoEl: comprado.get(p.id) ?? null,
      soloPara: textoSoloPara(restricciones.get(p.id)),
      puedeComprar: puedeComprarPack(tierActual, restricciones.get(p.id)),
    }));
}

export type ClaseDelPack = { slug: string; titulo: string; descripcion: string; minutos: number; categoria: string | null; portada: string | null };

/**
 * Las clases de un pack, para su pagina. Con service_role y columnas ACOTADAS:
 * quien todavia no lo compro tiene que poder ver que trae, y RLS no le deja
 * leer esas clases. 🔴 Nunca bunny_video_id, stream_playback_id ni similares.
 */
export async function getClasesDelPack(packId: string): Promise<ClaseDelPack[]> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("pack_videos")
    .select("display_order, videos(slug, title_i18n, description_i18n, duration_seconds, category_slugs, thumbnail_url, status)")
    .eq("pack_id", packId)
    .order("display_order");
  type V = { slug: string; title_i18n: Record<string, string>; description_i18n: Record<string, string>; duration_seconds: number; category_slugs: string[]; thumbnail_url: string | null; status: string };
  return ((data ?? []) as unknown as { videos: V | V[] | null }[])
    .map((r) => (Array.isArray(r.videos) ? r.videos[0] : r.videos))
    .filter((v): v is V => !!v && v.status === "published")
    .map((v) => ({
      slug: v.slug,
      titulo: resolveI18nText(v.title_i18n) || v.slug,
      descripcion: resolveI18nText(v.description_i18n) || "",
      minutos: Math.round((v.duration_seconds ?? 0) / 60),
      categoria: v.category_slugs?.[0] ?? null,
      portada: portadaDeClase(v),
    }));
}

export function precio(centimos: number, moneda: string) {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: (moneda || "eur").toUpperCase(), maximumFractionDigits: centimos % 100 ? 2 : 0 }).format(centimos / 100);
}
