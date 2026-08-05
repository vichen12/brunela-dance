"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/src/features/auth/guards";
import { createSupabaseAdminClient } from "@/src/lib/supabase/admin";

/**
 * Acciones de las sesiones en vivo.
 *
 * POR QUE SALIERON DE LA PAGINA
 *   El formulario de edicion se mudo a un componente de CLIENTE (el panel
 *   lateral), y un componente de cliente no puede importar funciones definidas
 *   dentro de un server component. Con "use server" a nivel de archivo quedan
 *   importables desde los dos lados.
 *
 * ⚠️ Cada una es un endpoint POST publico: todas empiezan con requireAdmin(),
 *    que ya venia asi y hay que mantener.
 */

export async function createLiveSessionAction(fd: FormData) {
  const { user } = await requireAdmin();
  const supabase = createSupabaseAdminClient();

  const slug = (fd.get("slug") as string).trim();
  const startsAt = fd.get("startsAt") as string;
  const endsAt = fd.get("endsAt") as string;
  const status = (fd.get("status") as string) || "draft";

  const { data: session, error } = await supabase
    .from("live_sessions")
    .insert({
      slug,
      title_i18n: { es: fd.get("titleEs"), en: fd.get("titleEn") || undefined },
      description_i18n: { es: fd.get("descriptionEs") || "", en: fd.get("descriptionEn") || "" },
      status,
      membership_tier_required: (fd.get("membershipTierRequired") as string) || "corps_de_ballet",
      starts_at: new Date(startsAt).toISOString(),
      ends_at: new Date(endsAt).toISOString(),
      session_timezone: (fd.get("sessionTimezone") as string) || "America/Buenos_Aires",
      capacity: parseInt(fd.get("capacity") as string) || 20,
      cover_image_url: (fd.get("coverImageUrl") as string) || null,
      booking_opens_at: fd.get("bookingOpensAt") ? new Date(fd.get("bookingOpensAt") as string).toISOString() : null,
      booking_closes_at: fd.get("bookingClosesAt") ? new Date(fd.get("bookingClosesAt") as string).toISOString() : null,
      created_by: user.id,
      published_at: status === "scheduled" ? new Date().toISOString() : null,
    })
    .select("id")
    .single();

  if (error) redirect(`/admin/live?error=${encodeURIComponent(error.message)}` as never);

  const joinUrl = (fd.get("zoomJoinUrl") as string).trim();
  if (joinUrl && session) {
    await supabase.from("live_session_access_links").insert({
      live_session_id: session.id,
      provider: "zoom",
      join_url: joinUrl,
      passcode: (fd.get("zoomPasscode") as string) || null,
    });
  }

  revalidatePath("/admin/live");
  revalidatePath("/dashboard/live");
  redirect("/admin/live?success=Sesión+creada" as never);
}

export async function updateLiveSessionAction(fd: FormData) {
  await requireAdmin();
  const supabase = createSupabaseAdminClient();

  const id = fd.get("id") as string;
  const status = fd.get("status") as string;

  const { error } = await supabase
    .from("live_sessions")
    .update({
      slug: (fd.get("slug") as string).trim(),
      title_i18n: { es: fd.get("titleEs"), en: fd.get("titleEn") || undefined },
      description_i18n: { es: fd.get("descriptionEs") || "", en: fd.get("descriptionEn") || "" },
      status,
      membership_tier_required: fd.get("membershipTierRequired") as string,
      starts_at: new Date(fd.get("startsAt") as string).toISOString(),
      ends_at: new Date(fd.get("endsAt") as string).toISOString(),
      session_timezone: (fd.get("sessionTimezone") as string) || "America/Buenos_Aires",
      capacity: parseInt(fd.get("capacity") as string) || 20,
      cover_image_url: (fd.get("coverImageUrl") as string) || null,
      booking_opens_at: fd.get("bookingOpensAt") ? new Date(fd.get("bookingOpensAt") as string).toISOString() : null,
      booking_closes_at: fd.get("bookingClosesAt") ? new Date(fd.get("bookingClosesAt") as string).toISOString() : null,
      published_at: status === "scheduled" ? new Date().toISOString() : undefined,
    })
    .eq("id", id);

  if (error) redirect(`/admin/live?error=${encodeURIComponent(error.message)}` as never);

  const joinUrl = (fd.get("zoomJoinUrl") as string).trim();
  if (joinUrl) {
    await supabase.from("live_session_access_links").upsert(
      {
        live_session_id: id,
        provider: "zoom",
        join_url: joinUrl,
        passcode: (fd.get("zoomPasscode") as string) || null,
      },
      { onConflict: "live_session_id" }
    );
  }

  revalidatePath("/admin/live");
  revalidatePath("/dashboard/live");
  redirect("/admin/live?success=Sesión+actualizada" as never);
}

export async function deleteLiveSessionAction(fd: FormData) {
  await requireAdmin();
  const supabase = createSupabaseAdminClient();
  const id = fd.get("id") as string;
  await supabase.from("live_sessions").delete().eq("id", id);
  revalidatePath("/admin/live");
  redirect("/admin/live?success=Sesión+eliminada" as never);
}

export async function updateStatusAction(fd: FormData) {
  await requireAdmin();
  const supabase = createSupabaseAdminClient();
  const id = fd.get("id") as string;
  const status = fd.get("status") as string;
  const update: Record<string, unknown> = { status };
  if (status === "scheduled") update.published_at = new Date().toISOString();
  await supabase.from("live_sessions").update(update).eq("id", id);
  revalidatePath("/admin/live");
  revalidatePath("/dashboard/live");
  redirect("/admin/live?success=Estado+actualizado" as never);
}
