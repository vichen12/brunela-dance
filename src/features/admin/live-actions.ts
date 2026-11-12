"use server";

import { legible } from "@/src/features/admin/mensaje-legible";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/src/features/auth/guards";
import { createSupabaseAdminClient } from "@/src/lib/supabase/admin";
import { avisoDelCorreo, enviarInvitacion } from "@/src/features/correos/disparadores";
import { detectarProveedor, validarEnlace } from "@/src/features/studio/enlace-clase";
import { madridAIso, ZONA_ESTUDIO } from "@/src/features/studio/sesiones-privadas-reglas";
import { direccionLibre } from "@/src/lib/direccion-libre";
import { esFaltaDeColumnaPlanesSesion, normalizarPlanes, planMinimo, type PlanPago } from "@/src/features/studio/planes-de-sesion";

/**
 * Los planes elegidos con las casillas (20261109). Sin ninguno no se guarda:
 * una sesion que no ve nadie es un error de carga.
 */
function planesDelFormulario(fd: FormData): PlanPago[] {
  return normalizarPlanes(fd.getAll("planesPermitidos"));
}

/**
 * Guarda con la lista de planes y, si la migracion 20261109 todavia no corrio
 * (la columna no existe), vuelve a intentar SIN ella: queda el plan minimo,
 * que es como funcionaba hasta hoy. Asi el panel no se rompe en el medio.
 */
async function conPlanes<T extends { error: { code?: string; message?: string } | null }>(
  planes: PlanPago[],
  escribir: (extra: Record<string, unknown>) => PromiseLike<T>
): Promise<T> {
  const r = await escribir({ planes_permitidos: planes, membership_tier_required: planMinimo(planes) });
  if (r.error && esFaltaDeColumnaPlanesSesion(r.error)) return escribir({ membership_tier_required: planMinimo(planes) });
  return r;
}

/**
 * "2026-11-08T07:44" del formulario -> instante, en HORA DE ESPAÑA.
 *
 * 🔴 ANTES ERA `new Date(valor)`, Y VERCEL CORRE EN UTC: la clase cargada a
 *    las 7:44 quedaba a las 8:44 de Madrid (2026-11-09). El campo no trae zona,
 *    asi que se la pone aca, igual que las sesiones privadas y las ofertas.
 */
function enMadrid(valor: FormDataEntryValue | null): string | null {
  const [fecha, hora] = String(valor ?? "").split("T");
  return madridAIso(fecha ?? "", (hora ?? "").slice(0, 5));
}


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

/**
 * A donde volver despues de una accion: el listado o el perfil de UNA sesion.
 *
 * ⚠️ El valor llega del formulario, o sea de quien manda el POST. Se acepta
 *    solo `/admin/live` o `/admin/live/<uuid>`: cualquier otra cosa (otra ruta,
 *    `//sitio.com`, un protocolo) vuelve al listado. Un redirect abierto en el
 *    panel de admin seria un enlace de phishing con el dominio del estudio.
 */
function volverA(fd: FormData): string {
  const pedido = String(fd.get("redirectTo") ?? "");
  return /^\/admin\/live(\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})?$/i.test(pedido)
    ? pedido
    : "/admin/live";
}

function conMensaje(ruta: string, tipo: "success" | "error", msg: string): never {
  redirect(`${ruta}?${tipo}=${encodeURIComponent(msg)}` as never);
}

/**
 * Horarios que no tienen sentido, frenados ANTES de llegar a la base
 * (2026-11-12). La base los rechaza igual, pero con un error crudo en ingles.
 */
function horarioInvalido(fd: FormData, inicio: string, fin: string): string | null {
  if (Date.parse(fin) <= Date.parse(inicio)) return "La clase tiene que terminar después de empezar. Revisá la hora de fin.";
  const abre = enMadrid(fd.get("bookingOpensAt"));
  const cierra = enMadrid(fd.get("bookingClosesAt"));
  if (abre && cierra && Date.parse(cierra) <= Date.parse(abre)) return "Las reservas tienen que cerrar después de abrir. Revisá esas dos fechas.";
  if (cierra && Date.parse(cierra) > Date.parse(fin)) return "Las reservas no pueden cerrar después de que termina la clase.";
  return null;
}

export async function createLiveSessionAction(fd: FormData) {
  const { user } = await requireAdmin();
  const supabase = createSupabaseAdminClient();

  // La direccion sale del titulo: Brunela ya no la ve (2026-11-09).
  const titulo = String(fd.get("titleEs") ?? "").trim();
  if (!titulo) conMensaje("/admin/live", "error", "Poné un título a la sesión.");
  const slug = await direccionLibre(supabase, "live_sessions", titulo);
  const startsAt = enMadrid(fd.get("startsAt"));
  const endsAt = enMadrid(fd.get("endsAt"));
  const status = (fd.get("status") as string) || "draft";
  if (!startsAt || !endsAt) conMensaje("/admin/live", "error", "Revisá el inicio y el fin: falta la fecha o la hora.");
  const malHorario = horarioInvalido(fd, startsAt!, endsAt!);
  if (malHorario) conMensaje("/admin/live", "error", malHorario);
  const planes = planesDelFormulario(fd);
  if (planes.length === 0) conMensaje("/admin/live", "error", "Elegí al menos un plan que pueda ver la sesión.");

  const { data: session, error } = await conPlanes(planes, (extra) => supabase
    .from("live_sessions")
    .insert({
      ...extra,
      slug,
      title_i18n: { es: fd.get("titleEs"), en: fd.get("titleEn") || undefined },
      description_i18n: { es: fd.get("descriptionEs") || "", en: fd.get("descriptionEn") || "" },
      status,
      starts_at: startsAt,
      ends_at: endsAt,
      // Siempre España: el estudio esta en Barcelona (pedido 2026-11-09).
      session_timezone: ZONA_ESTUDIO,
      capacity: parseInt(fd.get("capacity") as string) || 20,
      cover_image_url: (fd.get("coverImageUrl") as string) || null,
      booking_opens_at: enMadrid(fd.get("bookingOpensAt")),
      booking_closes_at: enMadrid(fd.get("bookingClosesAt")),
      created_by: user.id,
      published_at: status === "scheduled" ? new Date().toISOString() : null,
    })
    .select("id")
    .single());

  if (error) redirect(`/admin/live?error=${encodeURIComponent(legible(error))}` as never);

  // El enlace puede ser de Zoom, de Meet o de otro lado: el proveedor sale de
  // la URL (src/features/studio/enlace-clase.ts). Antes se guardaba "zoom" fijo.
  const joinUrl = String(fd.get("zoomJoinUrl") ?? "").trim();
  if (joinUrl && session) {
    const enlace = validarEnlace(joinUrl);
    if ("fallo" in enlace) {
      revalidatePath("/admin/live", "layout");
      redirect(`/admin/live?error=${encodeURIComponent("Sesión creada, pero el enlace no se guardó: " + enlace.fallo)}` as never);
    }
    await supabase.from("live_session_access_links").insert({
      live_session_id: session.id,
      provider: detectarProveedor(enlace.url),
      join_url: enlace.url,
      passcode: (fd.get("zoomPasscode") as string) || null,
    });
  }

  revalidatePath("/admin/live", "layout");
  revalidatePath("/dashboard/live");
  redirect("/admin/live?success=Sesión+creada" as never);
}

export async function updateLiveSessionAction(fd: FormData) {
  await requireAdmin();
  const supabase = createSupabaseAdminClient();

  const id = fd.get("id") as string;
  const status = fd.get("status") as string;
  const startsAt = enMadrid(fd.get("startsAt"));
  const endsAt = enMadrid(fd.get("endsAt"));
  if (!startsAt || !endsAt) conMensaje(volverA(fd), "error", "Revisá el inicio y el fin: falta la fecha o la hora.");
  const malHorario = horarioInvalido(fd, startsAt!, endsAt!);
  if (malHorario) conMensaje(volverA(fd), "error", malHorario);
  const planes = planesDelFormulario(fd);
  if (planes.length === 0) conMensaje(volverA(fd), "error", "Elegí al menos un plan que pueda ver la sesión.");

  const { error } = await conPlanes(planes, (extra) => supabase
    .from("live_sessions")
    .update({
      ...extra,
      title_i18n: { es: fd.get("titleEs"), en: fd.get("titleEn") || undefined },
      description_i18n: { es: fd.get("descriptionEs") || "", en: fd.get("descriptionEn") || "" },
      status,
      starts_at: startsAt,
      ends_at: endsAt,
      session_timezone: ZONA_ESTUDIO,
      capacity: parseInt(fd.get("capacity") as string) || 20,
      cover_image_url: (fd.get("coverImageUrl") as string) || null,
      booking_opens_at: enMadrid(fd.get("bookingOpensAt")),
      booking_closes_at: enMadrid(fd.get("bookingClosesAt")),
      published_at: status === "scheduled" ? new Date().toISOString() : undefined,
    })
    .eq("id", id));

  if (error) conMensaje(volverA(fd), "error", legible(error));

  const joinUrl = String(fd.get("zoomJoinUrl") ?? "").trim();
  if (joinUrl) {
    const enlace = validarEnlace(joinUrl);
    if ("fallo" in enlace) {
      revalidatePath("/admin/live", "layout");
      conMensaje(volverA(fd), "error", "Se guardó la sesión, pero no el enlace: " + enlace.fallo);
    }
    await supabase.from("live_session_access_links").upsert(
      {
        live_session_id: id,
        provider: detectarProveedor(enlace.url),
        join_url: enlace.url,
        passcode: (fd.get("zoomPasscode") as string) || null,
      },
      { onConflict: "live_session_id" }
    );
  }

  revalidatePath("/admin/live", "layout");
  revalidatePath("/dashboard/live");
  conMensaje(volverA(fd), "success", "Sesión actualizada");
}

export async function deleteLiveSessionAction(fd: FormData) {
  await requireAdmin();
  const supabase = createSupabaseAdminClient();
  const id = fd.get("id") as string;
  await supabase.from("live_sessions").delete().eq("id", id);
  revalidatePath("/admin/live", "layout");
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

  if (error) return { fallo: legible(error) };

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
    conMensaje(volverA(fd), "error", alumna.fallo);
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
    conMensaje(volverA(fd), "error", legible(error));
  }

  // Correo a la alumna, DESPUES de guardar. La clave
  // invitacion:<sesion>:<alumna> impide el segundo si se invita de nuevo.
  const correo = await enviarInvitacion(supabase, sessionId, alumna.id);

  revalidatePath("/admin/live", "layout");
  revalidatePath("/dashboard/live");

  // Esta accion no muestra cartel cuando todo sale bien (el panel queda
  // abierto). Solo se vuelve con mensaje si el correo no salio: la invitacion
  // esta guardada igual, pero Brunela tiene que saber que no le llego.
  if (correo.estado === "fallo" || correo.estado === "sin_migracion") {
    conMensaje(volverA(fd), "success", "Invitación guardada." + avisoDelCorreo(correo));
  }
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
    conMensaje(volverA(fd), "error", legible(error));
  }

  // ⚠️ La reserva que la alumna ya hizo NO se toca. Sacarle la invitacion le
  //    quita el derecho a reservar de nuevo, pero si ya reservo y Brunela
  //    ademas quiere sacarla, eso es cancelar la reserva: otra accion, visible
  //    y aparte. Borrarla en silencio aca dejaria a alguien afuera de una clase
  //    que creia tener.
  revalidatePath("/admin/live", "layout");
  revalidatePath("/dashboard/live");
}

export async function updateStatusAction(fd: FormData) {
  await requireAdmin();
  const supabase = createSupabaseAdminClient();
  const id = fd.get("id") as string;
  const status = fd.get("status") as string;
  const update: Record<string, unknown> = { status };
  if (status === "scheduled") update.published_at = new Date().toISOString();
  const { error } = await supabase.from("live_sessions").update(update).eq("id", id);
  // Antes el error se ignoraba y decia "Estado actualizado" igual.
  if (error) conMensaje(volverA(fd), "error", legible(error, "cambiar el estado de la sesión"));
  revalidatePath("/admin/live", "layout");
  revalidatePath("/dashboard/live");
  conMensaje(volverA(fd), "success", status === "canceled" ? "Sesión cancelada" : "Estado actualizado");
}
