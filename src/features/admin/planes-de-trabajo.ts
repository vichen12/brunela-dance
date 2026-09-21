/**
 * Planes de trabajo vistos DESDE UNA CLASE.
 *
 * QUE ES UN PLAN DE TRABAJO
 *   Una serie de dias en orden, cada uno con una clase: «Trabajo de pies, 14
 *   dias». Es la diferencia entre Corps de Ballet y Solista -- Corps ve las
 *   clases sueltas, Solista las ve organizadas. En la base son `programs` +
 *   `program_days`.
 *
 * POR QUE ESTE ARCHIVO
 *   Tanto el formulario de subida como el panel de edicion necesitan las mismas
 *   dos cosas: a que planes pertenece esta clase, y cual es el proximo dia libre
 *   de cada plan. Estaban a punto de quedar duplicadas en dos componentes de
 *   cliente, que es donde se desincronizan.
 *
 * ⚠️ Una clase puede estar en VARIOS planes y en varios dias del mismo plan.
 *    `program_days` tiene `unique (program_id, day_number)`, NO una restriccion
 *    por video: lo unico que no puede pasar es que un dia tenga dos clases.
 */

/** Una fila cruda de `program_days`, tal como sale de la consulta. */
export type DiaDePlan = {
  id: string;
  program_id: string;
  day_number: number;
  video_id: string;
};

/** Un plan ofrecible en un desplegable. */
export type PlanParaElegir = {
  id: string;
  /** Ya viene con los dias: «Trabajo de pies · 14 días». */
  titulo: string;
  /** El primer dia libre, para no hacerselo buscar a mano. */
  proximoDia: number;
};

/** Donde esta ya puesta una clase. */
export type UbicacionEnPlan = {
  /** El id de la fila de `program_days`, que es lo que hace falta para quitarla. */
  programDayId: string;
  programId: string;
  titulo: string;
  dia: number;
};

/**
 * El primer dia LIBRE de un plan.
 *
 * Por que el primer hueco y no "el ultimo mas uno": un plan de 14 dias al que
 * le falta el 7 tiene que ofrecer el 7, no el 15. Con "ultimo mas uno" ese dia
 * no se llena nunca y el plan queda con un agujero que nadie ve hasta que una
 * alumna llega ahi.
 */
export function primerDiaLibre(ocupados: Iterable<number>): number {
  const usados = new Set(ocupados);
  let dia = 1;
  while (usados.has(dia)) dia += 1;
  return dia;
}

type PlanCrudo = { id: string; title_i18n: Record<string, string> | null; duration_days: number };

/**
 * Arma, de una sola pasada, lo que necesitan las dos pantallas:
 * los planes ofrecibles y donde esta puesta cada clase.
 */
export function armarPlanesDeTrabajo(planes: PlanCrudo[], dias: DiaDePlan[]) {
  const ocupadosPorPlan = new Map<string, Set<number>>();
  for (const dia of dias) {
    if (!ocupadosPorPlan.has(dia.program_id)) ocupadosPorPlan.set(dia.program_id, new Set());
    ocupadosPorPlan.get(dia.program_id)!.add(dia.day_number);
  }

  const nombreDe = new Map<string, string>();
  const paraElegir: PlanParaElegir[] = planes.map((plan) => {
    const nombre = plan.title_i18n?.es ?? "Sin título";
    nombreDe.set(plan.id, nombre);
    return {
      id: plan.id,
      titulo: `${nombre} · ${plan.duration_days} días`,
      proximoDia: primerDiaLibre(ocupadosPorPlan.get(plan.id) ?? []),
    };
  });

  /** video_id -> donde esta puesta, ordenado por plan y despues por dia. */
  const ubicacionesPorClase = new Map<string, UbicacionEnPlan[]>();
  for (const dia of dias) {
    const titulo = nombreDe.get(dia.program_id);
    // Un dia cuyo plan no vino en la consulta (filtrada, por ejemplo) se saltea:
    // mostrar "undefined · Día 3" es peor que no mostrarlo.
    if (!titulo) continue;

    const lista = ubicacionesPorClase.get(dia.video_id) ?? [];
    lista.push({ programDayId: dia.id, programId: dia.program_id, titulo, dia: dia.day_number });
    ubicacionesPorClase.set(dia.video_id, lista);
  }
  for (const lista of ubicacionesPorClase.values()) {
    lista.sort((a, b) => a.titulo.localeCompare(b.titulo) || a.dia - b.dia);
  }

  return { paraElegir, ubicacionesPorClase };
}
