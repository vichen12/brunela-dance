import { createSupabaseAdminClient } from "@/src/lib/supabase/admin";
import { resolveI18nText } from "@/src/features/studio/helpers";
import { portadaDeClase } from "@/src/lib/video/portada";
import { ordenarNovedades, type Novedad } from "@/src/features/studio/novedades-reglas";

/**
 * "Novedades" del inicio de la alumna (pedido 2026-11-06): lo ultimo que se
 * publico, sea clase, plan de trabajo, pack o anuncio de Brunela. Sale solo de
 * lo que ya se publica: no hay nada extra que cargar.
 *
 * ⚠️ service_role y columnas a mano, como la vitrina de clases: RLS no le deja
 *    ver a una alumna las clases de otro plan, y justamente esas tambien son
 *    novedad (al entrar, la ficha le dice que plan hace falta). Nunca ids de video.
 */
const POR_TIPO = 6;

type Anuncio = { id: string; title: string; content: string; published_at: string | null };

/** Los anuncios los pasa el inicio, que ya los leyo con el cliente de ella (RLS por plan). */
export async function getNovedades(anuncios: Anuncio[]): Promise<Novedad[]> {
  const db = createSupabaseAdminClient();
  const [clases, planes, packs] = await Promise.all([
    db.from("videos")
      .select("slug, title_i18n, thumbnail_url, planes_permitidos, content_type, published_at")
      .eq("status", "published").not("published_at", "is", null)
      .order("published_at", { ascending: false }).limit(POR_TIPO),
    db.from("programs")
      .select("slug, title_i18n, cover_image_url, duration_days, published_at, created_at")
      .eq("status", "published")
      .order("created_at", { ascending: false }).limit(POR_TIPO),
    db.from("packs")
      .select("slug, name_i18n, cover_image_url, price_cents, currency, created_at")
      .eq("is_published", true)
      .order("created_at", { ascending: false }).limit(POR_TIPO),
  ]);
  for (const r of [clases, planes, packs]) if (r.error) console.error("[novedades]", r.error.message);

  const lista: Novedad[] = [
    ...((clases.data ?? []) as { slug: string; title_i18n: Record<string, string>; thumbnail_url: string | null; planes_permitidos: string[] | null; content_type: string | null; published_at: string }[]).map((v) => ({
      clave: "clase-" + v.slug,
      tipo: "clase" as const,
      titulo: resolveI18nText(v.title_i18n) || v.slug,
      detalle: v.content_type === "mini_training" ? "Mini training" : null,
      href: `/dashboard/library/${v.slug}`,
      imagen: portadaDeClase(v),
      fecha: v.published_at,
      gratis: (v.planes_permitidos ?? []).includes("none"),
    })),
    ...((planes.data ?? []) as { slug: string; title_i18n: Record<string, string>; cover_image_url: string | null; duration_days: number | null; published_at: string | null; created_at: string }[]).map((p) => ({
      clave: "plan-" + p.slug,
      tipo: "plan" as const,
      titulo: resolveI18nText(p.title_i18n) || p.slug,
      detalle: p.duration_days ? `${p.duration_days} días` : null,
      href: `/dashboard/programs/${p.slug}`,
      imagen: p.cover_image_url,
      fecha: p.published_at ?? p.created_at,
      gratis: false,
    })),
    ...((packs.data ?? []) as { slug: string; name_i18n: Record<string, string>; cover_image_url: string | null; price_cents: number; currency: string; created_at: string }[]).map((p) => ({
      clave: "pack-" + p.slug,
      tipo: "pack" as const,
      titulo: resolveI18nText(p.name_i18n) || p.slug,
      detalle: `${(p.price_cents / 100).toLocaleString("es-ES", { minimumFractionDigits: p.price_cents % 100 ? 2 : 0 })} ${p.currency.toUpperCase()} · pago único`,
      href: `/dashboard/packs/${p.slug}`,
      imagen: p.cover_image_url,
      fecha: p.created_at,
      gratis: false,
    })),
    ...anuncios.filter((a) => a.published_at).map((a) => ({
      clave: "anuncio-" + a.id,
      tipo: "anuncio" as const,
      titulo: a.title,
      detalle: a.content,
      href: null,
      imagen: null,
      fecha: a.published_at!,
      gratis: false,
    })),
  ];
  return ordenarNovedades(lista);
}
