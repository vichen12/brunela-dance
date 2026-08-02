import { cache } from "react";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";

export type MembershipTier = "none" | "corps_de_ballet" | "solista" | "principal";

export type CurrentProfile = {
  id: string;
  email: string;
  full_name: string | null;
  membership_tier: MembershipTier;
  is_admin: boolean;
  preferred_locale: string | null;
  technical_level: string | null;
  onboarding_completed: boolean | null;
};

/**
 * El perfil de quien hace la request, UNA sola consulta por request.
 *
 * POR QUE EXISTE
 *   Cada pantalla resolvia su propio perfil, y ademas el layout resolvia el
 *   suyo, asi que la misma fila se pedia 2 a 4 veces por render. Medido el
 *   2026-07-30: cada viaje a Supabase cuesta ~245 ms desde el entorno de
 *   desarrollo, sin importar lo que traiga -- una fila de una columna tarda lo
 *   mismo que el catalogo entero. Repetir la consulta de `profiles` era, sola,
 *   hasta un segundo por pantalla en /admin.
 *
 *   `cache()` de React memoiza por request: la primera llamada consulta y las
 *   siguientes devuelven el mismo resultado sin volver a la red. Solo funciona
 *   si TODAS las pantallas llaman a esta funcion; una consulta suelta a
 *   `profiles` vuelve a costar el viaje completo.
 *
 * Trae todas las columnas que alguna pantalla necesita, porque pedir tres
 * columnas o nueve cuesta exactamente lo mismo: un viaje.
 */
export const getCurrentProfile = cache(async (userId: string): Promise<CurrentProfile | null> => {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, email, full_name, membership_tier, is_admin, preferred_locale, technical_level, onboarding_completed")
    .eq("id", userId)
    .maybeSingle<CurrentProfile>();

  return data;
});
