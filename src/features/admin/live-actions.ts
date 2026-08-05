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

/**
 * Invitaciones puntuales.
 *
 * Una invitacion deja entrar a UNA sesion a UNA alumna aunque su plan no le
 * alcance. Es lo unico del sistema que da acceso sin mirar el plan, asi que la
 * regla de verdad NO esta aca: esta en la base
 * (20260805_invitaciones_a_sesiones.sql), en los tres lugares que la comprueban.
 * Esto es solo la pantalla para crearla.
 *
 * ⚠️ NO REDIRIGEN AL SALIR BIEN
 *   Brunela suele invitar a varias seguidas. Un redirect cerraria el panel
 *   despues de cada una y habria que volver a abrirlo. El error SI redirige,
 *   porque necesita un lugar donde mostrarse.
 */

/** Busca a la alumna por correo o por nombre y devuelve un error legible. */
async function resolverAlumna(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  criterio: string
): Promise<{ id: string } | { fallo: string }> {
  const texto = criterio.trim();
  if (!texto) return { fallo: "Escribí el correo o el nombre de la alumna." };

  // ⚠️ `.or()` de PostgREST separa las condiciones con comas y las agrupa con
  //    parentesis. Un texto que los traiga no da un error de sintaxis: cambia la
  //    consulta en silencio y puede devolver a otra persona. Ni un correo ni un
  //    nombre los necesitan, asi que se rechazan de entrada.
  if (/[,()]/.test(texto)) {
    return { fallo: "El correo o el nombre no puede tener comas ni paréntesis." };
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, full_name")
    .or(`email.ilike.${texto},full_name.ilike.${texto}`)
    .limit(5);

  if (error) return { fallo: error.message };

  if (!data || data.length === 0) {
    return { fallo: `No hay ninguna alumna con el correo o el nombre "${texto}".` };
  }

  // Dos personas pueden llamarse igual. Elegir "la primera" seria invitar a
  // alguien al azar, y Brunela no tendria forma de notarlo.
  if (data.length > 1) {
    const correos = data.map((p) => p.email).join(", ");
    return {
      fallo:
        `Hay ${data.length} alumnas que coinciden con "${texto}": ${correos}. ` +
        `Usá el correo exacto para elegir cuál.`,
    };
  }

  return { id: data[0].id };
}

export async function inviteToLiveSessionAction(fd: FormData) {
  const { user } = await requireAdmin();
  const supabase = createSupabaseAdminClient();

  const sessionId = fd.get("liveSessionId") as string;
  const alumna = await resolverAlumna(supabase, (fd.get("alumna") as string) ?? "");

  if ("fallo" in alumna) {
    redirect(`/admin/live?error=${encodeURIComponent(alumna.fallo)}` as never);
  }

  const { error } = await supabase.from("live_session_invitations").insert({
    live_session_id: sessionId,
    user_id: alumna.id,
    invited_by: user.id,
    // Sin `note`: la accion leia fd.get("nota") y ESE CAMPO NO EXISTE en el
    // formulario, asi que escribia null siempre. La columna se conserva en la
    // tabla por si algun dia se agrega el campo -- una migracion menos es una
    // cosa menos que puede salir mal -- pero se deja de fingir que se usa.
  });

  // 23505 es el unique (live_session_id, user_id). Ya estaba invitada: no es un
  // fallo, es el estado que se queria.
  if (error && error.code !== "23505") {
    redirect(`/admin/live?error=${encodeURIComponent(error.message)}` as never);
  }

  revalidatePath("/admin/live");
  revalidatePath("/dashboard/live");
}

export async function uninviteFromLiveSessionAction(fd: FormData) {
  await requireAdmin();
  const supabase = createSupabaseAdminClient();

  const sessionId = fd.get("liveSessionId") as string;
  const userId = fd.get("userId") as string;

  const { error } = await supabase
    .from("live_session_invitations")
    .delete()
    .eq("live_session_id", sessionId)
    .eq("user_id", userId);

  if (error) {
    redirect(`/admin/live?error=${encodeURIComponent(error.message)}` as never);
  }

  // ⚠️ La reserva que la alumna ya hizo NO se toca. Sacarle la invitacion le
  //    quita el derecho a reservar de nuevo, pero si ya reservo y Brunela
  //    ademas quiere sacarla, eso es cancelar la reserva: otra accion, visible
  //    y aparte. Borrarla en silencio aca dejaria a alguien afuera de una clase
  //    que creia tener.
  revalidatePath("/admin/live");
  revalidatePath("/dashboard/live");
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
