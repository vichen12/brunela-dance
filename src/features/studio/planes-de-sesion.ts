import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Para que planes es una sesion en vivo (20261109_planes_de_sesiones_en_vivo.sql)
 * y que planes tienen sesiones privadas (configurable desde el panel).
 *
 * Sin la migracion la columna `planes_permitidos` no existe: todo lo de aca
 * TOLERA eso y cae al plan minimo de siempre (`membership_tier_required`).
 */

export const PLANES_PAGOS = ["corps_de_ballet", "solista", "principal"] as const;
export type PlanPago = (typeof PLANES_PAGOS)[number];

export const NOMBRE_PLAN: Record<PlanPago, string> = {
  corps_de_ballet: "Corps de Ballet",
  solista: "Solista",
  principal: "Principal",
};

const esPlan = (v: unknown): v is PlanPago => typeof v === "string" && (PLANES_PAGOS as readonly string[]).includes(v);

/** La lista limpia, sin repetidos y en el orden de los planes. */
export function normalizarPlanes(lista: unknown): PlanPago[] {
  const set = new Set(Array.isArray(lista) ? lista.filter(esPlan) : []);
  return PLANES_PAGOS.filter((p) => set.has(p));
}

/** La regla vieja: "de este plan para arriba". */
export function planesDesde(minimo: string | null | undefined): PlanPago[] {
  const i = PLANES_PAGOS.indexOf((minimo ?? "corps_de_ballet") as PlanPago);
  return PLANES_PAGOS.slice(i < 0 ? 0 : i);
}

/** El plan mas bajo de la lista: lo que se guarda en membership_tier_required. */
export function planMinimo(planes: PlanPago[]): PlanPago {
  return planes[0] ?? "corps_de_ballet";
}

/** "Todos los planes", "Solo Principal", "Corps de Ballet y Principal". */
export function planesEnTexto(planes: PlanPago[]): string {
  if (planes.length === 0 || planes.length === PLANES_PAGOS.length) return "Todos los planes";
  if (planes.length === 1) return `Solo ${NOMBRE_PLAN[planes[0]]}`;
  const nombres = planes.map((p) => NOMBRE_PLAN[p]);
  return `${nombres.slice(0, -1).join(", ")} y ${nombres[nombres.length - 1]}`;
}

/** Falta 20261109: la columna no existe. */
export function esFaltaDeColumnaPlanesSesion(error: { code?: string; message?: string } | null | undefined) {
  return !!error && (error.code === "42703" || error.code === "PGRST204" || /planes_permitidos/.test(error.message ?? ""));
}

/**
 * Los planes de cada sesion, en una consulta APARTE y tolerante: meter la
 * columna en el select principal tiraria la pantalla entera sin la migracion.
 * Sin ella devuelve un mapa vacio y quien llama usa planesDesde(minimo).
 */
export async function leerPlanesDeSesiones(db: SupabaseClient, ids: string[]): Promise<Map<string, PlanPago[]>> {
  if (ids.length === 0) return new Map();
  const { data, error } = await db.from("live_sessions").select("id, planes_permitidos").in("id", ids);
  if (error) return new Map();
  return new Map(((data ?? []) as { id: string; planes_permitidos: unknown }[]).map((f) => [f.id, normalizarPlanes(f.planes_permitidos)]));
}
