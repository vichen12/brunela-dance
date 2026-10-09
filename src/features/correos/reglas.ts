/**
 * Reglas PURAS de los correos del estudio (sin base, sin red, sin servidor):
 * las claves que impiden mandar dos veces, las ventanas de tiempo en hora de
 * Madrid y como se escriben las fechas. Las usan los disparadores y las pruebas
 * (tests/sistema/correos.test.ts).
 *
 * Migracion: supabase/migrations/20261009_3_correos_enviados.sql.
 */

import { diasRestantes } from "../studio/acceso-gratis-reglas";
import { isoAMadrid, madridAIso, ZONA_ESTUDIO } from "../studio/sesiones-privadas-reglas";

export type TipoCorreo = "bienvenida" | "gratis_por_vencer" | "gratis_terminado" | "recordatorio_vivo" | "invitacion_vivo";

export const MIGRACION_CORREOS = "20261009_3_correos_enviados.sql";

/**
 * La tabla no existe todavia: la duena no corrio la migracion.
 *   42P01     -> Postgres directo
 *   PGRST205  -> PostgREST ("Could not find the table ... in the schema cache")
 */
export function esFaltaDeTablaCorreos(error: { code?: string; message?: string } | null | undefined) {
  if (!error) return false;
  return error.code === "42P01" || error.code === "PGRST205" || /could not find the table/i.test(error.message ?? "");
}

/** 23505: la clave ya estaba. Para el registro de correos significa "ya se mando". */
export function esClaveRepetida(error: { code?: string } | null | undefined) {
  return error?.code === "23505";
}

// ─── Claves ────────────────────────────────────────────────────────────────
// Una clave = un correo, para siempre. Lo que va despues del motivo es lo que
// hace que dos correos sean DISTINTOS: la fecha de fin en el acceso gratis
// (un regalo nuevo vuelve a avisar), la reserva en el recordatorio (otra clase
// es otro recordatorio).

/** "2026-10-16": el dia calendario del instante, en Madrid. */
export function diaMadrid(iso: string) {
  return isoAMadrid(iso, ZONA_ESTUDIO).fecha;
}

export const claves = {
  bienvenida: (alumnaId: string) => `bienvenida:${alumnaId}`,
  gratisPorVencer: (alumnaId: string, hastaIso: string) => `gratis-por-vencer:${alumnaId}:${diaMadrid(hastaIso)}`,
  gratisTerminado: (alumnaId: string, hastaIso: string) => `gratis-terminado:${alumnaId}:${diaMadrid(hastaIso)}`,
  recordatorio: (reservaId: string) => `recordatorio:${reservaId}`,
  invitacion: (sesionId: string, alumnaId: string) => `invitacion:${sesionId}:${alumnaId}`,
};

// ─── Acceso gratis ─────────────────────────────────────────────────────────

/** Cuantos dias antes del fin se avisa. */
export const DIAS_AVISO_POR_VENCER = 3;

/**
 * Hasta cuantos dias despues del fin se manda "terminó tu acceso gratis".
 * Sin tope, el primer cron despues de desplegar le escribiria a toda alumna
 * cuyo regalo vencio hace meses. Con 7 dias alcanza: el cron corre a diario.
 */
export const DIAS_VENTANA_TERMINADO = 7;

/**
 * ¿Toca el aviso "te quedan N dias"? Solo entre 1 y 3 dias CALENDARIO (Madrid)
 * antes del fin. El dia del fin (0) no: el texto diria "mañana" y seria falso.
 * Devuelve los dias restantes o null.
 */
export function diasParaAvisoPorVencer(hastaIso: string, ahora = Date.now()): number | null {
  if (Date.parse(hastaIso) <= ahora) return null;
  const d = diasRestantes(hastaIso, ahora);
  return d >= 1 && d <= DIAS_AVISO_POR_VENCER ? d : null;
}

/** ¿Toca "terminó tu acceso gratis"? Vencido, y hace menos de 7 dias. */
export function tocaAvisoTerminado(hastaIso: string, ahora = Date.now()) {
  const fin = Date.parse(hastaIso);
  return fin <= ahora && fin > ahora - DIAS_VENTANA_TERMINADO * 86400000;
}

// ─── Clases en vivo ────────────────────────────────────────────────────────

/** [inicio de hoy, inicio de mañana) en Madrid, como ISO en UTC. Para la consulta. */
export function rangoDeHoyEnMadrid(ahora = Date.now()) {
  const hoy = isoAMadrid(new Date(ahora).toISOString()).fecha;
  const [y, m, d] = hoy.split("-").map(Number);
  const manana = new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
  return { desde: madridAIso(hoy, "00:00")!, hasta: madridAIso(manana, "00:00")! };
}

/** ¿La clase es HOY en Madrid y todavia no empezo? Es lo que recibe recordatorio. */
export function tocaRecordatorio(startsAtIso: string, ahora = Date.now()) {
  const { desde, hasta } = rangoDeHoyEnMadrid(ahora);
  const t = Date.parse(startsAtIso);
  return t > ahora && t >= Date.parse(desde) && t < Date.parse(hasta);
}

/** "Jueves 16 de octubre" y "19:00 (hora de Madrid)", como los piden los correos. */
export function fechaYHoraDeClase(startsAtIso: string) {
  const dia = new Intl.DateTimeFormat("es-ES", { timeZone: ZONA_ESTUDIO, weekday: "long", day: "numeric", month: "long" })
    .format(new Date(startsAtIso))
    .replace(",", "");
  return {
    fecha: dia.charAt(0).toUpperCase() + dia.slice(1),
    hora: `${isoAMadrid(startsAtIso).hora} (hora de Madrid)`,
  };
}

/** La pagina de la clase en el estudio. La ruta es /dashboard/live/[slug]. */
export function urlDeClase(appUrl: string, slug: string) {
  return `${appUrl.replace(/\/$/, "")}/dashboard/live/${encodeURIComponent(slug)}`;
}

// ─── Bienvenida desde el webhook ───────────────────────────────────────────

/** Lo minimo de un evento de Stripe que hace falta mirar. */
export type EventoParaBienvenida = {
  type: string;
  data: {
    object: { status?: string | null; metadata?: Record<string, string> | null };
    previous_attributes?: { status?: string | null } | null;
  };
};

/**
 * ¿A quien darle la bienvenida por este evento? null = a nadie.
 *
 *   · Suscripcion NUEVA (created) que ya da acceso (trialing / active).
 *   · Suscripcion que PASA de 'incomplete' a active/trialing: la que se creo
 *     esperando la autenticacion de la tarjeta (3DS) y recien ahora entra.
 *   · Pack registrado (lo decide el webhook: `packAplicado`).
 *
 * ⚠️ NUNCA cualquier `updated`. Una renovacion o un cambio de plan tambien son
 *    `updated` con status 'active': sin esta regla, toda alumna que ya pagaba
 *    antes de existir los correos recibiria "ya estás adentro" en su proxima
 *    renovacion. La clave (bienvenida:<id>) frena el segundo, no el primero.
 */
export function alumnaParaBienvenida(
  evento: EventoParaBienvenida,
  r: { suscripcionAplicada: boolean; packAplicado: boolean }
): string | null {
  const userId = evento.data.object.metadata?.user_id || null;
  if (!userId) return null;
  if (r.packAplicado && evento.type === "checkout.session.completed") return userId;
  if (!r.suscripcionAplicada) return null;

  const status = evento.data.object.status ?? "";
  if (status !== "active" && status !== "trialing") return null;
  if (evento.type === "customer.subscription.created") return userId;
  if (evento.type === "customer.subscription.updated" && evento.data.previous_attributes?.status === "incomplete") {
    return userId;
  }
  return null;
}
