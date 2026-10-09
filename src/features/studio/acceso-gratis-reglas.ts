/**
 * Reglas puras del acceso gratis (sin base, sin servidor): las usan el panel,
 * el dashboard, la campanita, el cron y las pruebas.
 *
 * Migracion: supabase/migrations/20261009_acceso_gratis.sql.
 */

export type PlanPago = "corps_de_ballet" | "solista" | "principal";
export type Tier = "none" | PlanPago;

export const PLAN_LABEL: Record<Tier, string> = {
  none: "Sin plan",
  corps_de_ballet: "Corps de Ballet",
  solista: "Solista",
  principal: "Principal",
};

export const PLANES_PAGO: PlanPago[] = ["corps_de_ballet", "solista", "principal"];

/** Los estados de suscripcion que dan acceso (site_settings + la 20260801). */
export const ESTADOS_QUE_DAN_ACCESO = ["active", "trialing", "past_due"] as const;

/** El aviso que se muestra donde la funcion no puede andar todavia. */
export const AVISO_FALTA_MIGRACION =
  "Falta aplicar la migración 20261009_acceso_gratis.sql en Supabase. Hasta entonces, el acceso gratis no se puede usar.";

/** 42703 = columna inexistente: la migracion no esta aplicada. */
export function esFaltaDeMigracion(error: { code?: string } | null | undefined) {
  return error?.code === "42703";
}

export const ZONA = "Europe/Madrid";

/** "15 dic" */
export function fechaCorta(iso: string) {
  return new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", timeZone: ZONA })
    .format(new Date(iso)).replace(".", "");
}

/** "15 de diciembre" */
export function fechaLarga(iso: string) {
  return new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "long", timeZone: ZONA }).format(new Date(iso));
}

/** Dia calendario en Madrid como numero comparable (AAAAMMDD -> dias). */
function diaMadrid(ms: number) {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: ZONA, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(ms));
  return Math.round(Date.parse(p + "T00:00:00Z") / 86400000);
}

/**
 * Dias CALENDARIO que faltan, en hora de Madrid: 0 = vence hoy, 1 = mañana.
 * Negativo = ya vencio. Por calendario y no por horas: "te queda 1 dia" a las
 * 23:50 de la vispera tiene que decir "mañana", no "hoy".
 */
export function diasRestantes(hastaIso: string, ahora = Date.now()) {
  return diaMadrid(Date.parse(hastaIso)) - diaMadrid(ahora);
}

export function estaVencido(hastaIso: string | null | undefined, ahora = Date.now()) {
  return !!hastaIso && Date.parse(hastaIso) <= ahora;
}

/** Suma meses de calendario (31 ene + 1 mes = 28/29 feb, no 3 mar). */
export function sumarMeses(base: Date, meses: number) {
  const d = new Date(base.getTime());
  const dia = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + meses);
  const ultimo = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(dia, ultimo));
  return d;
}

export function sumarDias(base: Date, dias: number) {
  return new Date(base.getTime() + dias * 86400000);
}

/**
 * Nueva fecha de fin. Si todavia le queda acceso, se EXTIENDE desde esa fecha
 * (dar 1 mes mas a quien le quedan 10 dias = 10 dias + 1 mes). Si no tiene o
 * ya vencio, corre desde ahora.
 */
export function nuevoVencimiento(hastaActual: string | null, unidad: "meses" | "dias", cantidad: number, ahora = new Date()) {
  const base = hastaActual && Date.parse(hastaActual) > ahora.getTime() ? new Date(hastaActual) : ahora;
  return unidad === "meses" ? sumarMeses(base, cantidad) : sumarDias(base, cantidad);
}

/** 0..100: cuanto del periodo regalado ya paso. */
export function progreso(desdeIso: string | null, hastaIso: string, ahora = Date.now()) {
  const fin = Date.parse(hastaIso);
  const ini = desdeIso ? Date.parse(desdeIso) : fin - 30 * 86400000;
  if (fin <= ini) return 100;
  return Math.max(0, Math.min(100, Math.round(((ahora - ini) / (fin - ini)) * 100)));
}

/** "te quedan 12 días" / "termina mañana" / "termina hoy" */
export function textoRestante(hastaIso: string, ahora = Date.now()) {
  const d = diasRestantes(hastaIso, ahora);
  if (d <= 0) return "termina hoy";
  if (d === 1) return "termina mañana";
  return `te quedan ${d} días`;
}

/** Contraseña provisoria legible: sin 0/O ni 1/l/I, que se confunden al dictarla. */
export function generarContrasena(aleatorio: (n: number) => number) {
  const letras = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 10; i++) s += letras[aleatorio(letras.length)];
  return `Bru-${s}`;
}
