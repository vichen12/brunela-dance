import { cache } from "react";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";
import { COLUMNAS_PRIVADA, esFaltaDeTabla, type SesionPrivada } from "@/src/features/studio/sesiones-privadas-reglas";

/**
 * Las sesiones privadas de quien hace la request, para su lado del estudio:
 * el menu, la campanita, la tarjeta del inicio y /dashboard/sesiones-privadas.
 *
 * Con el cliente DE ELLA: la policy devuelve solo las suyas. El filtro por
 * alumna_id es para la ADMIN, a quien RLS le devuelve las de todas; sin el,
 * veria en "su" inicio las sesiones de otras alumnas.
 *
 * ⚠️ TIENE QUE ANDAR SIN LA MIGRACION (20261009_2_sesiones_privadas.sql). Sin
 *    la tabla, PostgREST contesta PGRST205: se devuelve `disponible: false` y
 *    del lado de la alumna simplemente no aparece nada.
 *
 * Memoizada por request: el layout y la pagina la piden en el mismo render.
 */
export const getMisSesionesPrivadas = cache(async (userId: string): Promise<{ disponible: boolean; sesiones: SesionPrivada[] }> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("sesiones_privadas")
    .select(COLUMNAS_PRIVADA)
    .eq("alumna_id", userId)
    .order("starts_at", { ascending: true })
    .limit(200);
  if (error) {
    if (!esFaltaDeTabla(error)) console.error("[sesiones privadas] alumna:", error.message);
    return { disponible: false, sesiones: [] };
  }
  return { disponible: true, sesiones: (data ?? []) as SesionPrivada[] };
});
