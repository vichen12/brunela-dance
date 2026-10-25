/**
 * Los dias de un plan de trabajo: clase o descanso. Reglas puras, sin base.
 *
 * Las usan el panel (/admin/programs) y la ficha de la alumna
 * (/dashboard/programs/[slug]), y las prueba tests/sistema/dias-de-plan.test.ts.
 *
 * DIA DE DESCANSO (migracion 20261025_dia_de_descanso.sql)
 *   Un dia es o una clase (video_id) o un descanso (es_descanso + nota). Nunca
 *   las dos cosas: lo impone un CHECK en la base.
 *
 * COMO CUENTA UN DESCANSO EN EL AVANCE
 *   El progreso vive en `user_progress`, que va por CLASE (video_id NOT NULL).
 *   Un descanso no tiene clase, asi que no tiene fila de progreso y no se puede
 *   "marcar" sin inventar una tabla nueva. La regla, sin escribir nada:
 *
 *     Un descanso esta HECHO cuando la alumna ya avanzo a un dia posterior
 *     (tiene progreso, aunque sea empezado, en algun dia de numero mayor), o
 *     cuando ya termino todas las clases del plan.
 *
 *   Asi el descanso SI aparece como "lo de hoy" al terminar el dia anterior
 *   (no se saltea solo), y se da por hecho en cuanto ella abre el dia
 *   siguiente. Cuenta en el total de dias como cualquier otro.
 */

export const NOTA_DESCANSO_MAX = 300;

/** Lo que lee la alumna si Brunela deja la nota vacia. Texto de Brunela, exacto. */
export const NOTA_DESCANSO_POR_DEFECTO =
  "Hoy también estás avanzando, aunque no entrenes. Dale a tu cuerpo el tiempo que necesita para recuperarse y volver con más energía. ¡Descansa, te lo mereces! 💗";

export const AVISO_FALTA_MIGRACION_DESCANSO =
  "Para poder cargar días de descanso falta correr la migración 20261025_dia_de_descanso.sql en Supabase.";

/** El select falla con 42703 si la migracion no corrio: se reintenta sin las columnas nuevas. */
export function esFaltaDeColumnaDescanso(error: { code?: string; message?: string } | null | undefined) {
  if (!error) return false;
  if (error.code === "42703") return true;
  return /es_descanso|nota/.test(error.message ?? "") && /does not exist|could not find/i.test(error.message ?? "");
}

// ── Busqueda ────────────────────────────────────────────────────────────────

/** Minusculas y sin tildes: "Relevé" y "releve" son lo mismo para buscar. */
export function normalizarBusqueda(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Las opciones cuyo texto contiene TODAS las palabras buscadas, en cualquier
 * orden. "pies barra" encuentra "Barra de pies". Vacio = todas.
 */
export function filtrarOpciones<T extends { label: string }>(opciones: T[], consulta: string): T[] {
  const palabras = normalizarBusqueda(consulta).split(" ").filter(Boolean);
  if (palabras.length === 0) return opciones;
  return opciones.filter((o) => {
    const t = normalizarBusqueda(o.label);
    return palabras.every((p) => t.includes(p));
  });
}

// ── Dias y avance ───────────────────────────────────────────────────────────

export type DiaBase = { day_number: number; es_descanso?: boolean | null };
export type ProgresoDia = { is_completed: boolean; completion_percent?: number | null };

/**
 * Para cada dia, si esta hecho; y cual es "hoy" (el primero sin hacer).
 * `progreso` va por numero de dia, como lo guarda user_progress.
 */
export function avanceDelPlan<D extends DiaBase>(dias: D[], progreso: Map<number, ProgresoDia>) {
  const ordenados = [...dias].sort((a, b) => a.day_number - b.day_number);
  const clases = ordenados.filter((d) => !d.es_descanso);
  const todasLasClasesHechas = clases.every((d) => progreso.get(d.day_number)?.is_completed);
  const masAltoConProgreso = Math.max(0, ...[...progreso.keys()]);

  const hecho = new Map<number, boolean>();
  for (const d of ordenados) {
    hecho.set(
      d.day_number,
      d.es_descanso
        ? todasLasClasesHechas || masAltoConProgreso > d.day_number
        : Boolean(progreso.get(d.day_number)?.is_completed)
    );
  }

  const completos = ordenados.filter((d) => hecho.get(d.day_number)).length;
  const hoy = ordenados.find((d) => !hecho.get(d.day_number)) ?? null;
  /** La proxima CLASE despues de hoy: lo que se ofrece en la tarjeta de un descanso. */
  const siguienteClase = hoy ? ordenados.find((d) => d.day_number > hoy.day_number && !d.es_descanso) ?? null : null;

  return {
    hecho,
    completos,
    total: ordenados.length,
    hoy,
    siguienteClase,
    terminado: ordenados.length > 0 && completos === ordenados.length,
  };
}

/**
 * Los numeros de dia que no tienen nada cargado, de 1 hasta el mayor entre la
 * duracion del plan y el ultimo dia cargado. Un descanso NO es un hueco.
 */
export function diasSinCargar(cargados: Iterable<number>, duracion: number): number[] {
  const set = new Set(cargados);
  const hasta = Math.max(duracion, ...set, 0);
  const faltan: number[] = [];
  for (let n = 1; n <= hasta; n++) if (!set.has(n)) faltan.push(n);
  return faltan;
}
