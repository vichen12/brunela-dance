import { cache } from "react";
import { createSupabaseAdminClient } from "@/src/lib/supabase/admin";
import { normalizarPlanes, type PlanPago } from "@/src/features/studio/planes-de-sesion";

/**
 * Que planes traen sesiones privadas (pedido 2026-11-09: "solo Principal pero
 * que se pueda configurar"). Se guarda en site_settings; sin la fila, Principal.
 *
 * Decide la lista de "Agendar" del panel, el menu de la alumna y el texto de su
 * pagina. NO es un permiso de la base: Brunela puede agendarle a cualquiera
 * desde su ficha, y eso sigue igual.
 */
export const CLAVE_PLANES_PRIVADAS = "sesiones_privadas.planes";
export const PLANES_PRIVADAS_POR_DEFECTO: PlanPago[] = ["principal"];

/** Memoizada por request: el layout y la pagina la piden en el mismo render. Nunca lanza. */
export const getPlanesConPrivadas = cache(async (): Promise<PlanPago[]> => {
  try {
    const { data } = await createSupabaseAdminClient()
      .from("site_settings")
      .select("value")
      .eq("setting_key", CLAVE_PLANES_PRIVADAS)
      .maybeSingle<{ value: { planes?: unknown } | null }>();
    const planes = normalizarPlanes(data?.value?.planes);
    return planes.length ? planes : PLANES_PRIVADAS_POR_DEFECTO;
  } catch {
    return PLANES_PRIVADAS_POR_DEFECTO;
  }
});
