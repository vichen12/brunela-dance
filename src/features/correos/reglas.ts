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

export type TipoCorreo =
  | "bienvenida"
  | "gratis_por_vencer"
  | "gratis_terminado"
  | "recordatorio_vivo"
  | "invitacion_vivo"
  | "clase_nueva";

export const MIGRACION_CORREOS = "20261009_3_correos_enviados.sql";
/** Agrega el tipo 'clase_nueva' a correos_enviados y profiles.correos_desactivados. */
export const MIGRACION_CLASE_NUEVA = "20261012_clase_nueva.sql";

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
  /** Una por clase y alumna, para siempre: despublicar y volver a publicar no la repite. */
  claseNueva: (videoId: string, alumnaId: string) => `clase-nueva:${videoId}:${alumnaId}`,
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

// ─── Preferencias de correo de la alumna ──────────────────────────────────
//
// DOS FUENTES, A PROPOSITO (20261012_clase_nueva.sql):
//
//   · Clases nuevas -> las columnas de marketing (marketing_opt_in,
//     marketing_opt_out_at). Es lo que escribe el enlace de baja (/baja) y es
//     la prueba del consentimiento. Duplicarlo en la lista dejaria dos verdades
//     que pueden contradecirse; por eso el CHECK de la columna NO admite
//     'clase_nueva'.
//   · El resto de los opcionales -> profiles.correos_desactivados (lo que ella
//     APAGO; vacia = recibe todo).
//
// Bienvenida, confirmacion de cuenta, cambio de contraseña y recibos no son
// opcionales: no estan en ninguna de las dos.

/** Los tipos que una alumna puede apagar desde Mi perfil (fuera de clase_nueva). */
export const TIPOS_DESACTIVABLES = ["recordatorio_vivo", "invitacion_vivo", "gratis_por_vencer", "gratis_terminado"] as const;
export type TipoDesactivable = (typeof TIPOS_DESACTIVABLES)[number];

export type InterruptorDeCorreo = {
  campo: "clase_nueva" | "recordatorio_vivo" | "invitacion_vivo" | "acceso_gratis";
  titulo: string;
  descripcion: string;
  /** Lo que se guarda en correos_desactivados si lo apaga. Vacio = va por las columnas de marketing. */
  tipos: readonly TipoDesactivable[];
};

/** Los interruptores de Mi perfil. "Acceso gratis" apaga los dos avisos juntos. */
export const INTERRUPTORES_DE_CORREO: readonly InterruptorDeCorreo[] = [
  { campo: "clase_nueva", titulo: "Clases nuevas", descripcion: "Un correo cuando Brunela sube una clase que podés ver.", tipos: [] },
  { campo: "recordatorio_vivo", titulo: "Recordatorio el día de tu clase en vivo", descripcion: "Esa mañana, si reservaste lugar en una clase en vivo.", tipos: ["recordatorio_vivo"] },
  { campo: "invitacion_vivo", titulo: "Invitaciones de Brunela a clases en vivo", descripcion: "Cuando Brunela te invita a una clase que no está en tu plan.", tipos: ["invitacion_vivo"] },
  { campo: "acceso_gratis", titulo: "Avisos de tu acceso gratis", descripcion: "Unos días antes de que termine, y cuando terminó.", tipos: ["gratis_por_vencer", "gratis_terminado"] },
];

/** Lo que se guarda en correos_desactivados a partir de los interruptores ENCENDIDOS. */
export function desactivadosDesdeInterruptores(encendidos: ReadonlySet<string>): TipoDesactivable[] {
  const out: TipoDesactivable[] = [];
  for (const i of INTERRUPTORES_DE_CORREO) if (!encendidos.has(i.campo)) out.push(...i.tipos);
  return out;
}

/** ¿Apago este tipo? Lista null/undefined (columna sin migrar) = no apago nada. */
export function tipoDesactivado(lista: readonly string[] | null | undefined, tipo: TipoDesactivable) {
  return !!lista && lista.includes(tipo);
}

/**
 * Baja EXPLICITA de los avisos de clase nueva: toco "darme de baja" (o apago el
 * interruptor) y no volvio a encenderlo. Quien nunca marco la casilla del alta
 * NO esta dada de baja: pedido de la dueña (2026-10-12), le llega igual.
 */
export function dioDeBajaClasesNuevas(p: { marketing_opt_in?: boolean | null; marketing_opt_out_at?: string | null }) {
  return !!p.marketing_opt_out_at && p.marketing_opt_in !== true;
}

/** El mismo criterio, como filtro `or` de PostgREST: sin fecha de baja, o volvio a aceptar. */
export const FILTRO_SIN_BAJA_CLASES_NUEVAS = "marketing_opt_out_at.is.null,marketing_opt_in.is.true";

// ─── Clase nueva ──────────────────────────────────────────────────────────

export type PerfilParaClaseNueva = {
  id: string;
  email: string | null;
  is_admin: boolean | null;
  membership_tier: string | null;
  marketing_opt_in?: boolean | null;
  marketing_opt_out_at?: string | null;
};

/**
 * ¿Le llega el aviso de esta clase? La misma regla que la policy
 * videos_select_allowed_by_tier (la que decide si la VE):
 *   su plan esta en planes_permitidos  O  compro un pack que la incluye.
 * Y ademas: no es admin, tiene correo y no se dio de baja.
 */
export function recibeClaseNueva(p: PerfilParaClaseNueva, planesPermitidos: readonly string[], compradoras: ReadonlySet<string>) {
  if (p.is_admin) return false;
  if (!p.email?.trim()) return false;
  if (dioDeBajaClasesNuevas(p)) return false;
  const porPlan = !!p.membership_tier && p.membership_tier !== "none" && planesPermitidos.includes(p.membership_tier);
  return porPlan || compradoras.has(p.id);
}

/** ¿Este guardado la hace visible? Solo el paso de no-publicada a publicada. */
export function pasaAPublicada(antes: string | null | undefined, despues: string) {
  return despues === "published" && antes !== "published";
}

/**
 * published_at al guardar. Una clase que YA estaba publicada conserva su fecha:
 * antes cada guardado la ponia en "ahora", y el cron (que completa los avisos
 * de las publicadas en los ultimos dias) habria tomado por nueva una clase de
 * hace meses.
 */
export function publishedAtAlGuardar(
  antes: { status: string | null; published_at: string | null } | null,
  nuevoStatus: string,
  ahora = Date.now()
): string | null {
  if (nuevoStatus !== "published") return null;
  if (antes?.status === "published" && antes.published_at) return antes.published_at;
  return new Date(ahora).toISOString();
}

/** Hasta cuantos dias despues de publicada el cron completa los avisos que faltaron. */
export const DIAS_VENTANA_CLASE_NUEVA = 3;

/** Resend acepta hasta 100 correos por llamada a /emails/batch. */
export const TAMANO_LOTE = 100;

export function enLotes<T>(lista: readonly T[], tamano = TAMANO_LOTE): T[][] {
  if (!Number.isInteger(tamano) || tamano < 1) throw new Error("tamano de lote invalido");
  const out: T[][] = [];
  for (let i = 0; i < lista.length; i += tamano) out.push(lista.slice(i, i + tamano));
  return out;
}

/** 23514: un CHECK rechazo la fila. En correos_enviados = el tipo todavia no esta permitido (falta la migracion). */
export function esTipoNoPermitido(error: { code?: string; message?: string } | null | undefined) {
  return error?.code === "23514" || /correos_enviados_tipo_valido/.test(error?.message ?? "");
}

/** 42703: la columna no existe (correos_desactivados sin 20261012_clase_nueva.sql). */
export function esColumnaAusente(error: { code?: string; message?: string } | null | undefined) {
  return error?.code === "42703" || /column .* does not exist/i.test(error?.message ?? "");
}

/** La pagina de una clase grabada en el estudio. */
export function urlDeClaseGrabada(appUrl: string, slug: string) {
  return `${appUrl.replace(/\/$/, "")}/dashboard/library/${encodeURIComponent(slug)}`;
}

/** El enlace de baja. El token es de un solo proposito (20260803_marketing_consent.sql). */
export function urlDeBaja(appUrl: string, token: string) {
  return `${appUrl.replace(/\/$/, "")}/baja?token=${encodeURIComponent(token)}`;
}

/** El agregado al cartel de exito del panel (lo usa tambien el formulario de subida, en el navegador). */
export function avisoDeClaseNueva(cuantas: number | null | undefined): string {
  if (!cuantas || cuantas < 1) return "";
  return cuantas === 1 ? " Se le va a avisar por mail a 1 alumna." : ` Se les va a avisar por mail a ${cuantas} alumnas.`;
}
