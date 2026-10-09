"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/src/features/auth/guards";
import { createSupabaseAdminClient } from "@/src/lib/supabase/admin";
import { getAppUrl } from "@/src/lib/env";
import { conSuscripcionQueDaAcceso } from "@/src/features/studio/acceso-gratis";
import {
  AVISO_FALTA_MIGRACION, PLAN_LABEL, esFaltaDeMigracion, fechaLarga, nuevoVencimiento, type PlanPago,
} from "@/src/features/studio/acceso-gratis-reglas";

/**
 * Acceso gratis por tiempo, desde /admin/users y la ficha de cada alumna.
 *
 * 🔴 requireAdmin() va PRIMERO en cada una (trampa 4): una server action es un
 *    endpoint POST publico, y estas escriben con service_role -- crean cuentas
 *    y regalan planes. Sin la guarda, cualquiera con sesion se regalaria un
 *    año de Principal.
 *
 * Todas toleran que falte la migracion (42703): contestan con
 * AVISO_FALTA_MIGRACION en vez de reventar.
 */

const PLANES = ["corps_de_ballet", "solista", "principal"] as const;

const periodo = z
  .object({
    unidad: z.enum(["meses", "dias"]),
    cantidad: z.coerce.number().int().min(1, "La cantidad tiene que ser al menos 1."),
  })
  .refine((p) => (p.unidad === "meses" ? p.cantidad <= 24 : p.cantidad <= 730), {
    message: "Como mucho 24 meses (o 730 días).",
  });

/** A donde volver: solo /admin/users o la ficha. Nunca una URL que mande el formulario. */
function destino(crudo: FormDataEntryValue | null) {
  const v = String(crudo ?? "");
  return /^\/admin\/users(\/[0-9a-f-]{36})?(\?[^#\s]*)?$/i.test(v) ? v : "/admin/users";
}
function volver(a: string, tipo: "success" | "error", mensaje: string, ancla?: string): never {
  redirect(`${a}${a.includes("?") ? "&" : "?"}${tipo}=${encodeURIComponent(mensaje)}${ancla ? "#" + ancla : ""}` as never);
}

function refrescar(alumnaId?: string) {
  revalidatePath("/admin/users");
  if (alumnaId) revalidatePath(`/admin/users/${alumnaId}`);
  revalidatePath("/admin");
  revalidatePath("/dashboard", "layout");
}

// ─────────────────────────────────────────────────────────────────────────────
// Crear alumna con acceso gratis
// ─────────────────────────────────────────────────────────────────────────────

export type EstadoNuevaAlumna =
  | { tipo: "inicial" }
  | { tipo: "error"; mensaje: string }
  | { tipo: "creada"; nombre: string; correo: string; contrasena: string; plan: string; hasta: string }
  | { tipo: "invitada"; nombre: string; correo: string; plan: string; hasta: string }
  | { tipo: "existe"; id: string; nombre: string; correo: string; plan: PlanPago; unidad: "meses" | "dias"; cantidad: number };

const nuevaSchema = z.object({
  nombre: z.string().trim().min(2, "Escribí su nombre.").max(120),
  correo: z.string().trim().toLowerCase().email("Ese correo no parece válido."),
  plan: z.enum(PLANES, { errorMap: () => ({ message: "Elegí un plan." }) }),
  modo: z.enum(["mail", "clave"]).catch("mail"),
  contrasena: z.string().max(72).optional(),
});

export async function crearAlumnaGratisAction(_prev: EstadoNuevaAlumna, fd: FormData): Promise<EstadoNuevaAlumna> {
  const { user } = await requireAdmin();

  const datos = nuevaSchema.safeParse({
    nombre: fd.get("nombre"), correo: fd.get("correo"), plan: fd.get("plan"),
    modo: fd.get("modo"), contrasena: fd.get("contrasena") ?? undefined,
  });
  if (!datos.success) return { tipo: "error", mensaje: datos.error.issues[0]?.message ?? "Revisá los datos." };
  const tiempo = periodo.safeParse({ unidad: fd.get("unidad"), cantidad: fd.get("cantidad") });
  if (!tiempo.success) return { tipo: "error", mensaje: tiempo.error.issues[0]?.message ?? "Revisá el tiempo gratis." };
  const { nombre, correo, plan, modo } = datos.data;
  const contrasena = datos.data.contrasena ?? "";
  if (modo === "clave" && contrasena.length < 8) {
    return { tipo: "error", mensaje: "La contraseña provisoria tiene que tener al menos 8 caracteres." };
  }
  const { unidad, cantidad } = tiempo.data;

  const db = createSupabaseAdminClient();

  // Antes de crear NADA: si falta la migracion, no se puede guardar el regalo,
  // y crear la cuenta igual dejaria una alumna con plan y sin fecha de fin.
  const prueba = await db.from("profiles").select("acceso_gratis_hasta").limit(1);
  if (esFaltaDeMigracion(prueba.error)) return { tipo: "error", mensaje: AVISO_FALTA_MIGRACION };

  // Si el correo ya existe NO se crea nada: se ofrece darle el acceso a esa cuenta.
  const { data: existente } = await db.from("profiles").select("id, full_name, email").eq("email", correo).maybeSingle();
  if (existente) {
    return {
      tipo: "existe", id: existente.id as string, nombre: (existente.full_name as string | null) ?? correo.split("@")[0],
      correo, plan, unidad, cantidad,
    };
  }

  /*
   * Dos formas de darle la cuenta:
   *   mail  -> inviteUserByEmail: Supabase le manda la plantilla "Invite user"
   *            (emails/supabase/invitacion.html) y ella elige SU contraseña al
   *            tocar el boton (/auth/confirm?type=invite -> contraseña nueva).
   *            Es la recomendada: Brunela no maneja contraseñas ajenas.
   *   clave -> la de antes: cuenta confirmada con contraseña provisoria que
   *            Brunela le pasa a mano (por si el mail no le llega).
   */
  const { data: creado, error: errAlta } =
    modo === "mail"
      ? await db.auth.admin.inviteUserByEmail(correo, {
          data: { full_name: nombre },
          redirectTo: `${getAppUrl()}/sign-in/reset-password`,
        })
      : await db.auth.admin.createUser({
          email: correo,
          password: contrasena,
          email_confirm: true,
          user_metadata: { full_name: nombre },
        });
  if (errAlta || !creado?.user) {
    const msg = errAlta?.message ?? "No se pudo crear la cuenta.";
    if (errAlta?.code === "email_exists" || /already/i.test(msg)) {
      return { tipo: "error", mensaje: "Ese correo ya tiene una cuenta, pero sin perfil en el estudio. Escribinos para revisarla." };
    }
    return { tipo: "error", mensaje: "No se pudo crear la cuenta: " + msg };
  }

  const ahora = new Date();
  const hasta = nuevoVencimiento(null, unidad, cantidad, ahora);
  // El perfil lo crea handle_new_user() en el mismo insert de auth.users; aca
  // se completa. service_role: el trigger de proteccion no interviene (trampa 1).
  const { data: actualizado, error: errPerfil } = await db
    .from("profiles")
    .update({
      full_name: nombre,
      membership_tier: plan,
      // Que haga el onboarding al entrar: nivel y objetivos los elige ella.
      onboarding_completed: false,
      acceso_gratis_hasta: hasta.toISOString(),
      acceso_gratis_desde: ahora.toISOString(),
      acceso_gratis_plan: plan,
      acceso_gratis_otorgado_por: user.id,
      acceso_gratis_aviso_visto_at: null,
    })
    .eq("id", creado.user.id)
    .select("id");

  if (errPerfil || (actualizado ?? []).length === 0) {
    // Sin el perfil completo la cuenta queda a medias (sin plan o sin fecha de
    // fin). Se deshace el alta para que Brunela pueda volver a intentarlo.
    await db.auth.admin.deleteUser(creado.user.id);
    return {
      tipo: "error",
      mensaje: esFaltaDeMigracion(errPerfil) ? AVISO_FALTA_MIGRACION : "No se pudo completar el perfil: " + (errPerfil?.message ?? "no apareció la fila"),
    };
  }

  refrescar(creado.user.id);
  if (modo === "mail") {
    return { tipo: "invitada", nombre, correo, plan: PLAN_LABEL[plan], hasta: fechaLarga(hasta.toISOString()) };
  }
  return { tipo: "creada", nombre, correo, contrasena, plan: PLAN_LABEL[plan], hasta: fechaLarga(hasta.toISOString()) };
}

// ─────────────────────────────────────────────────────────────────────────────
// Dar o extender
// ─────────────────────────────────────────────────────────────────────────────

const UUID = z.string().uuid();

export async function darAccesoGratisAction(fd: FormData) {
  const { user } = await requireAdmin();
  const a = destino(fd.get("volverA"));
  const alumnaId = String(fd.get("alumnaId") ?? "");
  if (!UUID.safeParse(alumnaId).success) volver(a, "error", "Alumna inválida.");
  const plan = z.enum(PLANES).safeParse(fd.get("plan"));
  if (!plan.success) volver(a, "error", "Elegí un plan.", "gratis-" + alumnaId);
  const tiempo = periodo.safeParse({ unidad: fd.get("unidad"), cantidad: fd.get("cantidad") });
  if (!tiempo.success) volver(a, "error", tiempo.error.issues[0]?.message ?? "Revisá el tiempo gratis.", "gratis-" + alumnaId);

  const db = createSupabaseAdminClient();
  const { data: perfil, error } = await db
    .from("profiles")
    .select("id, full_name, email, acceso_gratis_hasta, acceso_gratis_desde")
    .eq("id", alumnaId)
    .maybeSingle();
  if (esFaltaDeMigracion(error)) volver(a, "error", AVISO_FALTA_MIGRACION);
  if (error || !perfil) volver(a, "error", "No se encontró la alumna.");

  // Si ya paga, regalarle un plan le pisaria el que paga, y el trigger de
  // suscripciones lo volveria a pisar en el proximo evento de Stripe.
  let pagan: Set<string>;
  try { pagan = await conSuscripcionQueDaAcceso(db, [alumnaId]); }
  catch (e) { volver(a, "error", (e as Error).message, "gratis-" + alumnaId); }
  if (pagan.has(alumnaId)) {
    volver(a, "error", "Ya tiene una suscripción paga activa: no hace falta regalarle acceso.", "gratis-" + alumnaId);
  }

  const ahora = new Date();
  const hastaActual = perfil.acceso_gratis_hasta as string | null;
  const vigente = !!hastaActual && Date.parse(hastaActual) > ahora.getTime();
  const hasta = nuevoVencimiento(hastaActual, tiempo.data.unidad, tiempo.data.cantidad, ahora);

  const { error: e2 } = await db
    .from("profiles")
    .update({
      membership_tier: plan.data,
      acceso_gratis_hasta: hasta.toISOString(),
      // Extender no reinicia la barra de progreso: sigue contando desde el inicio.
      acceso_gratis_desde: vigente ? (perfil.acceso_gratis_desde as string | null) ?? ahora.toISOString() : ahora.toISOString(),
      acceso_gratis_plan: plan.data,
      acceso_gratis_otorgado_por: user.id,
      // Un regalo nuevo: si vuelve a vencer, el aviso se tiene que ver otra vez.
      acceso_gratis_aviso_visto_at: null,
    })
    .eq("id", alumnaId);
  if (e2) volver(a, "error", esFaltaDeMigracion(e2) ? AVISO_FALTA_MIGRACION : e2.message, "gratis-" + alumnaId);

  refrescar(alumnaId);
  const quien = (perfil.full_name as string | null)?.split(" ")[0] ?? (perfil.email as string);
  volver(a, "success", `Listo: ${quien} tiene ${PLAN_LABEL[plan.data]} gratis hasta el ${fechaLarga(hasta.toISOString())}.`, "gratis-" + alumnaId);
}

// ─────────────────────────────────────────────────────────────────────────────
// Quitar
// ─────────────────────────────────────────────────────────────────────────────

export async function quitarAccesoGratisAction(fd: FormData) {
  await requireAdmin();
  const a = destino(fd.get("volverA"));
  const alumnaId = String(fd.get("alumnaId") ?? "");
  if (!UUID.safeParse(alumnaId).success) volver(a, "error", "Alumna inválida.");

  const db = createSupabaseAdminClient();
  const { data: perfil, error } = await db
    .from("profiles")
    .select("id, is_admin, acceso_gratis_hasta")
    .eq("id", alumnaId)
    .maybeSingle();
  if (esFaltaDeMigracion(error)) volver(a, "error", AVISO_FALTA_MIGRACION);
  if (error || !perfil) volver(a, "error", "No se encontró la alumna.");

  let pagan: Set<string>;
  try { pagan = await conSuscripcionQueDaAcceso(db, [alumnaId]); }
  catch (e) { volver(a, "error", (e as Error).message, "gratis-" + alumnaId); }
  const paga = pagan.has(alumnaId);

  const { error: e2 } = await db
    .from("profiles")
    .update({
      acceso_gratis_hasta: null,
      acceso_gratis_desde: null,
      acceso_gratis_plan: null,
      acceso_gratis_otorgado_por: null,
      acceso_gratis_aviso_visto_at: null,
      // Sin suscripcion, el plan que tenia ERA el regalo: se va con el. Si paga,
      // el plan es el de Stripe y no se toca. A una admin tampoco.
      ...(!paga && !perfil.is_admin ? { membership_tier: "none" } : {}),
    })
    .eq("id", alumnaId);
  if (e2) volver(a, "error", e2.message, "gratis-" + alumnaId);

  refrescar(alumnaId);
  volver(a, "success", paga ? "Acceso gratis quitado. Sigue con el plan que paga." : "Acceso gratis quitado. Quedó sin plan.", "gratis-" + alumnaId);
}
