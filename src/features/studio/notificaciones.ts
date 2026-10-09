import { cache } from "react";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";
import { cuandoClase } from "@/src/features/studio/fecha-clase";
import { proveedorDe, type Proveedor } from "@/src/features/studio/enlace-clase";
import { getMisSesionesPrivadas } from "@/src/features/studio/sesiones-privadas";
import { ZONA_ESTUDIO, finDe, proveedorDePrivada, ventanaUnirse, type SesionPrivada } from "@/src/features/studio/sesiones-privadas-reglas";

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
  /**
   * invitacion / anuncio / recordatorio: alumna.
   * pendiente / completar (y recordatorio): admin, src/features/admin/recordatorios.ts.
   */
  tipo: "invitacion" | "anuncio" | "recordatorio" | "pendiente" | "completar";
  titulo: string;
  texto: string;
  /** ISO: fecha de la clase o de publicacion. null = no se muestra fecha. */
  cuando: string | null;
  href: string | null;
  /** true = el href es el enlace de Zoom/Meet: se abre en pestaña nueva. */
  externo?: boolean;
};

/**
 * Las clases que la alumna RESERVO (estado reserved) y que empiezan en las
 * proximas 48 h o estan en curso, con su enlace si RLS se lo deja leer.
 *
 * La usan los recordatorios de la campanita y el cartel "Tu clase empieza en
 * X min" del inicio y de la agenda. Memoizada por request: el layout y la
 * pagina la piden en el mismo render.
 *
 * ⚠️ TODO con el cliente DE ELLA. El enlace sale de live_session_access_links
 *    y lo decide RLS (can_current_user_view_live_session_link): si no reservo,
 *    no vuelve. Nunca se lee con service_role para una alumna.
 *    El filtro por user_id en las reservas es para la ADMIN, a quien RLS le
 *    devuelve las de todas: sin el, veria recordatorios de clases ajenas.
 */
export type ClaseCercana = {
  id: string;
  slug: string;
  titulo: string;
  inicio: string;
  fin: string;
  zona: string;
  joinUrl: string | null;
  passcode: string | null;
  proveedor: Proveedor | null;
};

const H48 = 48 * 3600 * 1000;

export const getMisClasesCercanas = cache(async (userId: string): Promise<ClaseCercana[]> => {
  const supabase = await createSupabaseServerClient();
  const ahora = Date.now();

  type Ses = { id: string; slug: string; title_i18n: Record<string, string>; starts_at: string; ends_at: string; session_timezone: string; status: string };
  const { data } = await supabase
    .from("live_session_bookings")
    .select("live_session_id, live_sessions(id, slug, title_i18n, starts_at, ends_at, session_timezone, status)")
    .eq("user_id", userId)
    .eq("status", "reserved");

  const sesiones = ((data ?? []) as unknown as { live_sessions: Ses | Ses[] | null }[])
    .map((b) => (Array.isArray(b.live_sessions) ? b.live_sessions[0] : b.live_sessions))
    .filter((s): s is Ses =>
      !!s && s.status === "scheduled" &&
      new Date(s.ends_at).getTime() > ahora &&
      new Date(s.starts_at).getTime() - ahora <= H48)
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  if (!sesiones.length) return [];

  const { data: links } = await supabase
    .from("live_session_access_links")
    .select("live_session_id, join_url, passcode, provider")
    .in("live_session_id", sesiones.map((s) => s.id));
  type L = { live_session_id: string; join_url: string; passcode: string | null; provider: string | null };
  const linkDe = new Map(((links ?? []) as L[]).map((l) => [l.live_session_id, l]));

  return sesiones.map((s) => {
    const l = linkDe.get(s.id);
    return {
      id: s.id,
      slug: s.slug,
      titulo: s.title_i18n?.es || s.title_i18n?.en || s.slug,
      inicio: s.starts_at,
      fin: s.ends_at,
      zona: s.session_timezone || "Europe/Madrid",
      joinUrl: l?.join_url ?? null,
      passcode: l?.passcode ?? null,
      proveedor: l ? proveedorDe(l.provider, l.join_url) : null,
    };
  });
});

/** Falta 1 h o menos, o ya empezo y no termino. */
export function esInminente(c: ClaseCercana, ahora = Date.now()) {
  return new Date(c.inicio).getTime() - ahora <= 3600 * 1000 && new Date(c.fin).getTime() > ahora;
}

/**
 * Recordatorios de SUS clases reservadas, para la campanita.
 *
 * El id cambia con la etapa (48h -> hoy -> ya): marcar como leido el de
 * "mañana" no apaga el de "empieza ya". Vuelve a contar como nuevo al
 * acercarse la clase, que es justo cuando importa.
 */
function recordatorios(clases: ClaseCercana[]): Notificacion[] {
  const ahora = Date.now();
  return clases.map((c) => {
    const perfil = `/dashboard/live/${c.slug}`;
    if (esInminente(c, ahora)) {
      const yaEmpezo = new Date(c.inicio).getTime() <= ahora;
      const hora = cuandoClase(c.inicio, c.zona, ahora).hora;
      return {
        id: `rec-ya-${c.id}`,
        tipo: "recordatorio" as const,
        titulo: "¡Empieza ya! Tocá para unirte",
        texto: `${c.titulo} · ${yaEmpezo ? "empezó a las" : "a las"} ${hora}`,
        cuando: null,
        href: c.joinUrl ?? perfil,
        externo: !!c.joinUrl,
      };
    }
    const q = cuandoClase(c.inicio, c.zona, ahora);
    return {
      id: `rec-${q.esHoy ? "hoy" : "48h"}-${c.id}`,
      tipo: "recordatorio" as const,
      titulo: `Tu clase ${c.titulo} es ${q.dia} a las ${q.hora}`,
      texto: c.joinUrl ? "El enlace ya está listo en la página de la clase." : "El enlace aparece en la página de la clase antes de que empiece.",
      cuando: null,
      href: perfil,
    };
  });
}

/**
 * Sus sesiones privadas de los proximos 7 dias, para la campanita.
 *
 * Misma idea de etapas que las clases reservadas: el id cambia (semana -> hoy
 * -> ya), asi que al acercarse vuelve a contar como nueva. En la etapa "ya"
 * (desde 15 min antes) el aviso abre directo el enlace, si lo hay.
 */
const SIETE_DIAS = 7 * 24 * 3600 * 1000;

export function recordatoriosPrivadas(sesiones: SesionPrivada[], ahora = Date.now()): Notificacion[] {
  return sesiones
    .filter((s) => s.estado === "agendada" && finDe(s) > ahora && new Date(s.starts_at).getTime() - ahora <= SIETE_DIAS)
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
    .map((s) => {
      const pagina = "/dashboard/sesiones-privadas";
      const q = cuandoClase(s.starts_at, ZONA_ESTUDIO, ahora);
      if (ventanaUnirse(s, ahora) === "abierta") {
        const prov = proveedorDePrivada(s);
        return {
          id: `priv-ya-${s.id}`,
          tipo: "recordatorio" as const,
          titulo: "Tu sesión privada empieza ya",
          texto: s.enlace ? `A las ${q.hora}. Tocá para unirte${prov === "meet" ? " por Meet" : prov === "zoom" ? " por Zoom" : ""}.` : `A las ${q.hora}. Brunela te pasa el enlace en un momento.`,
          cuando: null,
          href: s.enlace ?? pagina,
          externo: !!s.enlace,
        };
      }
      return {
        id: `priv-${q.esHoy ? "hoy" : "prox"}-${s.id}-${s.starts_at}`,
        tipo: "recordatorio" as const,
        titulo: `Tu sesión privada es ${q.dia} a las ${q.hora}`,
        texto: s.enlace ? "El enlace ya está listo en Sesiones privadas." : "Brunela te pasa el enlace antes de empezar.",
        cuando: null,
        href: pagina,
      };
    });
}

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

  const [{ data: an }, { data: inv }, cercanas, privadas] = await Promise.all([
    anuncios,
    supabase
      .from("live_session_invitations")
      .select("live_session_id, live_sessions(id, slug, title_i18n, starts_at, status)")
      .eq("user_id", userId),
    getMisClasesCercanas(userId),
    // Sin la migracion 20261009_2 llega vacia: no aparece nada.
    getMisSesionesPrivadas(userId),
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

  // Los recordatorios van PRIMERO: son lo unico de la lista con hora.
  return [...recordatoriosPrivadas(privadas.sesiones), ...recordatorios(cercanas), ...invitaciones, ...avisos];
});
