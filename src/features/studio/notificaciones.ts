import { cache } from "react";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";

/**
 * Lo que va en la campanita de notificaciones de la alumna: invitaciones de
 * Brunela a clases en vivo que todavia no pasaron, y anuncios activos.
 *
 * Antes eran carteles apilados arriba del inicio (hasta cuatro, empujando el
 * saludo hacia abajo). Pedido de la duena: "un lugar de notificaciones arriba".
 *
 * Con el cliente DE ELLA: RLS ya filtra anuncios por plan e invitaciones por
 * usuaria. A la admin RLS le devuelve todo, asi que se recorta a mano con el
 * plan de su perfil, igual que en el inicio.
 */
export type Notificacion = {
  id: string;
  tipo: "invitacion" | "anuncio";
  titulo: string;
  texto: string;
  cuando: string; // ISO: fecha de la clase o de publicacion
  href: string | null;
};

const RANGO: Record<string, number> = { none: 0, corps_de_ballet: 1, solista: 2, principal: 3 };

export const getNotificaciones = cache(async (userId: string, tier: string, esAdmin: boolean): Promise<Notificacion[]> => {
  const supabase = await createSupabaseServerClient();
  const ahora = new Date().toISOString();

  let anuncios = supabase
    .from("studio_announcements")
    .select("id, title, content, tier_target, published_at")
    .eq("is_active", true)
    .or("expires_at.is.null,expires_at.gt." + ahora)
    .order("published_at", { ascending: false })
    .limit(10);
  if (esAdmin) {
    const r = RANGO[tier] ?? 0;
    anuncios = anuncios.in("tier_target", ["all", ...Object.keys(RANGO).filter((t) => t !== "none" && RANGO[t] <= r)]);
  }

  const [{ data: an }, { data: inv }] = await Promise.all([
    anuncios,
    supabase
      .from("live_session_invitations")
      .select("live_session_id, live_sessions(id, slug, title_i18n, starts_at, status)")
      .eq("user_id", userId),
  ]);

  type Ses = { id: string; slug: string; title_i18n: Record<string, string>; starts_at: string; status: string };
  const invitaciones: Notificacion[] = ((inv ?? []) as unknown as { live_sessions: Ses | Ses[] | null }[])
    .map((i) => (Array.isArray(i.live_sessions) ? i.live_sessions[0] : i.live_sessions))
    .filter((s): s is Ses => !!s && s.status === "scheduled" && s.starts_at >= ahora)
    .map((s) => ({
      id: "inv-" + s.id,
      tipo: "invitacion",
      titulo: "Brunela te invitó a una clase en vivo",
      texto: (s.title_i18n?.es ?? s.slug) + ". Entrás aunque no tengas ese plan: reservá tu lugar.",
      cuando: s.starts_at,
      href: "/dashboard/live",
    }));

  const avisos: Notificacion[] = ((an ?? []) as { id: string; title: string | null; content: string; published_at: string }[]).map((a) => ({
    id: "an-" + a.id,
    tipo: "anuncio",
    titulo: a.title || "Novedad del estudio",
    texto: a.content,
    cuando: a.published_at,
    href: null,
  }));

  return [...invitaciones, ...avisos];
});
