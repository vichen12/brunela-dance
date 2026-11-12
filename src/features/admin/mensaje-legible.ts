/**
 * El error de la base, en una frase que Brunela pueda leer.
 *
 * POR QUE EXISTE (2026-11-12)
 *   Las acciones del panel mandaban a la pantalla `error.message` tal cual:
 *   textos en ingles de la base como "update or delete on table videos
 *   violates foreign key constraint...". Ella no tiene por que saber que es
 *   eso, ni que hacer. El detalle crudo queda en el registro del servidor.
 */
type ErrorDeBase = { code?: string | null; message?: string | null } | null | undefined;

export function legible(error: ErrorDeBase, queSeIntentaba = "guardar los cambios"): string {
  if (error) console.error(`[panel] no se pudo ${queSeIntentaba}:`, error.code ?? "", error.message ?? error);
  switch (error?.code) {
    case "23505":
      return "Ya existe uno igual. Cambiale el nombre y probá de nuevo.";
    case "23503":
      return "No se puede borrar porque todavía se está usando en otro lado (un plan, un pack o una clase). Quitalo de ahí primero.";
    case "23514":
    case "22007":
    case "22008":
      return "Hay un dato que no es válido. Revisá las fechas, horarios y números.";
    case "23502":
      return "Falta completar un dato obligatorio.";
    default:
      return `No se pudo ${queSeIntentaba}. Probá de nuevo en un momento.`;
  }
}
