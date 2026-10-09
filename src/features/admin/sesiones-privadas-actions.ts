"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/src/features/auth/guards";
import { createSupabaseAdminClient } from "@/src/lib/supabase/admin";
import { escribirleALaAlumna } from "@/src/features/admin/chat-directo";
import {
  AVISO_FALTA_MIGRACION_PRIVADAS, esFaltaDeTabla, mensajeAgendada, mensajeCambio, mensajeCancelada, validarAgenda,
} from "@/src/features/studio/sesiones-privadas-reglas";

/**
 * Agendar, cambiar y cancelar sesiones privadas 1 a 1.
 *
 * requireAdmin() va PRIMERO en cada una: una server action es un endpoint POST
 * publico y estas escriben con service_role, que saltea RLS (trampa 4). La
 * tabla no tiene NINGUNA policy de escritura: este archivo es el unico camino.
 *
 * Cada cambio que la alumna tiene que saber se lo cuenta por el chat privado.
 * Si el mensaje falla, la sesion igual queda guardada y se avisa: deshacer una
 * cita por un chat caido seria peor.
 */

const UUID = z.string().uuid();

/** Solo se vuelve a pantallas del panel que muestran sesiones privadas. */
function volverA(fd: FormData) {
  const v = String(fd.get("volverA") ?? "");
  const ok = /^\/admin\/(users\/[0-9a-f-]{36}|sesiones-privadas|calendario)(\?[^#]*)?(#[\w-]+)?$/i.test(v);
  return ok ? v : "/admin/sesiones-privadas";
}

/** Agrega ?success= o ?error= respetando lo que ya traiga la URL y el ancla. */
function ir(base: string, clave: "success" | "error", texto: string): never {
  const [sinAncla, ancla] = base.split("#");
  const sep = sinAncla.includes("?") ? "&" : "?";
  redirect(`${sinAncla}${sep}${clave}=${encodeURIComponent(texto)}${ancla ? "#" + ancla : "#privadas"}` as never);
}

function datos(fd: FormData) {
  return {
    fecha: String(fd.get("fecha") ?? ""),
    hora: String(fd.get("hora") ?? ""),
    duracion: String(fd.get("duracion") ?? ""),
    enlace: String(fd.get("enlace") ?? ""),
    nota: String(fd.get("nota") ?? ""),
  };
}

function revalidar(alumnaId: string) {
  revalidatePath(`/admin/users/${alumnaId}`);
  revalidatePath("/admin/sesiones-privadas");
  revalidatePath("/admin/calendario");
  revalidatePath("/admin");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/sesiones-privadas");
  revalidatePath("/dashboard/chat");
}

export async function agendarSesionPrivadaAction(fd: FormData) {
  const { user } = await requireAdmin();
  const destino = volverA(fd);
  const alumnaId = String(fd.get("alumnaId") ?? "");
  if (!UUID.safeParse(alumnaId).success) ir(destino, "error", "Elegí a la alumna.");

  const v = validarAgenda(datos(fd));
  if ("fallo" in v) ir(destino, "error", v.fallo);

  const db = createSupabaseAdminClient();
  const { error } = await db.from("sesiones_privadas").insert({
    alumna_id: alumnaId,
    starts_at: v.ok.startsAt,
    duracion_minutos: v.ok.duracion,
    enlace: v.ok.enlace,
    proveedor: v.ok.proveedor,
    nota: v.ok.nota,
    estado: "agendada",
    created_by: user.id,
  });
  if (error) ir(destino, "error", esFaltaDeTabla(error) ? AVISO_FALTA_MIGRACION_PRIVADAS : error.message);

  const fallo = await escribirleALaAlumna(db, user.id, alumnaId, mensajeAgendada(v.ok.startsAt, !!v.ok.enlace));
  revalidar(alumnaId);
  if (fallo) ir(destino, "error", "La sesión quedó agendada, pero no se le pudo avisar por el chat: " + fallo);
  ir(destino, "success", "Sesión agendada. Le avisamos por su chat privado.");
}

export async function editarSesionPrivadaAction(fd: FormData) {
  const { user } = await requireAdmin();
  const destino = volverA(fd);
  const id = String(fd.get("id") ?? "");
  if (!UUID.safeParse(id).success) ir(destino, "error", "No se encontró la sesión.");

  const db = createSupabaseAdminClient();
  const { data: actual, error: errLeer } = await db
    .from("sesiones_privadas").select("id, alumna_id, starts_at, enlace, estado").eq("id", id).maybeSingle();
  if (errLeer) ir(destino, "error", esFaltaDeTabla(errLeer) ? AVISO_FALTA_MIGRACION_PRIVADAS : errLeer.message);
  if (!actual) ir(destino, "error", "No se encontró la sesión.");
  if (actual.estado === "cancelada") ir(destino, "error", "Esa sesión está cancelada. Agendá una nueva.");

  // Una sesion que ya paso se puede editar (la nota, el enlace) sin que la
  // fecha tenga que ser futura.
  const v = validarAgenda(datos(fd), { permitirPasado: true });
  if ("fallo" in v) ir(destino, "error", v.fallo);
  const cambioFecha = new Date(actual.starts_at).getTime() !== new Date(v.ok.startsAt).getTime();
  if (cambioFecha && Date.parse(v.ok.startsAt) + v.ok.duracion * 60000 <= Date.now()) {
    ir(destino, "error", "La nueva fecha ya pasó. Elegí un día y una hora que todavía no hayan llegado.");
  }

  const { error } = await db.from("sesiones_privadas").update({
    starts_at: v.ok.startsAt,
    duracion_minutos: v.ok.duracion,
    enlace: v.ok.enlace,
    proveedor: v.ok.proveedor,
    nota: v.ok.nota,
  }).eq("id", id);
  if (error) ir(destino, "error", error.message);

  const enlaceNuevo = !!v.ok.enlace && v.ok.enlace !== actual.enlace;
  const futura = Date.parse(v.ok.startsAt) + v.ok.duracion * 60000 > Date.now();
  const texto = futura ? mensajeCambio(v.ok.startsAt, cambioFecha, enlaceNuevo) : null;
  const fallo = texto ? await escribirleALaAlumna(db, user.id, actual.alumna_id as string, texto) : null;
  revalidar(actual.alumna_id as string);
  if (fallo) ir(destino, "error", "Los cambios se guardaron, pero no se le pudo avisar por el chat: " + fallo);
  ir(destino, "success", texto ? "Cambios guardados. Le avisamos por su chat privado." : "Cambios guardados.");
}

export async function cancelarSesionPrivadaAction(fd: FormData) {
  const { user } = await requireAdmin();
  const destino = volverA(fd);
  const id = String(fd.get("id") ?? "");
  if (!UUID.safeParse(id).success) ir(destino, "error", "No se encontró la sesión.");

  const db = createSupabaseAdminClient();
  const { data: actual, error: errLeer } = await db
    .from("sesiones_privadas").select("id, alumna_id, starts_at, duracion_minutos, estado").eq("id", id).maybeSingle();
  if (errLeer) ir(destino, "error", esFaltaDeTabla(errLeer) ? AVISO_FALTA_MIGRACION_PRIVADAS : errLeer.message);
  if (!actual) ir(destino, "error", "No se encontró la sesión.");
  if (actual.estado === "cancelada") ir(destino, "success", "Esa sesión ya estaba cancelada.");

  // Se marca, no se borra: queda el rastro y el X/2 del mes deja de contarla.
  const { error } = await db.from("sesiones_privadas").update({ estado: "cancelada" }).eq("id", id);
  if (error) ir(destino, "error", error.message);

  // Solo se avisa si todavia no paso: cancelar una de la semana pasada es
  // ordenar la agenda, no una noticia para ella.
  const futura = new Date(actual.starts_at).getTime() + Number(actual.duracion_minutos) * 60000 > Date.now();
  const fallo = futura ? await escribirleALaAlumna(db, user.id, actual.alumna_id as string, mensajeCancelada(actual.starts_at as string)) : null;
  revalidar(actual.alumna_id as string);
  if (fallo) ir(destino, "error", "La sesión quedó cancelada, pero no se le pudo avisar por el chat: " + fallo);
  ir(destino, "success", futura ? "Sesión cancelada. Le avisamos por su chat privado." : "Sesión cancelada.");
}
