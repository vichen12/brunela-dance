"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/src/features/auth/guards";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";
import { createSupabaseAdminClient } from "@/src/lib/supabase/admin";

/**
 * El error de la base al reservar, en castellano (2026-11-12). Antes a la
 * alumna le llegaba tal cual: "Booking window is closed".
 */
function errorDeReserva(error: { message?: string } | null): string {
  const m = error?.message ?? "";
  console.error("[reservas]", m);
  if (/window has not opened/i.test(m)) return "Las reservas para esta clase todavía no abrieron.";
  if (/window is closed/i.test(m)) return "Las reservas para esta clase ya cerraron.";
  if (/is full/i.test(m)) return "La clase ya no tiene lugares.";
  if (/tier does not allow/i.test(m)) return "Esta clase no está incluida en tu plan.";
  if (/only scheduled/i.test(m)) return "Esta clase ya no se puede reservar.";
  return "No pudimos hacer la reserva. Probá de nuevo en un momento.";
}

/**
 * Si se libero un lugar, pasa a la primera de la lista de espera a reservada.
 * Antes la lista de espera no avanzaba nunca. Con service_role porque la
 * regla de la base no deja que una alumna cambie la reserva de otra; la
 * misma regla igual revisa el cupo, el plan y la ventana. Nunca lanza.
 */
async function avanzarListaDeEspera(sesionId: string) {
  try {
    const db = createSupabaseAdminClient();
    const { data: primera } = await db
      .from("live_session_bookings")
      .select("id")
      .eq("live_session_id", sesionId)
      .eq("status", "waitlisted")
      .order("reserved_at", { ascending: true })
      .limit(1)
      .maybeSingle<{ id: string }>();
    if (!primera) return;
    const { data } = await db
      .from("live_session_bookings")
      .update({ status: "reserved" })
      .eq("id", primera.id)
      .select("status")
      .maybeSingle<{ status: string }>();
    if (data?.status === "reserved") console.log(`[reservas] lista de espera avanzo en ${sesionId}`);
  } catch (e) {
    console.error("[reservas] lista de espera:", e instanceof Error ? e.message : e);
  }
}

const progressSchema = z.object({
  slug: z.string().min(1),
  videoId: z.string().uuid(),
  programId: z.string().uuid().optional().or(z.literal("")),
  programDayNumber: z.coerce.number().int().positive().optional(),
  lastPositionSeconds: z.coerce.number().int().min(0),
  completionPercent: z.coerce.number().min(0).max(100)
});

const liveBookingSchema = z.object({
  sessionId: z.string().uuid(),
  // Solo de vuelta a la agenda o al perfil de una sesion. Antes aceptaba
  // cualquier texto: un enlace armado podia mandar a la alumna a otro sitio
  // despues de reservar (open redirect).
  redirectTo: z.string().regex(/^\/dashboard\/live(\/[a-z0-9-]{1,120})?$/).catch("/dashboard/live")
});

function redirectWithMessage(path: string, kind: "success" | "error", message: string): never {
  const separator = path.includes("?") ? "&" : "?";
  redirect(`${path}${separator}${kind}=${encodeURIComponent(message)}` as never);
}

function refreshStudioRoutes() {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/library");
  revalidatePath("/dashboard/programs");
  revalidatePath("/dashboard/live");
}

export async function upsertProgressAction(formData: FormData) {
  const { user } = await requireUser();
  const supabase = await createSupabaseServerClient();
  const parsed = progressSchema.safeParse({
    slug: formData.get("slug"),
    videoId: formData.get("videoId"),
    programId: formData.get("programId"),
    programDayNumber: formData.get("programDayNumber") || undefined,
    lastPositionSeconds: formData.get("lastPositionSeconds"),
    completionPercent: formData.get("completionPercent")
  });

  if (!parsed.success) {
    redirectWithMessage("/dashboard/library", "error", "No pudimos guardar el progreso.");
  }

  const baseQuery = supabase
    .from("user_progress")
    .select("id, max_position_seconds")
    .eq("user_id", user.id)
    .eq("video_id", parsed.data.videoId);

  const existingQuery = parsed.data.programId
    ? baseQuery.eq("program_id", parsed.data.programId).limit(1).maybeSingle()
    : baseQuery.is("program_id", null).limit(1).maybeSingle();

  const { data: existing, error: existingError } = await existingQuery;

  if (existingError) {
    redirectWithMessage(`/dashboard/library/${parsed.data.slug}`, "error", existingError.message);
  }

  const payload = {
    user_id: user.id,
    video_id: parsed.data.videoId,
    program_id: parsed.data.programId || null,
    program_day_number: parsed.data.programId ? parsed.data.programDayNumber ?? null : null,
    last_position_seconds: parsed.data.lastPositionSeconds,
    max_position_seconds: Math.max(parsed.data.lastPositionSeconds, Number(existing?.max_position_seconds ?? 0)),
    completion_percent: parsed.data.completionPercent,
    is_completed: parsed.data.completionPercent >= 90
  };

  const result = existing?.id
    ? await supabase.from("user_progress").update(payload).eq("id", existing.id)
    : await supabase.from("user_progress").insert(payload);

  if (result.error) {
    redirectWithMessage(`/dashboard/library/${parsed.data.slug}`, "error", result.error.message);
  }

  refreshStudioRoutes();
  redirectWithMessage(`/dashboard/library/${parsed.data.slug}`, "success", "Progreso guardado.");
}

export async function reserveLiveSessionAction(formData: FormData) {
  const { user } = await requireUser();
  const supabase = await createSupabaseServerClient();
  const parsed = liveBookingSchema.safeParse({
    sessionId: formData.get("sessionId"),
    redirectTo: formData.get("redirectTo")
  });

  if (!parsed.success) {
    redirectWithMessage("/dashboard/live", "error", "No pudimos procesar la reserva.");
  }

  const { data: existing, error: existingError } = await supabase
    .from("live_session_bookings")
    .select("id")
    .eq("live_session_id", parsed.data.sessionId)
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle<{ id: string }>();

  if (existingError) {
    redirectWithMessage(parsed.data.redirectTo, "error", errorDeReserva(existingError));
  }

  // Volver a reservar despues de cancelar: la regla de la base no deja que la
  // alumna pase SU reserva de cancelada a reservada (solo cancelar), asi que
  // siempre fallaba (2026-11-12). La sesion ya se comprobo arriba y el filtro
  // por user_id asegura que es la de ella; la base sigue revisando plan, cupo
  // y ventana de reservas.
  const bookingResult = existing?.id
    ? await createSupabaseAdminClient()
        .from("live_session_bookings")
        .update({ status: "reserved", canceled_at: null })
        .eq("id", existing.id)
        .eq("user_id", user.id)
        .select("status")
        .single<{ status: "reserved" | "waitlisted" }>()
    : await supabase
        .from("live_session_bookings")
        .insert({ live_session_id: parsed.data.sessionId, user_id: user.id, status: "reserved" })
        .select("status")
        .single<{ status: "reserved" | "waitlisted" }>();

  if (bookingResult.error) {
    redirectWithMessage(parsed.data.redirectTo, "error", errorDeReserva(bookingResult.error));
  }

  refreshStudioRoutes();
  const message =
    bookingResult.data.status === "waitlisted"
      ? "La clase se llenó y quedaste en lista de espera. Si se libera un lugar, pasás a tener el tuyo."
      : "Reserva confirmada.";

  redirectWithMessage(parsed.data.redirectTo, "success", message);
}

export async function cancelLiveSessionBookingAction(formData: FormData) {
  const { user } = await requireUser();
  const supabase = await createSupabaseServerClient();
  const parsed = liveBookingSchema.safeParse({
    sessionId: formData.get("sessionId"),
    redirectTo: formData.get("redirectTo")
  });

  if (!parsed.success) {
    redirectWithMessage("/dashboard/live", "error", "No pudimos cancelar la reserva.");
  }

  const { error } = await supabase
    .from("live_session_bookings")
    .update({ status: "canceled" })
    .eq("live_session_id", parsed.data.sessionId)
    .eq("user_id", user.id);

  if (error) {
    redirectWithMessage(parsed.data.redirectTo, "error", errorDeReserva(error));
  }

  await avanzarListaDeEspera(parsed.data.sessionId);
  refreshStudioRoutes();
  redirectWithMessage(parsed.data.redirectTo, "success", "Reserva cancelada.");
}
