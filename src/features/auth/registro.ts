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
  // El pack viaja como SLUG. No se valida contra la base aca -- eso costaria un
  // viaje mas en el alta -- sino en /api/stripe/checkout-pack, que ademas es
  // donde importa: es el que resuelve el precio.
  pack: z.string().min(1).max(120).optional(),
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
        pending_pack: parsed.data.pack ?? null,
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
  pack: z.string().min(1).max(120).optional(),
  // Una casilla sin marcar no llega en el FormData, asi que la ausencia ES el
  // "no". Por eso el default es false y no hay forma de que un formulario
  // manipulado active el consentimiento por omision.
  marketingOptIn: z.boolean().default(false),
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
    marketingOptIn: formData.get("marketingOptIn") === "si",
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

  // El consentimiento va en una escritura APARTE, y a proposito.
  //
  // El codigo se despliega antes de que se corra
  // 20260803_marketing_consent.sql. Si `marketing_opt_in` viajara en el update
  // de arriba, mientras falte esa columna PostgREST rechaza la fila ENTERA y el
  // onboarding se rompe para toda alumna nueva: no guardaria ni el nivel ni los
  // objetivos, y quedaria en un bucle contra la compuerta del layout.
  //
  // Separado, el peor caso es que no se registre el consentimiento -- y como el
  // envio de correos todavia no existe, eso no le quita nada a nadie.
  //
  // La FECHA no se escribe aca: la sella el trigger stamp_marketing_consent.
  const { error: errorConsentimiento } = await supabase
    .from("profiles")
    .update({ marketing_opt_in: parsed.data.marketingOptIn })
    .eq("id", user.id);

  if (errorConsentimiento) {
    console.error(
      "[onboarding] no se pudo guardar el consentimiento (falta correr " +
        "20260803_marketing_consent.sql?):",
      errorConsentimiento.message
    );
  }

  // El plan puede venir por URL (camino Google) o de la metadata (camino
  // correo). Se prefiere el de la URL porque es el que la alumna acaba de ver.
  const meta = user.user_metadata as {
    pending_tier?: string | null;
    pending_interval?: string | null;
    pending_pack?: string | null;
  } | undefined;
  const tierFinal = parsed.data.plan ?? (meta?.pending_tier ?? undefined);
  const intervaloFinal = parsed.data.interval ?? (meta?.pending_interval ?? undefined);
  const packFinal = parsed.data.pack ?? (meta?.pending_pack ?? undefined);

  // El pack va PRIMERO: quien entro por un pack no eligio plan, y si eligio las
  // dos cosas lo ultimo que toco fue el pack. Cobrarle una suscripcion que no
  // pidio es el peor error posible en este cruce.
  if (packFinal) {
    const q = new URLSearchParams({ pack: packFinal, iniciar: "1" });
    redirect(`/dashboard/plan?${q.toString()}` as never);
  }

  if (tierFinal && (TIERS as readonly string[]).includes(tierFinal)) {
    const q = new URLSearchParams({ plan: tierFinal, iniciar: "1" });
    if (intervaloFinal && (INTERVALOS as readonly string[]).includes(intervaloFinal)) {
      q.set("interval", intervaloFinal);
    }
    redirect(`/dashboard/plan?${q.toString()}` as never);
  }

  redirect("/dashboard/plan" as never);
}
