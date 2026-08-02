import { cache } from "react";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";

export type FilaProgreso = {
  video_id: string;
  program_id: string | null;
  last_position_seconds: number;
  max_position_seconds: number;
  completion_percent: number;
  is_completed: boolean;
  updated_at: string;
  videos: {
    slug: string;
    title_i18n: Record<string, string>;
    duration_seconds: number;
    thumbnail_url: string | null;
    category_slugs: string[] | null;
  } | null;
};

/**
 * Todo el progreso de la alumna, UNA sola consulta por request.
 *
 * POR QUE EXISTE
 *   El dashboard pedia `user_progress` dos veces (la clase para retomar y la
 *   lista completa para las metricas) y el layout una tercera para el boton
 *   "Seguir viendo": tres viajes a Supabase por la misma tabla. Con ~245 ms de
 *   ida y vuelta medidos, eran ~500 ms tirados en cada carga del Inicio.
 *
 *   Traer las filas con el video embebido cuesta lo mismo que traer solo los
 *   ids -- lo que se paga es el viaje, no el tamaño -- asi que conviene pedir
 *   todo junto una vez y derivar el resto en memoria.
 */
export const getProgresoDelUsuario = cache(async (userId: string): Promise<FilaProgreso[]> => {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("user_progress")
    .select(
      "video_id, program_id, last_position_seconds, max_position_seconds, completion_percent, is_completed, updated_at, videos(slug, title_i18n, duration_seconds, thumbnail_url, category_slugs)"
    )
    .eq("user_id", userId)
    .gt("max_position_seconds", 0)
    .order("updated_at", { ascending: false });

  return (data ?? []) as unknown as FilaProgreso[];
});

/** La clase mas reciente que la alumna empezo, este o no terminada. */
export function ultimaVista(filas: FilaProgreso[]): FilaProgreso | null {
  return filas[0] ?? null;
}

/** La mas reciente EMPEZADA Y SIN TERMINAR, para "Seguir viendo". */
export function paraRetomar(filas: FilaProgreso[]): FilaProgreso | null {
  return filas.find((f) => !f.is_completed && f.last_position_seconds > 0) ?? null;
}
