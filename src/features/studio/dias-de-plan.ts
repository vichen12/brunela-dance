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

// ── Editor de plan (pantalla completa, /admin/programs/[id]) ─────────────────
//
// El editor guarda TODO de una vez (datos del plan + dias). Mientras tanto la
// lista de dias vive en el navegador como un arreglo de casilleros 1..N:
// el casillero i es el dia i+1. Mover, vaciar o borrar un dia es reordenar el
// arreglo, sin tocar la base hasta "Guardar".

export type CasilleroDia =
  | { tipo: "vacio" }
  | { tipo: "clase"; videoId: string }
  | { tipo: "descanso"; nota: string };

export const MAX_DIAS_PLAN = 365;

/** Cambia la cantidad de casilleros: agrega vacios al final, o recorta el final. */
export function ajustarCantidad(dias: CasilleroDia[], n: number): CasilleroDia[] {
  const total = Math.max(1, Math.min(MAX_DIAS_PLAN, Math.floor(n) || 1));
  if (total <= dias.length) return dias.slice(0, total);
  return [...dias, ...Array.from({ length: total - dias.length }, () => ({ tipo: "vacio" as const }))];
}

/** Cuantos casilleros con contenido se perderian al recortar a `n`. */
export function seQuitanConContenido(dias: CasilleroDia[], n: number): number {
  return dias.slice(Math.max(0, n)).filter((d) => d.tipo !== "vacio").length;
}

/** Intercambia el dia i con el de al lado (delta -1 = sube, +1 = baja). */
export function moverDia(dias: CasilleroDia[], i: number, delta: -1 | 1): CasilleroDia[] {
  const j = i + delta;
  if (i < 0 || i >= dias.length || j < 0 || j >= dias.length) return dias;
  const copia = [...dias];
  [copia[i], copia[j]] = [copia[j], copia[i]];
  return copia;
}

/** Lleva el dia i al numero `numero` (1..N), corriendo los del medio. */
export function llevarDiaA(dias: CasilleroDia[], i: number, numero: number): CasilleroDia[] {
  const destino = Math.max(1, Math.min(dias.length, Math.floor(numero) || 1)) - 1;
  if (i < 0 || i >= dias.length || destino === i) return dias;
  const copia = [...dias];
  const [movido] = copia.splice(i, 1);
  copia.splice(destino, 0, movido);
  return copia;
}

/** Saca el dia i y corre los siguientes un lugar para arriba (el plan dura uno menos). */
export function borrarDiaYCorrer(dias: CasilleroDia[], i: number): CasilleroDia[] {
  if (dias.length <= 1 || i < 0 || i >= dias.length) return dias;
  return dias.filter((_, k) => k !== i);
}

/** Las filas de program_days que salen de los casilleros. Los vacios no se guardan. */
export function filasParaGuardar(dias: CasilleroDia[]) {
  return dias.flatMap((d, i) => {
    const day_number = i + 1;
    if (d.tipo === "clase") return [{ day_number, video_id: d.videoId, es_descanso: false, nota: null as string | null }];
    if (d.tipo === "descanso") {
      const nota = d.nota.trim();
      return [{
        day_number, video_id: null as string | null, es_descanso: true,
        // El texto por defecto no se guarda: null = el vigente de la pantalla.
        nota: nota && nota !== NOTA_DESCANSO_POR_DEFECTO ? nota.slice(0, NOTA_DESCANSO_MAX) : null,
      }];
    }
    return [];
  });
}

/** Casilleros a partir de lo que hay en la base. Un numero sin fila es un vacio. */
export function casillerosDesdeDias(
  dias: { day_number: number; video_id: string | null; es_descanso?: boolean | null; nota?: string | null }[],
  duracion: number
): CasilleroDia[] {
  const hasta = Math.max(duracion, ...dias.map((d) => d.day_number), 1);
  const porNumero = new Map(dias.map((d) => [d.day_number, d]));
  return Array.from({ length: Math.min(hasta, MAX_DIAS_PLAN) }, (_, i): CasilleroDia => {
    const d = porNumero.get(i + 1);
    if (!d) return { tipo: "vacio" };
    if (d.es_descanso || !d.video_id) return { tipo: "descanso", nota: d.nota?.trim() || NOTA_DESCANSO_POR_DEFECTO };
    return { tipo: "clase", videoId: d.video_id };
  });
}

/**
 * Lee el JSON de dias que manda el editor. Lo que no tenga forma de casillero
 * se rechaza entero: mejor un error claro que guardar medio plan.
 */
export function leerCasilleros(crudo: unknown): CasilleroDia[] | null {
  let datos: unknown = crudo;
  if (typeof crudo === "string") {
    try { datos = JSON.parse(crudo); } catch { return null; }
  }
  if (!Array.isArray(datos) || datos.length === 0 || datos.length > MAX_DIAS_PLAN) return null;
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const salida: CasilleroDia[] = [];
  for (const d of datos) {
    if (!d || typeof d !== "object") return null;
    const x = d as Record<string, unknown>;
    if (x.tipo === "vacio") salida.push({ tipo: "vacio" });
    else if (x.tipo === "clase" && typeof x.videoId === "string" && UUID.test(x.videoId)) salida.push({ tipo: "clase", videoId: x.videoId });
    else if (x.tipo === "descanso" && (x.nota === undefined || typeof x.nota === "string")) {
      salida.push({ tipo: "descanso", nota: String(x.nota ?? "").slice(0, NOTA_DESCANSO_MAX) });
    } else return null;
  }
  return salida;
}
