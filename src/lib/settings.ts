import { unstable_cache, revalidateTag } from "next/cache";
import { createSupabaseAdminClient } from "@/src/lib/supabase/admin";

/**
 * Lectura cacheada de `site_settings`.
 *
 * POR QUE
 *   Los ajustes cambian una vez cada varios meses, pero se leian en cada carga
 *   de /dashboard/plan, /dashboard/chat y /admin/chat. Con ~245 ms de ida y
 *   vuelta a Supabase medidos el 2026-07-30, era un cuarto de segundo por
 *   pantalla para traer siempre lo mismo.
 *
 * CUIDADO CON LA INVALIDACION
 *   Un ajuste cacheado que no se invalida es peor que uno lento: Brunela cambia
 *   algo en el panel y no lo ve reflejado. Por eso TODA escritura sobre
 *   site_settings tiene que llamar a invalidarAjustes(). Hoy hay dos:
 *     - upsertSiteSettingAction (src/features/admin/actions.ts)
 *     - el toggle de DM por plan  (app/admin/chat/page.tsx)
 *   Si mañana aparece una tercera, tiene que llamarla tambien.
 */
const TAG_AJUSTES = "site-settings";

export async function leerAjuste<T>(clave: string): Promise<T | null> {
  const cargar = unstable_cache(
    async (k: string) => {
      const supabase = createSupabaseAdminClient();
      const { data } = await supabase
        .from("site_settings")
        .select("value")
        .eq("setting_key", k)
        .maybeSingle<{ value: T }>();
      return data?.value ?? null;
    },
    ["site-setting", clave],
    { tags: [TAG_AJUSTES], revalidate: 300 }
  );

  return cargar(clave);
}

/** Llamar SIEMPRE despues de escribir en site_settings. */
export function invalidarAjustes() {
  revalidateTag(TAG_AJUSTES);
}
