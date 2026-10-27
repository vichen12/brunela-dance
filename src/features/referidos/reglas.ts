/**
 * Reglas PURAS del programa de referidos (sin base ni red): las usan el
 * servidor, la pantalla y las pruebas. Migracion: 20261026_4_referidos.sql.
 */

/** La cookie que guarda el codigo con el que llego, hasta que se registre. */
export const COOKIE_REFERIDO = "brunela_ref";
/** Cuanto dura la cookie: si se registra dentro de este plazo, cuenta. */
export const DIAS_COOKIE_REFERIDO = 30;
/**
 * Solo cuenta como referida una cuenta NUEVA: creada hace menos que esto al
 * anotarla. Sin esto, una alumna de hace meses podria "registrarse" con el
 * enlace de una amiga y regalarle un mes.
 */
export const HORAS_CUENTA_NUEVA = 48;

/** Un codigo valido: minusculas y numeros, 4 a 20. Igual que el CHECK de la base. */
export function codigoValido(c: string | null | undefined): c is string {
  return !!c && /^[a-z0-9]{4,20}$/.test(c);
}

/** Lo que llega por la URL o la cookie, limpio; null si no sirve. */
export function normalizarCodigo(c: string | null | undefined): string | null {
  const limpio = (c ?? "").trim().toLowerCase();
  return codigoValido(limpio) ? limpio : null;
}

/**
 * Un codigo facil de dictar: el primer nombre sin acentos (hasta 10 letras)
 * y 4 numeros. "Ana Clara" -> "ana4821". Sin nombre, "amiga" + numeros.
 */
export function codigoDesdeNombre(nombre: string | null | undefined, azar = Math.random): string {
  const base = (nombre ?? "")
    .trim()
    .split(/\s+/)[0]
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z]/g, "")
    .slice(0, 10);
  const numeros = String(Math.floor(azar() * 9000) + 1000);
  return (base.length >= 2 ? base : "amiga") + numeros;
}

/** El enlace para compartir. */
export function enlaceDeInvitacion(appUrl: string, codigo: string) {
  return `${appUrl.replace(/\/$/, "")}/?ref=${codigo}`;
}

/** ¿Se puede anotar a esta cuenta como referida de esa otra? */
export function puedeSerReferida(a: { referidaId: string; referenteId: string | null; creadaEl: string; ahora?: number }) {
  if (!a.referenteId || a.referenteId === a.referidaId) return false;
  const edad = (a.ahora ?? Date.now()) - Date.parse(a.creadaEl);
  return edad >= 0 && edad <= HORAS_CUENTA_NUEVA * 3600 * 1000;
}
