"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/src/features/auth/guards";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";

/**
 * Guarda el nombre de quien esta logueada.
 *
 * Con el cliente DE ELLA (no service_role): la policy
 * profiles_update_self_or_admin solo la deja tocar su fila, y el trigger
 * protect_profile_admin_fields impide que se cambie plan o rol desde aca.
 * `volver` se valida: solo puede ser una de las dos pantallas de perfil.
 */
export async function guardarMiPerfilAction(fd: FormData) {
  const { user } = await requireUser();
  const volver = fd.get("volver") === "/admin/perfil" ? "/admin/perfil" : "/dashboard/perfil";
  const nombre = String(fd.get("nombre") ?? "").trim().replace(/\s+/g, " ");

  if (nombre.length < 2) redirect(`${volver}?error=${encodeURIComponent("Escribí tu nombre (al menos 2 letras).")}` as never);
  if (nombre.length > 80) redirect(`${volver}?error=${encodeURIComponent("El nombre es demasiado largo.")}` as never);

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("profiles").update({ full_name: nombre }).eq("id", user.id);
  if (error) redirect(`${volver}?error=${encodeURIComponent(error.message)}` as never);

  // El nombre sale en los menus de los dos layouts.
  revalidatePath("/", "layout");
  redirect(`${volver}?success=${encodeURIComponent("Listo, tu perfil quedó guardado.")}` as never);
}
