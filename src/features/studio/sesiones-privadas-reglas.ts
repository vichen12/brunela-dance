/**
 * Reglas puras de las sesiones privadas 1 a 1 (plan Principal: 2 por mes).
 *
 * Sin base y sin servidor: las usan el panel, el dashboard, la campanita, los
 * recordatorios, el calendario y las pruebas (tests/sistema/sesiones-privadas).
 *
 * Migracion: supabase/migrations/20261009_2_sesiones_privadas.sql.
 *
 * ⚠️ TODO EN HORA DE MADRID. Brunela escribe "jueves a las 18:00" pensando en
 *    Madrid, y el servidor corre en UTC (Vercel). Convertir con `new Date(
 *    "2026-10-16T18:00")` lo interpretaria en la zona del SERVIDOR y la sesion
 *    quedaria dos horas corrida. Por eso la conversion es explicita.
 */

// Imports RELATIVOS a proposito: este modulo lo cargan las pruebas
// (tests/sistema), que no resuelven el alias "@/".
import { detectarProveedor, validarEnlace, type Proveedor } from "./enlace-clase";
import { cuandoClase } from "./fecha-clase";

export const ZONA_ESTUDIO = "Europe/Madrid";

/** Lo que promete el plan Principal. Se muestra (X/2), no se impone. */
export const CUPO_MENSUAL = 2;

/** Duraciones que ofrece el formulario. 60 por defecto. */
export const DURACIONES = [30, 45, 60, 75, 90, 120] as const;
export const DURACION_POR_DEFECTO = 60;

/** Desde cuantos minutos antes se habilita "Unirse". */
export const MINUTOS_ANTES_DE_UNIRSE = 15;

export type EstadoPrivada = "agendada" | "cancelada" | "hecha";

export type SesionPrivada = {
  id: string;
  alumna_id: string;
  starts_at: string;
  duracion_minutos: number;
  enlace: string | null;
  proveedor: string | null;
  nota: string | null;
  estado: EstadoPrivada;
};

export const COLUMNAS_PRIVADA = "id, alumna_id, starts_at, duracion_minutos, enlace, proveedor, nota, estado";

export const AVISO_FALTA_MIGRACION_PRIVADAS =
  "Falta aplicar la migración 20261009_2_sesiones_privadas.sql en Supabase. Hasta entonces, las sesiones privadas no se pueden agendar.";

/**
 * La tabla no existe: la migracion no esta aplicada.
 *   PGRST205 = PostgREST no la encuentra en su cache de esquema (lo que
 *              devuelve hoy la API, comprobado contra la base el 2026-10-09).
 *   42P01    = Postgres "relation does not exist" (versiones anteriores).
 */
export function esFaltaDeTabla(error: { code?: string } | null | undefined) {
  return error?.code === "PGRST205" || error?.code === "42P01";
}

// ─── Hora de Madrid ─────────────────────────────────────────────────────────

/** Cuantos ms adelanta la zona sobre UTC en ese instante (Madrid: +1 h o +2 h). */
function desfase(ms: number, zona: string) {
  const p = new Intl.DateTimeFormat("en-US", {
    timeZone: zona, hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(new Date(ms));
  const v = (t: string) => Number(p.find((x) => x.type === t)?.value);
  const comoUtc = Date.UTC(v("year"), v("month") - 1, v("day"), v("hour"), v("minute"), v("second"));
  return comoUtc - Math.floor(ms / 1000) * 1000;
}

/**
 * "2026-10-16" + "18:00" en Madrid -> ISO en UTC. null si no es valido.
 *
 * Se corrige dos veces: el desfase de la hora pedida puede no ser el mismo que
 * el de la primera aproximacion la noche del cambio de hora.
 */
export function madridAIso(fecha: string, hora: string, zona = ZONA_ESTUDIO): string | null {
  const f = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha ?? "");
  const h = /^(\d{2}):(\d{2})$/.exec(hora ?? "");
  if (!f || !h) return null;
  const [y, mo, d, hh, mi] = [Number(f[1]), Number(f[2]), Number(f[3]), Number(h[1]), Number(h[2])];
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || hh > 23 || mi > 59) return null;
  const local = Date.UTC(y, mo - 1, d, hh, mi);
  // El dia tiene que existir: 31 de noviembre no es 1 de diciembre.
  if (new Date(local).getUTCDate() !== d) return null;
  let ms = local - desfase(local, zona);
  ms = local - desfase(ms, zona);
  return new Date(ms).toISOString();
}

/** ISO -> { fecha: "2026-10-16", hora: "18:00" } en Madrid. Para precargar el formulario. */
export function isoAMadrid(iso: string, zona = ZONA_ESTUDIO) {
  const d = new Date(iso);
  const fecha = new Intl.DateTimeFormat("en-CA", { timeZone: zona, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  const hora = new Intl.DateTimeFormat("en-GB", { timeZone: zona, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d);
  return { fecha, hora };
}

/** "2026-10" del instante, en Madrid. */
export function claveMes(iso: string | number, zona = ZONA_ESTUDIO) {
  return isoAMadrid(new Date(iso).toISOString(), zona).fecha.slice(0, 7);
}

/** Primer instante del mes (en Madrid) como ISO: para pedirle a la base "desde el 1". */
export function inicioDelMes(ahora = Date.now(), zona = ZONA_ESTUDIO) {
  return madridAIso(claveMes(ahora, zona) + "-01", "00:00", zona)!;
}

/** "jueves 16 de octubre a las 18:00" */
export function fechaHoraLarga(iso: string, zona = ZONA_ESTUDIO) {
  const d = new Date(iso);
  const dia = new Intl.DateTimeFormat("es-ES", { timeZone: zona, weekday: "long", day: "numeric", month: "long" }).format(d).replace(",", "");
  return `${dia} a las ${isoAMadrid(iso, zona).hora}`;
}

/** "jue 16 oct · 18:00" */
export function fechaHoraCorta(iso: string, zona = ZONA_ESTUDIO) {
  const d = new Date(iso);
  const dia = new Intl.DateTimeFormat("es-ES", { timeZone: zona, weekday: "short", day: "numeric", month: "short" }).format(d).replace(/[.,]/g, "");
  return `${dia} · ${isoAMadrid(iso, zona).hora}`;
}

// ─── Cupo y estados ─────────────────────────────────────────────────────────

export function finDe(s: Pick<SesionPrivada, "starts_at" | "duracion_minutos">) {
  return new Date(s.starts_at).getTime() + s.duracion_minutos * 60000;
}

/** Lo que se muestra: una agendada que ya termino cuenta como hecha. */
export function estadoVisible(s: Pick<SesionPrivada, "starts_at" | "duracion_minutos" | "estado">, ahora = Date.now()): EstadoPrivada {
  if (s.estado === "agendada" && finDe(s) <= ahora) return "hecha";
  return s.estado;
}

/**
 * Cuantas cuentan para el cupo del mes (Madrid): agendadas y hechas, no las
 * canceladas. Una del 31 a las 23:30 de Madrid es de ESE mes aunque en UTC ya
 * sea el 1 del siguiente... o al reves: lo decide Madrid.
 */
export function contarDelMes(sesiones: Pick<SesionPrivada, "starts_at" | "estado">[], mes: string, zona = ZONA_ESTUDIO) {
  return sesiones.filter((s) => s.estado !== "cancelada" && claveMes(s.starts_at, zona) === mes).length;
}

/** La proxima agendada que todavia no termino, o null. */
export function proximaDe<T extends Pick<SesionPrivada, "starts_at" | "duracion_minutos" | "estado">>(sesiones: T[], ahora = Date.now()): T | null {
  return [...sesiones]
    .filter((s) => s.estado === "agendada" && finDe(s) > ahora)
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at))[0] ?? null;
}

/**
 * Ventana del boton "Unirse": desde 15 min antes hasta que termina.
 *   antes     -> se muestra la fecha, el boton todavia no
 *   abierta   -> boton activo (si hay enlace)
 *   terminada -> ya paso
 */
export function ventanaUnirse(s: Pick<SesionPrivada, "starts_at" | "duracion_minutos">, ahora = Date.now()): "antes" | "abierta" | "terminada" {
  const ini = new Date(s.starts_at).getTime();
  if (ahora >= finDe(s)) return "terminada";
  if (ahora >= ini - MINUTOS_ANTES_DE_UNIRSE * 60000) return "abierta";
  return "antes";
}

export function proveedorDePrivada(s: Pick<SesionPrivada, "enlace" | "proveedor">): Proveedor | null {
  if (!s.enlace) return null;
  return detectarProveedor(s.enlace);
}

/**
 * Para los recordatorios de la admin: "en 45 min" / "en 1 h" si falta una
 * hora o menos ("ahora" si ya empezo); si no, "hoy a las 18:00".
 */
export function cuandoPrivada(iso: string, ahora = Date.now()): { texto: string; etapa: "ya" | "hoy" | "prox"; enCurso: boolean } {
  const min = Math.round((new Date(iso).getTime() - ahora) / 60000);
  if (min <= 0) return { texto: "ahora", etapa: "ya", enCurso: true };
  if (min <= 60) return { texto: min >= 55 ? "en 1 h" : `en ${min} min`, etapa: "ya", enCurso: false };
  const c = cuandoClase(iso, ZONA_ESTUDIO, ahora);
  return { texto: `${c.dia} a las ${c.hora}`, etapa: c.esHoy ? "hoy" : "prox", enCurso: false };
}

// ─── Formulario ─────────────────────────────────────────────────────────────

export type AgendaValida = {
  startsAt: string;
  duracion: number;
  enlace: string | null;
  proveedor: Proveedor | null;
  nota: string | null;
};

/**
 * Valida lo que manda el formulario. Devuelve los datos listos para escribir o
 * el motivo, en el idioma de Brunela.
 *
 * `permitirPasado`: al EDITAR una sesion vieja (por ejemplo, para cargarle una
 * nota) no tiene sentido exigir que sea futura.
 */
export function validarAgenda(
  crudo: { fecha: string; hora: string; duracion: string; enlace: string; nota: string },
  opciones: { ahora?: number; permitirPasado?: boolean } = {},
): { ok: AgendaValida } | { fallo: string } {
  const ahora = opciones.ahora ?? Date.now();
  if (!crudo.fecha) return { fallo: "Elegí el día." };
  if (!crudo.hora) return { fallo: "Elegí la hora." };
  const startsAt = madridAIso(crudo.fecha.trim(), crudo.hora.trim());
  if (!startsAt) return { fallo: "La fecha o la hora no son válidas." };
  const duracion = Number(crudo.duracion || DURACION_POR_DEFECTO);
  if (!Number.isInteger(duracion) || duracion < 15 || duracion > 240) return { fallo: "La duración tiene que ser entre 15 minutos y 4 horas." };
  if (!opciones.permitirPasado && Date.parse(startsAt) + duracion * 60000 <= ahora) {
    return { fallo: "Esa fecha ya pasó. Elegí un día y una hora que todavía no hayan llegado." };
  }
  let enlace: string | null = null;
  const textoEnlace = (crudo.enlace ?? "").trim();
  if (textoEnlace) {
    const v = validarEnlace(textoEnlace);
    if ("fallo" in v) return { fallo: v.fallo };
    enlace = v.url;
  }
  const nota = (crudo.nota ?? "").trim();
  if (nota.length > 1000) return { fallo: "La nota es muy larga (máximo 1000 caracteres)." };
  return { ok: { startsAt, duracion, enlace, proveedor: enlace ? detectarProveedor(enlace) : null, nota: nota || null } };
}

// ─── Mensajes al chat ───────────────────────────────────────────────────────

export function mensajeAgendada(iso: string, conEnlace: boolean) {
  return `Te agendé una sesión privada el ${fechaHoraLarga(iso)} 💗` +
    (conEnlace ? " El enlace ya está en Sesiones privadas." : " Te paso el enlace antes de empezar.");
}

export function mensajeCambio(iso: string, cambioFecha: boolean, enlaceNuevo: boolean) {
  if (cambioFecha) return `Te cambié la sesión privada: ahora es el ${fechaHoraLarga(iso)} 💗`;
  if (enlaceNuevo) return `Ya está el enlace de tu sesión privada del ${fechaHoraLarga(iso)}. Lo encontrás en Sesiones privadas 💗`;
  return null;
}

export function mensajeCancelada(iso: string) {
  return `Tuve que cancelar la sesión privada del ${fechaHoraLarga(iso)}. Escribime y buscamos otro día 💗`;
}
