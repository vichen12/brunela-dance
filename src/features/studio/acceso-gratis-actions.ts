"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/src/features/auth/guards";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";
import { esFaltaDeMigracion } from "@/src/features/studio/acceso-gratis-reglas";

/**
 * "Ya vi el aviso de fin de prueba". La alumna lo cierra y no vuelve a salir.
 *
 * Con SU cliente, no con service_role: es la unica columna del acceso gratis
 * que ella puede escribir. El trigger protect_profile_admin_fields (migracion
 * 20261009) revierte cualquier intento suyo de tocar las otras -- asi que,
 * aunque alguien mande otra cosa en este POST, no se regala nada.
 */
export async function marcarAvisoGratisVistoAction() {
  const { user } = await requireUser();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("profiles")
    .update({ acceso_gratis_aviso_visto_at: new Date().toISOString() })
    .eq("id", user.id);
  if (error && !esFaltaDeMigracion(error)) console.error("[acceso-gratis] aviso visto:", error.message);
  revalidatePath("/dashboard", "layout");
}
