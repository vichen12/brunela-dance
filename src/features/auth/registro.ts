"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";
import { hasSupabaseAuthEnv } from "@/src/lib/env";
import { requireUser } from "@/src/features/auth/guards";

/**
 * Alta de cuenta y onboarding.
 *
 * COMO SOBREVIVE EL PLAN ELEGIDO
 *   El plan que la alumna toca en la landing viaja hasta el checkout dentro de
 *   `options.data`, que Supabase guarda en auth.users.raw_user_meta_data. Vive
 *   con la cuenta, asi que aguanta cerrar la pestaña, volver al dia siguiente o
 *   cambiar de dispositivo -- cosas que un query param o una cookie no
 *   aguantan. Y no necesita ninguna migracion.
 *
 *   Para Google no hay signUp donde meter metadata, asi que ahi el plan viaja
 *   por URL. No hay corte de por medio en OAuth, asi que no se pierde.
 *
 * QUE ESCRIBE Y QUE NO
 *   El perfil lo crea el trigger handle_new_user() a partir de la metadata:
 *   id, email, full_name, avatar_url y preferred_locale. El resto queda en los
 *   defaults, incluido membership_tier = 'none'.
 *
 *   El onboarding despues escribe technical_level, training_goals y
 *   onboarding_completed con el cliente de SESION, no con service_role: la
 *   policy profiles_update_self_or_admin lo permite, la migracion 18 le dio el
 *   grant, y el trigger protect_profile_admin_fields deja pasar justo esos tres
 *   campos mientras revierte membership_tier, is_admin, email e
 *   is_studio_owner. O sea que una alumna no puede darse un plan a si misma.
 */

const TIERS = ["corps_de_ballet", "solista", "principal"] as const;
const INTERVALOS = ["monthly", "yearly"] as const;

const esquemaAlta = z.object({
  fullName: z.string().trim().min(2, "Poné tu nombre.").max(80),
  email: z.string().trim().email("Revisá el correo."),
  password: z.string().min(8, "La contraseña necesita al menos 8 caracteres."),
  plan: z.enum(TIERS).optional(),
  interval: z.enum(INTERVALOS).optional(),
});

/** Vuelve al formulario sin perder lo que ya eligio ni lo que ya escribio. */
function volverAlRegistro(mensaje: string, plan?: string, interval?: string, email?: string): never {
  const q = new URLSearchParams({ error: mensaje });
  if (plan) q.set("plan", plan);
  if (interval) q.set("interval", interval);
  if (email) q.set("email", email);
  redirect(`/registro?${q.toString()}` as never);
}

export async function signUpAction(formData: FormData) {
  if (!hasSupabaseAuthEnv()) {
    redirect("/registro?error=Configuracion%20pendiente" as never);
  }

  const plan = String(formData.get("plan") ?? "") || undefined;
  const interval = String(formData.get("interval") ?? "") || undefined;
  const emailCrudo = String(formData.get("email") ?? "").trim();

  const parsed = esquemaAlta.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    password: formData.get("password"),
    plan,
    interval,
  });

  if (!parsed.success) {
    volverAlRegistro(parsed.error.issues[0]?.message ?? "Revisá los datos.", plan, interval, emailCrudo);
  }

  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      // full_name lo lee handle_new_user() para el perfil. pending_tier queda
      // guardado para el paso del checkout.
      data: {
        full_name: parsed.data.fullName,
        pending_tier: parsed.data.plan ?? null,
        pending_interval: parsed.data.interval ?? null,
      },
    },
  });

  if (error) {
    const yaExiste = /already registered|already been registered|User already/i.test(error.message);
    volverAlRegistro(
      yaExiste
        ? "Ya hay una cuenta con ese correo. Iniciá sesión."
        : error.message,
      plan,
      interval,
      emailCrudo
    );
  }

  // Con "Confirm email" ENCENDIDO, signUp devuelve usuario pero NO sesion: la
  // alumna quedaria sin poder pasar al onboarding y pareceria que el registro
  // fallo. Se detecta aca y se le dice la verdad en vez de dejarla en un limbo.
  if (!data.session) {
    volverAlRegistro(
      "Te mandamos un correo para confirmar la cuenta. Abrilo y volvé a entrar.",
      plan,
      interval,
      emailCrudo
    );
  }

  const q = new URLSearchParams();
  if (parsed.data.plan) q.set("plan", parsed.data.plan);
  if (parsed.data.interval) q.set("interval", parsed.data.interval);
  redirect(`/registro/onboarding${q.size ? `?${q.toString()}` : ""}` as never);
}

// ─────────────────────────────────────────────────────────────────────────────

const esquemaOnboarding = z.object({
  technicalLevel: z.enum(["principiante", "intermedio", "avanzado", "profesional", "maestro"]),
  goals: z.array(z.enum([
    "movilidad", "fuerza_centro", "flexibilidad", "recuperacion",
    "resistencia", "alineacion_postural", "rendimiento_escenico", "bienestar_general",
  ])).min(1, "Elegí al menos un objetivo."),
  plan: z.enum(TIERS).optional(),
  interval: z.enum(INTERVALOS).optional(),
});

export async function completarOnboardingAction(formData: FormData) {
  const { user } = await requireUser();

  const plan = String(formData.get("plan") ?? "") || undefined;
  const interval = String(formData.get("interval") ?? "") || undefined;

  const parsed = esquemaOnboarding.safeParse({
    technicalLevel: formData.get("technicalLevel"),
    goals: formData.getAll("goals").map(String),
    plan,
    interval,
  });

  if (!parsed.success) {
    const q = new URLSearchParams({ error: parsed.error.issues[0]?.message ?? "Revisá los datos." });
    if (plan) q.set("plan", plan);
    if (interval) q.set("interval", interval);
    redirect(`/registro/onboarding?${q.toString()}` as never);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      technical_level: parsed.data.technicalLevel,
      training_goals: parsed.data.goals,
      onboarding_completed: true,
    })
    .eq("id", user.id);

  if (error) {
    const q = new URLSearchParams({ error: error.message });
    if (plan) q.set("plan", plan);
    redirect(`/registro/onboarding?${q.toString()}` as never);
  }

  // El plan puede venir por URL (camino Google) o de la metadata (camino
  // correo). Se prefiere el de la URL porque es el que la alumna acaba de ver.
  const meta = user.user_metadata as { pending_tier?: string | null; pending_interval?: string | null } | undefined;
  const tierFinal = parsed.data.plan ?? (meta?.pending_tier ?? undefined);
  const intervaloFinal = parsed.data.interval ?? (meta?.pending_interval ?? undefined);

  if (tierFinal && (TIERS as readonly string[]).includes(tierFinal)) {
    const q = new URLSearchParams({ plan: tierFinal, iniciar: "1" });
    if (intervaloFinal && (INTERVALOS as readonly string[]).includes(intervaloFinal)) {
      q.set("interval", intervaloFinal);
    }
    redirect(`/dashboard/plan?${q.toString()}` as never);
  }

  redirect("/dashboard/plan" as never);
}
