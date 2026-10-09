"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";
import { getAppUrl, hasSupabaseAuthEnv } from "@/src/lib/env";
import { requireUser } from "@/src/features/auth/guards";
import { crearCheckoutDePack, crearCheckoutDeSuscripcion, type ResultadoCheckout } from "@/src/lib/stripe/crear-checkout";
import { leerAccesoAlEstudio } from "@/src/features/acceso/servidor";
import { onboardingPideElPago, RUTA_ELEGIR_PLAN } from "@/src/features/acceso/reglas";

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
  const pack = String(formData.get("pack") ?? "") || undefined;
  const emailCrudo = String(formData.get("email") ?? "").trim();

  // ⚠️ `pack` no entraba a este parse: el formulario lo mandaba y se perdia,
  //    asi que pending_pack quedaba siempre en null y quien llegaba por un pack
  //    terminaba eligiendo plan.
  const parsed = esquemaAlta.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    password: formData.get("password"),
    plan,
    interval,
    pack,
  });

  if (!parsed.success) {
    volverAlRegistro(parsed.error.issues[0]?.message ?? "Revisá los datos.", plan, interval, emailCrudo);
  }

  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      // A donde lleva el boton del correo de confirmacion. El middleware canjea
      // el ?code= por sesion en /auth/callback y sigue al onboarding. Si la URL
      // no estuviera en la lista de Supabase, cae en la Site URL (la portada)
      // y el middleware la manda igual al estudio.
      emailRedirectTo: `${getAppUrl()}/registro/onboarding`,
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
    redirect(`/registro/revisa-tu-correo?email=${encodeURIComponent(parsed.data.email)}` as never);
  }

  const q = new URLSearchParams();
  if (parsed.data.plan) q.set("plan", parsed.data.plan);
  if (parsed.data.interval) q.set("interval", parsed.data.interval);
  if (parsed.data.pack) q.set("pack", parsed.data.pack);
  redirect(`/registro/onboarding${q.size ? `?${q.toString()}` : ""}` as never);
}

/**
 * "Reenviar el correo" de /registro/revisa-tu-correo.
 *
 * Supabase ya limita el ritmo (el intervalo minimo del SMTP y su propio
 * rate limit), asi que esto no abre una via para mandar correos en masa: un
 * pedido muy seguido vuelve con su error y se muestra tal cual.
 */
export async function reenviarConfirmacionAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const volver = (q: string) =>
    redirect(`/registro/revisa-tu-correo?email=${encodeURIComponent(email)}&${q}` as never);

  if (!hasSupabaseAuthEnv() || !z.string().email().safeParse(email).success) {
    volver(`error=${encodeURIComponent("Revisá el correo.")}`);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: `${getAppUrl()}/registro/onboarding` },
  });

  if (error) {
    const esperar = /seconds|rate|security purposes/i.test(error.message);
    volver(`error=${encodeURIComponent(esperar ? "Esperá un minuto antes de pedirlo de nuevo." : error.message)}`);
  }
  volver("enviado=1");
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
  const pack = String(formData.get("pack") ?? "") || undefined;

  const parsed = esquemaOnboarding.safeParse({
    technicalLevel: formData.get("technicalLevel"),
    goals: formData.getAll("goals").map(String),
    plan,
    interval,
    pack,
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

  // EL PAGO ES EL ULTIMO PASO DEL ALTA (pedido de la duena, 2026-10-09):
  // "quiero que se pague ahi mismo, y cuando este pagado que se abra la cuenta".
  //
  // Solo para quien NO tiene acceso. Una alumna que Brunela dio de alta con
  // meses gratis, una que ya compro un pack o una admin entran directo, como
  // antes: la misma regla que la compuerta del estudio (src/features/acceso).
  const acceso = await leerAccesoAlEstudio(user.id);
  if (!acceso || !onboardingPideElPago(acceso)) {
    redirect("/dashboard" as never);
  }

  // Lo que eligio en el paso 4 llega en el formulario: el radio del plan y del
  // intervalo, o el pack escondido si venia por uno. No se mira la metadata
  // aca: si el pack ya no estaba a la venta, la pantalla mostro los planes, y
  // lo elegido es lo que la alumna vio.
  await irAlPago(user, { plan: parsed.data.plan, interval: parsed.data.interval, pack: parsed.data.pack });
}

/**
 * "Empezar mis 7 dias gratis" / "Pagar el pack" de /registro/plan: la pantalla
 * a la que manda el estudio a quien no tiene acceso.
 */
export async function pagarPlanAction(formData: FormData) {
  const { user } = await requireUser();

  // Quien ya tiene acceso no paga aca: cambiar de plan o sumar un pack se hace
  // desde /dashboard/plan, que sabe de suscripciones activas. Sin esto, una
  // Solista con la pestaña vieja abierta abriria una SEGUNDA suscripcion.
  const acceso = await leerAccesoAlEstudio(user.id);
  if (!acceso || !onboardingPideElPago(acceso)) {
    redirect("/dashboard" as never);
  }

  await irAlPago(user, {
    plan: String(formData.get("plan") ?? "") || undefined,
    interval: String(formData.get("interval") ?? "") || undefined,
    pack: String(formData.get("pack") ?? "") || undefined,
  });
}

/**
 * Crea la sesion de Stripe con la MISMA funcion que /api/stripe/checkout y
 * /api/stripe/checkout-pack (src/lib/stripe/crear-checkout.ts) y la manda ahi.
 * Lo unico propio son los destinos de vuelta:
 *
 *   · pago hecho  -> /registro/activando, que espera al webhook. El acceso lo
 *                    escribe SOLO el webhook; esa pantalla nunca lo da.
 *   · cancelado   -> /registro/plan, con lo que habia elegido ya marcado.
 *
 * Quien paga sale de requireUser() (la sesion), nunca del formulario.
 */
async function irAlPago(
  user: { id: string; email?: string | null },
  eleccion: { plan?: string; interval?: string; pack?: string }
): Promise<never> {
  const volverConError = (mensaje: string): never =>
    redirect(`${RUTA_ELEGIR_PLAN}?${new URLSearchParams({ error: mensaje }).toString()}` as never);

  const exito = (appUrl: string) => `${appUrl}/registro/activando?session_id={CHECKOUT_SESSION_ID}`;

  // Se valida ANTES del try: redirect() lanza, y un catch lo tragaria.
  const slug = eleccion.pack ? eleccion.pack.slice(0, 120) : null;
  const tier = (TIERS as readonly string[]).includes(eleccion.plan ?? "")
    ? (eleccion.plan as (typeof TIERS)[number])
    : null;
  if (!slug && !tier) volverConError("Elegí un plan para seguir.");
  const interval = eleccion.interval === "yearly" ? "yearly" : "monthly";

  let resultado: ResultadoCheckout;
  try {
    resultado = slug
      ? await crearCheckoutDePack({
          user: { id: user.id, email: user.email },
          packSlug: slug,
          destinos: (appUrl) => ({
            successUrl: exito(appUrl),
            cancelUrl: `${appUrl}${RUTA_ELEGIR_PLAN}?${new URLSearchParams({ cancelado: "1", pack: slug }).toString()}`,
          }),
        })
      : await crearCheckoutDeSuscripcion({
          user: { id: user.id, email: user.email },
          tier: tier!,
          interval,
          destinos: (appUrl) => ({
            successUrl: exito(appUrl),
            cancelUrl: `${appUrl}${RUTA_ELEGIR_PLAN}?${new URLSearchParams({ cancelado: "1", plan: tier!, interval }).toString()}`,
          }),
        });
  } catch (e) {
    console.error("[registro] no se pudo crear la sesion de pago:", e instanceof Error ? e.message : e);
    return volverConError("No pudimos abrir el pago. Probá de nuevo en un momento.");
  }

  if (!resultado.ok) {
    // Ya lo tiene: entonces ya tiene acceso. Al estudio, no a pagar de nuevo.
    if (resultado.status === 409) redirect("/dashboard" as never);
    if (resultado.status === 404) {
      return volverConError("Ese pack ya no está disponible. Podés elegir un plan.");
    }
    // El detalle (price id que falta, catalogo viejo) es para nosotros, no
    // para la alumna.
    console.error("[registro] checkout rechazado:", resultado.status, resultado.error);
    return volverConError("No pudimos abrir el pago. Probá de nuevo en un momento.");
  }

  if (!resultado.url) return volverConError("No pudimos abrir el pago. Probá de nuevo en un momento.");
  redirect(resultado.url as never);
}
