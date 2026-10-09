import { cache } from "react";
import { requireAdmin } from "@/src/features/auth/guards";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";
import { resolveI18nText } from "@/src/features/studio/helpers";
import { cuandoClase } from "@/src/features/studio/fecha-clase";
import { proveedorDe, type Proveedor } from "@/src/features/studio/enlace-clase";
import type { Notificacion } from "@/src/features/studio/notificaciones";

/**
 * Recordatorios de la admin sobre las clases en vivo.
 *
 * Pedido de la duena: "que me tire recordatorios". Tres cosas, en el orden en
 * que se resuelven:
 *   1. clases de las proximas 48 h SIN enlace (las inscriptas no tienen por
 *      donde entrar);
 *   2. la clase de hoy o la proxima, con cuantas se anotaron;
 *   3. clases que ya terminaron y siguen "scheduled" (falta completarlas).
 *
 * Los usan la tarjeta de /admin y /admin/live y la campanita de la cabecera.
 *
 * Se lee con el cliente DE LA SESION, no con service_role: la admin pasa RLS
 * por is_admin(), asi que no hay nada que saltear. Igual se llama a
 * requireAdmin(): la funcion no puede depender de que la pantalla lo haya hecho.
 *
 * Todo lo que devuelve son cadenas y numeros: cruza a componentes de cliente
 * (la campanita, el panel) sin problema (trampa 6).
 */

export type RecordatoriosAdminDatos = {
  sinEnlace: { id: string; titulo: string; dia: string; hora: string }[];
  proxima: {
    id: string;
    titulo: string;
    dia: string;
    hora: string;
    enCurso: boolean;
    esHoy: boolean;
    inscriptas: number;
    capacidad: number;
    proveedor: Proveedor | null;
    joinUrl: string | null;
  } | null;
  sinCompletar: { id: string; titulo: string; fecha: string }[];
  /** Cuantas terminadas sin completar hay en total (la lista trae hasta 5). */
  sinCompletarTotal: number;
};

type Fila = {
  id: string;
  slug: string;
  title_i18n: Record<string, string>;
  starts_at: string;
  ends_at: string;
  session_timezone: string;
  capacity: number;
};

const COLS = "id, slug, title_i18n, starts_at, ends_at, session_timezone, capacity";
const H48 = 48 * 3600 * 1000;

export const cargarRecordatoriosAdmin = cache(async (): Promise<RecordatoriosAdminDatos> => {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();
  const ahora = Date.now();
  const ahoraIso = new Date(ahora).toISOString();
  const en48 = new Date(ahora + H48).toISOString();

  const [{ data: cercanas }, { data: siguiente }, { data: viejas, count: viejasCount }] = await Promise.all([
    // Proximas 48 h, incluida la que esta en curso (todavia no termino).
    supabase.from("live_sessions").select(COLS)
      .eq("status", "scheduled").gte("ends_at", ahoraIso).lte("starts_at", en48)
      .order("starts_at", { ascending: true }).limit(20),
    // La proxima aunque sea dentro de una semana: "la de hoy o la proxima".
    supabase.from("live_sessions").select(COLS)
      .eq("status", "scheduled").gte("ends_at", ahoraIso)
      .order("starts_at", { ascending: true }).limit(1),
    supabase.from("live_sessions").select(COLS, { count: "exact" })
      .eq("status", "scheduled").lt("ends_at", ahoraIso)
      .order("ends_at", { ascending: false }).limit(5),
  ]);

  const proximas = (cercanas ?? []) as Fila[];
  const prox = ((siguiente ?? []) as Fila[])[0] ?? null;
  const ids = [...new Set([...proximas.map((s) => s.id), ...(prox ? [prox.id] : [])])];

  const [{ data: links }, { count: inscriptas }] = await Promise.all([
    ids.length
      ? supabase.from("live_session_access_links").select("live_session_id, provider, join_url").in("live_session_id", ids)
      : Promise.resolve({ data: [] as { live_session_id: string; provider: string | null; join_url: string }[] }),
    prox
      ? supabase.from("live_session_bookings").select("id", { count: "exact", head: true })
          .eq("live_session_id", prox.id).eq("status", "reserved")
      : Promise.resolve({ count: 0 }),
  ]);
  const linkDe = new Map(((links ?? []) as { live_session_id: string; provider: string | null; join_url: string }[]).map((l) => [l.live_session_id, l]));

  const titulo = (s: Fila) => resolveI18nText(s.title_i18n) || s.slug;

  const sinEnlace = proximas
    .filter((s) => !linkDe.has(s.id))
    .map((s) => {
      const c = cuandoClase(s.starts_at, s.session_timezone, ahora);
      return { id: s.id, titulo: titulo(s), dia: c.dia, hora: c.hora };
    });

  let proxima: RecordatoriosAdminDatos["proxima"] = null;
  if (prox) {
    const c = cuandoClase(prox.starts_at, prox.session_timezone, ahora);
    const l = linkDe.get(prox.id);
    proxima = {
      id: prox.id,
      titulo: titulo(prox),
      dia: c.dia,
      hora: c.hora,
      enCurso: new Date(prox.starts_at).getTime() <= ahora,
      esHoy: c.esHoy,
      inscriptas: inscriptas ?? 0,
      capacidad: prox.capacity,
      proveedor: l ? proveedorDe(l.provider, l.join_url) : null,
      joinUrl: l?.join_url ?? null,
    };
  }

  const sinCompletar = ((viejas ?? []) as Fila[]).map((s) => {
    const fecha = new Intl.DateTimeFormat("es-ES", {
      weekday: "short", day: "numeric", month: "short", timeZone: s.session_timezone || "Europe/Madrid",
    }).format(new Date(s.starts_at)).replace(/\./g, "");
    return { id: s.id, titulo: titulo(s), fecha };
  });

  return { sinEnlace, proxima, sinCompletar, sinCompletarTotal: viejasCount ?? sinCompletar.length };
});

/**
 * Los mismos recordatorios en el formato de la campanita.
 *
 * El id lleva la ETAPA (dia de la clase, hoy/en curso) para que, al acercarse,
 * vuelva a contar como nuevo aunque ya se haya marcado como leido.
 */
export function recordatoriosComoNotificaciones(d: RecordatoriosAdminDatos): Notificacion[] {
  const items: Notificacion[] = [];
  for (const s of d.sinEnlace) {
    items.push({
      id: `adm-sinenlace-${s.dia === "hoy" ? "hoy" : s.dia === "mañana" ? "manana" : "48h"}-${s.id}`,
      tipo: "pendiente",
      titulo: `${s.titulo} es ${s.dia} ${s.hora} y no tiene enlace`,
      texto: "Cargalo para que las inscriptas puedan entrar.",
      cuando: null,
      href: `/admin/live/${s.id}#enlace`,
    });
  }
  if (d.proxima) {
    const p = d.proxima;
    const etapa = p.enCurso ? "ya" : p.esHoy ? "hoy" : "prox";
    items.push({
      id: `adm-proxima-${etapa}-${p.id}`,
      tipo: "recordatorio",
      titulo: p.enCurso ? `${p.titulo} está en curso` : `${p.esHoy ? "Hoy" : "Próxima clase"}: ${p.titulo}`,
      texto: `${p.enCurso ? "Empezó a las" : p.esHoy ? "A las" : p.dia.charAt(0).toUpperCase() + p.dia.slice(1) + " a las"} ${p.hora} · ${p.inscriptas} ${p.inscriptas === 1 ? "inscripta" : "inscriptas"} de ${p.capacidad}`,
      cuando: null,
      href: `/admin/live/${p.id}`,
    });
  }
  for (const s of d.sinCompletar) {
    items.push({
      id: `adm-completar-${s.id}`,
      tipo: "completar",
      titulo: `${s.titulo} ya terminó`,
      texto: `Fue el ${s.fecha}. ¿Marcar como completada?`,
      cuando: null,
      href: `/admin/live/${s.id}`,
    });
  }
  return items;
}
