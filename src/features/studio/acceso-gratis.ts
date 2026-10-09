import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";
import { createSupabaseAdminClient } from "@/src/lib/supabase/admin";
import { ESTADOS_QUE_DAN_ACCESO, esFaltaDeMigracion, estaVencido, type PlanPago } from "@/src/features/studio/acceso-gratis-reglas";

/**
 * Acceso gratis por tiempo: lectura y baja al vencer.
 *
 * ⚠️ TODO ESTO TIENE QUE ANDAR SIN LA MIGRACION.
 *    El codigo se despliega antes de que la duena corra
 *    20261009_acceso_gratis.sql. Leer una columna que no existe da 42703 y, si
 *    no se tolera, tira la pagina entera. Por eso las columnas se leen en una
 *    consulta APARTE (nunca dentro de getCurrentProfile ni de la lista de
 *    alumnas) y un 42703 devuelve `disponible: false`: la funcion se oculta.
 */

export type AccesoGratis = {
  /** false = falta la migracion (o no se pudo leer): no mostrar nada. */
  disponible: boolean;
  hasta: string | null;
  desde: string | null;
  plan: PlanPago | null;
  avisoVistoAt: string | null;
};

const NADA: AccesoGratis = { disponible: false, hasta: null, desde: null, plan: null, avisoVistoAt: null };

type Fila = {
  acceso_gratis_hasta: string | null;
  acceso_gratis_desde: string | null;
  acceso_gratis_plan: PlanPago | null;
  acceso_gratis_aviso_visto_at: string | null;
};

/** El acceso gratis de quien hace la request. Con SU cliente: es su fila. */
export const getAccesoGratis = cache(async (userId: string): Promise<AccesoGratis> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("acceso_gratis_hasta, acceso_gratis_desde, acceso_gratis_plan, acceso_gratis_aviso_visto_at")
    .eq("id", userId)
    .maybeSingle<Fila>();
  if (error || !data) {
    if (error && !esFaltaDeMigracion(error)) console.error("[acceso-gratis] no se pudo leer:", error.message);
    return NADA;
  }
  return {
    disponible: true,
    hasta: data.acceso_gratis_hasta,
    desde: data.acceso_gratis_desde,
    plan: data.acceso_gratis_plan,
    avisoVistoAt: data.acceso_gratis_aviso_visto_at,
  };
});

/** Usuarias (de la lista) con una suscripcion que da acceso. service_role. */
export async function conSuscripcionQueDaAcceso(db: SupabaseClient, ids: string[]): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const { data, error } = await db
    .from("subscriptions")
    .select("user_id")
    .in("user_id", ids)
    .in("status", [...ESTADOS_QUE_DAN_ACCESO]);
  // Ante la duda NO se da de baja: si no se pudo leer, se asume que paga.
  if (error) throw new Error("No se pudieron leer las suscripciones: " + error.message);
  return new Set((data ?? []).map((r) => r.user_id as string));
}

/**
 * Baja en el momento, para UNA alumna, desde el layout del dashboard.
 *
 * Es el respaldo del cron: sin esto, una alumna cuyo regalo vencio a las 8:00
 * seguiria viendo todo hasta las 7:00 del dia siguiente.
 *
 * ⚠️ service_role, pero acotado a `userId`, que sale de requireUser() (la
 *    sesion), nunca de la URL ni de un formulario. Y la propia consulta repite
 *    las condiciones (vencido, no admin, con plan): si algo cambio entre la
 *    lectura y la escritura, no pisa nada.
 *
 * Devuelve true si aplico la baja.
 */
export async function aplicarBajaSiVencio(userId: string, tier: string, esAdmin: boolean, acceso: AccesoGratis) {
  if (esAdmin || tier === "none" || !acceso.disponible || !estaVencido(acceso.hasta)) return false;
  try {
    const db = createSupabaseAdminClient();
    const pagan = await conSuscripcionQueDaAcceso(db, [userId]);
    if (pagan.has(userId)) return false;
    const { data, error } = await db
      .from("profiles")
      .update({ membership_tier: "none" })
      .eq("id", userId)
      .eq("is_admin", false)
      .neq("membership_tier", "none")
      .lt("acceso_gratis_hasta", new Date().toISOString())
      .select("id");
    if (error) {
      if (!esFaltaDeMigracion(error)) console.error("[acceso-gratis] baja fallida:", error.message);
      return false;
    }
    return (data ?? []).length > 0;
  } catch (e) {
    console.error("[acceso-gratis] baja fallida:", (e as Error).message);
    return false;
  }
}

/**
 * Baja de TODAS las vencidas. La llama el cron diario.
 *
 * NO borra acceso_gratis_hasta: es lo que hace aparecer el aviso "tu prueba
 * gratis termino" la proxima vez que entra.
 */
export async function aplicarBajasVencidas(db: SupabaseClient): Promise<{ bajas: number; omitido?: string }> {
  const ahora = new Date().toISOString();
  const { data, error } = await db
    .from("profiles")
    .select("id")
    .lt("acceso_gratis_hasta", ahora)
    .neq("membership_tier", "none")
    .eq("is_admin", false)
    .limit(1000);
  if (error) {
    if (esFaltaDeMigracion(error)) return { bajas: 0, omitido: "falta la migracion 20261009_acceso_gratis.sql" };
    throw new Error(error.message);
  }
  const candidatas = (data ?? []).map((r) => r.id as string);
  if (candidatas.length === 0) return { bajas: 0 };

  const pagan = await conSuscripcionQueDaAcceso(db, candidatas);
  const ids = candidatas.filter((id) => !pagan.has(id));
  if (ids.length === 0) return { bajas: 0 };

  const { data: hechas, error: e2 } = await db
    .from("profiles")
    .update({ membership_tier: "none" })
    .in("id", ids)
    .eq("is_admin", false)
    .lt("acceso_gratis_hasta", ahora)
    .select("id");
  if (e2) throw new Error(e2.message);
  return { bajas: (hechas ?? []).length };
}
