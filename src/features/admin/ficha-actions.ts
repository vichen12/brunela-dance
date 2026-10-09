"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/src/features/auth/guards";
import { createSupabaseAdminClient } from "@/src/lib/supabase/admin";
import { salaDirecta } from "@/src/features/admin/chat-directo";
import { avisoDelCorreo, enviarInvitacion } from "@/src/features/correos/disparadores";

/**
 * Acciones de la ficha de una alumna (/admin/users/[id]): escribirle sin salir
 * de la ficha e invitarla a una clase en vivo.
 *
 * requireAdmin() va PRIMERO en cada una: una server action es un endpoint POST
 * publico y estas corren con service_role, que saltea RLS (trampa 4).
 */

const UUID = z.string().uuid();
const volver = (id: string, q: string) => redirect(`/admin/users/${id}?${q}` as never);

// La sala de DM sale de chat-directo.ts (modulo sin "use server": ver ahi).

export async function enviarMensajeDesdeFichaAction(fd: FormData) {
  const { user } = await requireAdmin();
  const alumnaId = String(fd.get("alumnaId") ?? "");
  const texto = String(fd.get("mensaje") ?? "").trim();
  if (!UUID.safeParse(alumnaId).success) redirect("/admin/users" as never);
  if (!texto) volver(alumnaId, "error=" + encodeURIComponent("Escribí algo antes de enviar.") + "#mensajes");
  if (texto.length > 2000) volver(alumnaId, "error=" + encodeURIComponent("El mensaje es muy largo (máximo 2000 caracteres).") + "#mensajes");

  const db = createSupabaseAdminClient();
  const [{ data: alumna }, { data: yo }] = await Promise.all([
    db.from("profiles").select("full_name, email").eq("id", alumnaId).maybeSingle(),
    db.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
  ]);
  if (!alumna) redirect("/admin/users" as never);

  let salaId: string;
  try {
    salaId = await salaDirecta(db, user.id, alumnaId, alumna.full_name ?? alumna.email);
  } catch (e) {
    volver(alumnaId, "error=" + encodeURIComponent("No se pudo abrir la conversación: " + (e as Error).message) + "#mensajes");
    return;
  }

  const { error } = await db.from("chat_messages").insert({
    room_id: salaId,
    user_id: user.id,
    content: texto,
    author_name: yo?.full_name ?? "Brunela",
    author_is_admin: true,
  });
  if (error) volver(alumnaId, "error=" + encodeURIComponent(error.message) + "#mensajes");

  revalidatePath(`/admin/users/${alumnaId}`);
  revalidatePath("/dashboard/chat");
  revalidatePath("/admin/mensajes");
  volver(alumnaId, "success=" + encodeURIComponent("Mensaje enviado. Le aparece en Mi chat.") + "#mensajes");
}

export async function invitarDesdeFichaAction(fd: FormData) {
  const { user } = await requireAdmin();
  const alumnaId = String(fd.get("alumnaId") ?? "");
  const sesionId = String(fd.get("sesionId") ?? "");
  if (!UUID.safeParse(alumnaId).success) redirect("/admin/users" as never);
  if (!UUID.safeParse(sesionId).success) volver(alumnaId, "error=" + encodeURIComponent("Elegí una clase en vivo.") + "#vivo");

  const db = createSupabaseAdminClient();
  const { error } = await db.from("live_session_invitations").insert({ live_session_id: sesionId, user_id: alumnaId, invited_by: user.id });
  // 23505: ya estaba invitada. Es el estado que se queria, no un fallo.
  if (error && error.code !== "23505") volver(alumnaId, "error=" + encodeURIComponent(error.message) + "#vivo");

  // El correo va DESPUES de guardar y no puede deshacer nada: si falla, la
  // invitacion queda igual y el cartel lo dice. Si ya estaba invitada (23505),
  // la clave invitacion:<sesion>:<alumna> impide mandarlo otra vez.
  const correo = await enviarInvitacion(db, sesionId, alumnaId);

  revalidatePath(`/admin/users/${alumnaId}`);
  revalidatePath("/admin/live");
  revalidatePath("/dashboard/live");
  volver(alumnaId, "success=" + encodeURIComponent("Invitación enviada. La ve en su pantalla de En vivo." + avisoDelCorreo(correo)) + "#vivo");
}

export async function quitarInvitacionDesdeFichaAction(fd: FormData) {
  await requireAdmin();
  const alumnaId = String(fd.get("alumnaId") ?? "");
  const sesionId = String(fd.get("sesionId") ?? "");
  if (!UUID.safeParse(alumnaId).success || !UUID.safeParse(sesionId).success) redirect("/admin/users" as never);

  const db = createSupabaseAdminClient();
  // La reserva que ya hizo NO se toca (misma regla que en /admin/live).
  const { error } = await db.from("live_session_invitations").delete().eq("live_session_id", sesionId).eq("user_id", alumnaId);
  if (error) volver(alumnaId, "error=" + encodeURIComponent(error.message) + "#vivo");

  revalidatePath(`/admin/users/${alumnaId}`);
  revalidatePath("/dashboard/live");
  volver(alumnaId, "success=" + encodeURIComponent("Invitación quitada.") + "#vivo");
}
