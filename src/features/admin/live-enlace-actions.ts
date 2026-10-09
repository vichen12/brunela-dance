"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/src/features/auth/guards";
import { createSupabaseAdminClient } from "@/src/lib/supabase/admin";
import { detectarProveedor, NOMBRE_PROVEEDOR, validarEnlace } from "@/src/features/studio/enlace-clase";

/**
 * El enlace de UNA clase en vivo, desde su perfil (/admin/live/[id]#enlace).
 *
 * Pedido de la duena: "que el link lo pueda poner cuando quiera". Por eso es
 * un formulario aparte y no un campo mas del cajon de edicion: se carga o se
 * cambia en cualquier momento, tambien minutos antes o durante la clase, sin
 * tocar fecha, cupo ni estado.
 *
 * QUIEN LO VE: RLS de `live_session_access_links`
 * (can_current_user_view_live_session_link): la admin y quien RESERVO. Aca
 * solo se escribe; nadie lee el enlace con service_role para una alumna.
 *
 * ⚠️ Cada una es un endpoint POST publico y usa service_role: requireAdmin()
 *    va PRIMERO (trampa 4 del CLAUDE.md).
 */

const uuid = z.string().uuid();

function volver(sessionId: string, tipo: "success" | "error", msg: string): never {
  redirect(`/admin/live/${sessionId}?${tipo}=${encodeURIComponent(msg)}#enlace` as never);
}

/** Todo lo que muestra el enlace: el perfil, el listado y las dos vistas de alumna. */
async function revalidarTodo(sessionId: string) {
  const { data } = await createSupabaseAdminClient()
    .from("live_sessions")
    .select("slug")
    .eq("id", sessionId)
    .maybeSingle<{ slug: string }>();
  revalidatePath(`/admin/live/${sessionId}`);
  revalidatePath("/admin/live", "layout");
  revalidatePath("/admin");
  revalidatePath("/dashboard/live");
  revalidatePath("/dashboard");
  if (data?.slug) revalidatePath(`/dashboard/live/${data.slug}`);
}

export async function guardarEnlaceSesionAction(fd: FormData) {
  await requireAdmin();

  const id = uuid.safeParse(fd.get("sessionId"));
  if (!id.success) redirect("/admin/live?error=Sesión+inválida" as never);
  const sessionId = id.data;

  const validado = validarEnlace(String(fd.get("joinUrl") ?? ""));
  if ("fallo" in validado) volver(sessionId, "error", validado.fallo);

  const passcode = String(fd.get("passcode") ?? "").trim().slice(0, 120) || null;
  const provider = detectarProveedor(validado.url);

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("live_session_access_links").upsert(
    {
      live_session_id: sessionId,
      provider,
      join_url: validado.url,
      passcode,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "live_session_id" }
  );
  if (error) volver(sessionId, "error", error.message);

  await revalidarTodo(sessionId);
  volver(sessionId, "success", `Enlace de ${NOMBRE_PROVEEDOR[provider] === "Enlace" ? "la clase" : NOMBRE_PROVEEDOR[provider]} guardado. Las inscriptas ya lo ven.`);
}

export async function quitarEnlaceSesionAction(fd: FormData) {
  await requireAdmin();

  const id = uuid.safeParse(fd.get("sessionId"));
  if (!id.success) redirect("/admin/live?error=Sesión+inválida" as never);
  const sessionId = id.data;

  const { error } = await createSupabaseAdminClient()
    .from("live_session_access_links")
    .delete()
    .eq("live_session_id", sessionId);
  if (error) volver(sessionId, "error", error.message);

  await revalidarTodo(sessionId);
  volver(sessionId, "success", "Enlace quitado. Las inscriptas ya no lo ven.");
}
