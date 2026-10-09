/**
 * Packs restringidos a planes: reglas puras (sin base, sin servidor).
 *
 * Pedido de la duena (2026-10-09): "poder crear un pack para un determinado
 * plan, pero que por defecto se pueda comprar en todos los planes".
 *
 *   packs.planes_que_pueden_comprar  (migracion 20261009_4_packs_por_plan.sql)
 *     NULL            -> lo compra cualquiera, tambien quien no tiene plan.
 *                        Es el valor por defecto y el comportamiento de siempre.
 *     {solista, ...}  -> solo quien TIENE HOY uno de esos planes.
 *
 * Lo usan el checkout (src/lib/stripe/crear-checkout.ts, que es donde se
 * IMPONE), la tienda, la portada, el registro, el panel y las pruebas
 * (tests/sistema/packs-por-plan.test.ts).
 *
 * Sin imports: lo cargan las pruebas, que no resuelven el alias "@/".
 */

export const PLANES_QUE_COMPRAN = ["corps_de_ballet", "solista", "principal"] as const;
export type PlanQueCompra = (typeof PLANES_QUE_COMPRAN)[number];

const NOMBRE: Record<PlanQueCompra, string> = {
  corps_de_ballet: "Corps de Ballet",
  solista: "Solista",
  principal: "Principal",
};

/**
 * Lo que viene de la base, limpio: null = todas. Una lista vacia tambien se
 * lee como "todas" -- el CHECK de la migracion no la deja guardar, y si alguna
 * vez apareciera, frenar la venta de un pack por un dato roto seria peor que
 * venderlo (esto decide quien PUEDE PAGAR, no quien ve contenido: el acceso a
 * las clases lo sigue decidiendo RLS con la compra).
 */
export function normalizarPlanesDeCompra(valor: unknown): PlanQueCompra[] | null {
  if (!Array.isArray(valor)) return null;
  const limpios = PLANES_QUE_COMPRAN.filter((p) => valor.includes(p));
  return limpios.length ? limpios : null;
}

/**
 * ¿Puede comprar este pack quien tiene HOY `tierActual`?
 *
 * Sin lista: si, todas (incluida quien no tiene plan). Con lista: solo si su
 * plan esta adentro; 'none', null o un valor desconocido nunca.
 */
export function puedeComprarPack(tierActual: string | null | undefined, lista: readonly string[] | null | undefined): boolean {
  const planes = normalizarPlanesDeCompra(lista);
  if (!planes) return true;
  return !!tierActual && (planes as readonly string[]).includes(tierActual);
}

/** "Solista y Principal", "Corps de Ballet, Solista y Principal". */
export function planesDeCompraEnTexto(lista: readonly string[] | null | undefined): string {
  const planes = normalizarPlanesDeCompra(lista);
  if (!planes) return "todas las alumnas";
  const n = planes.map((p) => NOMBRE[p]);
  return n.length === 1 ? n[0] : `${n.slice(0, -1).join(", ")} y ${n[n.length - 1]}`;
}

/** "Solo para alumnas de Solista y Principal", o null si es para todas. */
export function textoSoloPara(lista: readonly string[] | null | undefined): string | null {
  const planes = normalizarPlanesDeCompra(lista);
  return planes ? `Solo para alumnas de ${planesDeCompraEnTexto(planes)}` : null;
}

/** El error del checkout. Con punto final: se muestra tal cual. */
export function errorSoloPara(lista: readonly string[] | null | undefined): string {
  return `Este pack es solo para alumnas de ${planesDeCompraEnTexto(lista)}.`;
}

/**
 * Lo que manda el panel ("Quien lo puede comprar"):
 *   quienCompra = "todas"  -> null
 *   quienCompra = "planes" -> los planes tildados (planesCompra, uno por input)
 * Elegir "solo algunos planes" sin tildar ninguno es un error de formulario:
 * se devuelve el motivo en vez de adivinar.
 */
export function leerPlanesDeCompra(
  quienCompra: string | null | undefined,
  tildados: readonly unknown[],
): { ok: PlanQueCompra[] | null } | { fallo: string } {
  if (quienCompra !== "planes") return { ok: null };
  const planes = normalizarPlanesDeCompra(tildados);
  if (!planes) return { fallo: "Elegí al menos un plan, o dejá el pack para todas." };
  // ⚠️ Los tres tildados NO es lo mismo que "todas": deja afuera a quien no
  //    tiene plan. Se guarda la lista tal cual.
  return { ok: planes };
}

/** La columna no existe todavia (falta 20261009_4_packs_por_plan.sql). */
export function esFaltaDeColumnaPlanes(error: { code?: string; message?: string } | null | undefined) {
  if (!error) return false;
  if (error.code === "42703") return true;
  return /planes_que_pueden_comprar/.test(error.message ?? "") && /does not exist|could not find/i.test(error.message ?? "");
}

export const AVISO_FALTA_MIGRACION_PACKS_POR_PLAN =
  "Falta correr la migración 20261009_4_packs_por_plan.sql en Supabase. Hasta entonces, todos los packs se pueden comprar desde cualquier plan.";
