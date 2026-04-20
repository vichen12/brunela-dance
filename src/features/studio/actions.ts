"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/src/features/auth/guards";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";

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
  redirectTo: z.string().min(1)
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
    redirectWithMessage(parsed.data.redirectTo, "error", existingError.message);
  }

  const bookingResult = existing?.id
    ? await supabase
        .from("live_session_bookings")
        .update({ status: "reserved", canceled_at: null })
        .eq("id", existing.id)
        .select("status")
        .single<{ status: "reserved" | "waitlisted" }>()
    : await supabase
        .from("live_session_bookings")
        .insert({ live_session_id: parsed.data.sessionId, user_id: user.id, status: "reserved" })
        .select("status")
        .single<{ status: "reserved" | "waitlisted" }>();

  if (bookingResult.error) {
    redirectWithMessage(parsed.data.redirectTo, "error", bookingResult.error.message);
  }

  refreshStudioRoutes();
  const message =
    bookingResult.data.status === "waitlisted"
      ? "La clase se lleno y quedaste en lista de espera."
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
    redirectWithMessage(parsed.data.redirectTo, "error", error.message);
  }

  refreshStudioRoutes();
  redirectWithMessage(parsed.data.redirectTo, "success", "Reserva cancelada.");
}
