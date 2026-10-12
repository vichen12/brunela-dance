"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/src/features/auth/guards";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";
import {
  desactivadosDesdeInterruptores, dioDeBajaClasesNuevas, esColumnaAusente, INTERRUPTORES_DE_CORREO, MIGRACION_CLASE_NUEVA,
} from "@/src/features/correos/reglas";

/**
 * "Mis correos" de Mi perfil: que avisos opcionales quiere recibir.
 *
 * Con el cliente DE ELLA (no service_role) y solo sobre su fila: la policy
 * profiles_update_self_or_admin la deja tocar unicamente su perfil, y el
 * trigger protect_profile_admin_fields revierte plan, rol, correo y acceso
 * gratis aunque los mandara. Esta accion ademas escribe SOLO estas columnas:
 *
 *   · correos_desactivados  -> recordatorio, invitacion, acceso gratis
 *   · marketing_opt_in / marketing_opt_out_at -> clases nuevas, las MISMAS
 *     columnas que escribe el enlace de baja (/baja). Una sola verdad.
 *
 * Clases nuevas solo se toca si CAMBIA: guardar otro interruptor no puede
 * fabricar un consentimiento ni mover la fecha de una baja.
 */
export async function guardarMisCorreosAction(fd: FormData) {
  const { user } = await requireUser();
  const volver = "/dashboard/perfil";
  const encendidos = new Set(INTERRUPTORES_DE_CORREO.map((i) => i.campo).filter((c) => fd.get(c) === "si"));

  const supabase = await createSupabaseServerClient();
  const { data: actual, error: errLeer } = await supabase
    .from("profiles")
    .select("marketing_opt_in, marketing_opt_out_at")
    .eq("id", user.id)
    .maybeSingle<{ marketing_opt_in: boolean | null; marketing_opt_out_at: string | null }>();
  if (errLeer || !actual) {
    redirect(`${volver}?error=${encodeURIComponent("No se pudieron leer tus preferencias. Probá de nuevo.")}#correos` as never);
  }

  const marketing: { marketing_opt_in?: boolean; marketing_opt_out_at?: string } = {};
  const recibia = !dioDeBajaClasesNuevas(actual);
  const quiere = encendidos.has("clase_nueva");
  if (recibia && !quiere) {
    marketing.marketing_opt_in = false;
    marketing.marketing_opt_out_at = new Date().toISOString();
  } else if (!recibia && quiere) {
    // La fecha de aceptacion la sella el trigger stamp_marketing_consent.
    marketing.marketing_opt_in = true;
  }

  const { error } = await supabase
    .from("profiles")
    .update({ ...marketing, correos_desactivados: desactivadosDesdeInterruptores(encendidos) })
    .eq("id", user.id);

  if (error && esColumnaAusente(error)) {
    // Sin 20261012_clase_nueva.sql: lo de clases nuevas se puede guardar igual.
    if (Object.keys(marketing).length > 0) {
      const { error: e2 } = await supabase.from("profiles").update(marketing).eq("id", user.id);
      if (e2) redirect(`${volver}?error=${encodeURIComponent(e2.message)}#correos` as never);
    }
    console.warn(`[correo] falta la migracion ${MIGRACION_CLASE_NUEVA}: no se guardo correos_desactivados.`);
    redirect(
      `${volver}?error=${encodeURIComponent("Se guardó lo de clases nuevas, pero los demás avisos todavía no se pueden apagar. Avisale a Brunela.")}#correos` as never
    );
  }
  if (error) redirect(`${volver}?error=${encodeURIComponent(error.message)}#correos` as never);

  revalidatePath(volver);
  redirect(`${volver}?success=${encodeURIComponent("Listo, tus preferencias de correo quedaron guardadas.")}#correos` as never);
}
