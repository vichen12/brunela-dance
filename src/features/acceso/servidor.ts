import { cache } from "react";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";
import { getCurrentProfile } from "@/src/features/auth/profile";
import { aplicarBajaSiVencio, getAccesoGratis } from "@/src/features/studio/acceso-gratis";
import { tieneAccesoAlEstudio, type Tier } from "@/src/features/acceso/reglas";

/**
 * ¿Compro algun pack? Con el cliente de la alumna: la policy
 * pack_purchases_select_own solo le devuelve las suyas.
 */
export const tienePackComprado = cache(async (userId: string): Promise<boolean> => {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("pack_purchases").select("id").eq("user_id", userId).limit(1);
  return (data ?? []).length > 0;
});

export type AccesoAlEstudio = {
  esAdmin: boolean;
  onboardingCompleto: boolean;
  tier: Tier;
  tienePack: boolean;
  gratisHasta: string | null;
  gratisPlan: string | null;
  tieneAcceso: boolean;
  nombre: string | null;
};

/**
 * Los datos de acceso de quien hace la request, armados IGUAL que en el layout
 * del estudio: perfil memoizado, baja del acceso gratis vencido aplicada antes
 * de mirar el plan, y la consulta de packs. Si esto y el layout leyeran
 * distinto, /registro/plan y /dashboard se mandarian la alumna uno al otro.
 *
 * El layout no llama a esta funcion entera porque ya tiene el perfil y el
 * acceso gratis en su propio Promise.all; usa las mismas piezas en el mismo
 * orden (ver app/dashboard/layout.tsx).
 */
export async function leerAccesoAlEstudio(userId: string): Promise<AccesoAlEstudio | null> {
  const [profile, acceso] = await Promise.all([getCurrentProfile(userId), getAccesoGratis(userId)]);
  if (!profile) return null;

  if (await aplicarBajaSiVencio(userId, profile.membership_tier, profile.is_admin, acceso)) {
    profile.membership_tier = "none";
  }

  // El pack solo se consulta si hace falta: a quien tiene plan no le cambia nada.
  const tienePack = !profile.is_admin && profile.membership_tier === "none" ? await tienePackComprado(userId) : false;
  const gratisHasta = acceso.disponible ? acceso.hasta : null;

  return {
    esAdmin: profile.is_admin,
    onboardingCompleto: !!profile.onboarding_completed,
    tier: profile.membership_tier,
    tienePack,
    gratisHasta,
    gratisPlan: acceso.disponible ? acceso.plan : null,
    tieneAcceso: tieneAccesoAlEstudio({ esAdmin: profile.is_admin, tier: profile.membership_tier, tienePack, gratisHasta }),
    nombre: profile.full_name?.trim().split(/\s+/)[0] || null,
  };
}
