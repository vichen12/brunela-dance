/**
 * "hoy a las 19:00", "mañana a las 19:00", "el sábado 11 a las 19:00".
 *
 * Para los recordatorios de clases en vivo (campanita de la alumna, panel de la
 * admin). Todo en la zona DE LA SESION, que es la del estudio: "hoy" y
 * "mañana" se cuentan en esa zona, no en la del servidor (UTC en Vercel). Una
 * clase a las 00:30 de Madrid es "mañana" aunque en UTC todavia sea hoy.
 *
 * Modulo puro: lo usan el servidor y el cliente.
 */

const ZONA_POR_DEFECTO = "Europe/Madrid";

function zonaValida(zona: string | null | undefined) {
  const z = zona || ZONA_POR_DEFECTO;
  try {
    new Intl.DateTimeFormat("es-ES", { timeZone: z });
    return z;
  } catch {
    return ZONA_POR_DEFECTO;
  }
}

/** "2026-10-10" en la zona dada. */
function claveDia(ms: number, zona: string) {
  return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: zona }).format(new Date(ms));
}

export type CuandoClase = {
  /** "hoy", "mañana", "el sábado 11". */
  dia: string;
  /** "19:00" */
  hora: string;
  esHoy: boolean;
  esManana: boolean;
};

export function cuandoClase(iso: string, zona: string | null | undefined, ahora = Date.now()): CuandoClase {
  const z = zonaValida(zona);
  const ms = new Date(iso).getTime();
  const hora = new Intl.DateTimeFormat("es-ES", { hour: "2-digit", minute: "2-digit", timeZone: z }).format(new Date(ms));
  const k = claveDia(ms, z);
  const hoy = claveDia(ahora, z);
  // Mañana = la FECHA de hoy + 1, calculada al mediodia UTC: sumarle 24 h a
  // "ahora" falla la noche del cambio de hora (verano/invierno).
  const manana = claveDia(new Date(hoy + "T12:00:00Z").getTime() + 86400000, "UTC");
  if (k === hoy) return { dia: "hoy", hora, esHoy: true, esManana: false };
  if (k === manana) return { dia: "mañana", hora, esHoy: false, esManana: true };
  const semana = new Intl.DateTimeFormat("es-ES", { weekday: "long", day: "numeric", timeZone: z }).format(new Date(ms));
  return { dia: "el " + semana.replace(",", ""), hora, esHoy: false, esManana: false };
}

/** "hoy a las 19:00" */
export function cuandoClaseTexto(iso: string, zona: string | null | undefined, ahora = Date.now()) {
  const c = cuandoClase(iso, zona, ahora);
  return `${c.dia} a las ${c.hora}`;
}
