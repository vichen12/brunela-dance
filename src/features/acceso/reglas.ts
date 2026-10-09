/**
 * ¿Puede entrar al estudio? — LA regla, en un solo lugar.
 *
 * Pedido de la duena (2026-10-09): "quiero que se pague ahi mismo, y cuando
 * este pagado que se abra la cuenta". O sea: sin acceso, el estudio no abre.
 *
 * Funciones PURAS (sin base, sin servidor). Las usan:
 *   · app/dashboard/layout.tsx       -> la compuerta del estudio
 *   · app/registro/onboarding        -> si muestra o no el paso del plan
 *   · app/registro/plan              -> si muestra el selector o la deja pasar
 *   · app/registro/activando         -> si el webhook ya abrio la cuenta
 *   · las actions de registro.ts     -> si hay que cobrar o no
 *
 * ⚠️ TODAS tienen que mirar la MISMA regla con los MISMOS datos. Si el layout
 *    y /registro/plan contestaran distinto para la misma alumna, uno manda al
 *    otro y el otro devuelve: un bucle de redirecciones. Por eso los datos los
 *    arma una sola funcion (leerAccesoAlEstudio, en ./servidor.ts) y la
 *    decision sale de aca.
 *
 * ⚠️ ESTO NO DA ACCESO A NADA. Solo decide que pantalla ver. Lo que una alumna
 *    puede reproducir lo sigue decidiendo RLS, y el plan lo sigue escribiendo
 *    el webhook. Ninguna pantalla de este flujo escribe el plan.
 */

export type Tier = "none" | "corps_de_ballet" | "solista" | "principal";

export type DatosDeAcceso = {
  esAdmin: boolean;
  /** profiles.membership_tier, YA con la baja del acceso gratis aplicada. */
  tier: Tier;
  /** Al menos una fila en pack_purchases. Los packs son para siempre. */
  tienePack: boolean;
  /** profiles.acceso_gratis_hasta (null si no hay o falta la migracion). */
  gratisHasta: string | null;
};

/**
 * Tiene acceso si es admin, si tiene un plan (pagado, en prueba, en gracia o
 * regalado mientras dure: todos escriben membership_tier), si compro un pack,
 * o si tiene un acceso gratis que todavia no vencio.
 *
 * El acceso gratis vigente ya pone membership_tier, asi que la ultima rama es
 * un respaldo: si la admin le cargo la fecha y el plan quedo en 'none' por un
 * momento, no se la manda a pagar algo que ya le regalaron.
 */
export function tieneAccesoAlEstudio(d: DatosDeAcceso, ahora: number = Date.now()): boolean {
  if (d.esAdmin) return true;
  if (d.tier !== "none") return true;
  if (d.tienePack) return true;
  if (d.gratisHasta && Date.parse(d.gratisHasta) > ahora) return true;
  return false;
}

export const RUTA_ELEGIR_PLAN = "/registro/plan";
export const RUTA_ONBOARDING = "/registro/onboarding";

/**
 * La compuerta del layout del estudio. null = puede pasar.
 * El onboarding va antes que el pago: primero se cuenta quien es, despues paga.
 */
export function destinoDelEstudio(e: { esAdmin: boolean; onboardingCompleto: boolean; tieneAcceso: boolean }): string | null {
  if (e.esAdmin) return null;
  if (!e.onboardingCompleto) return RUTA_ONBOARDING;
  if (!e.tieneAcceso) return RUTA_ELEGIR_PLAN;
  return null;
}

/**
 * /registro/plan. null = mostrar el selector.
 * Es el espejo exacto de destinoDelEstudio: solo devuelve al estudio a quien
 * el estudio deja pasar.
 */
export function destinoDeElegirPlan(e: { esAdmin: boolean; onboardingCompleto: boolean; tieneAcceso: boolean }): string | null {
  if (e.esAdmin) return "/dashboard";
  if (!e.onboardingCompleto) return RUTA_ONBOARDING;
  if (e.tieneAcceso) return "/dashboard";
  return null;
}

/**
 * ¿El onboarding termina en el pago? Solo para quien NO tiene acceso: una
 * alumna que Brunela dio de alta con meses gratis, una que compro un pack o una
 * admin entran directo, como antes.
 */
export function onboardingPideElPago(e: { esAdmin: boolean; tieneAcceso: boolean }): boolean {
  return !e.esAdmin && !e.tieneAcceso;
}

/**
 * /registro/activando, despues de Stripe.
 *   "estudio"  -> el webhook ya escribio el acceso
 *   "elegir"   -> la sesion no es suya o no existe
 *   "cancelado"-> no se completo el pago
 *   "esperar"  -> pago completo, el webhook todavia no llego
 */
export function decidirActivando(e: { sesionEsSuya: boolean; pagoCompleto: boolean; tieneAcceso: boolean }):
  "estudio" | "elegir" | "cancelado" | "esperar" {
  // Si ya tiene acceso, da igual de quien sea la sesion: el estudio la deja
  // pasar, asi que mandarla a elegir plan solo la haria rebotar.
  if (e.tieneAcceso) return "estudio";
  if (!e.sesionEsSuya) return "elegir";
  if (!e.pagoCompleto) return "cancelado";
  return "esperar";
}

export type MotivoSinAcceso = "primera" | "gratis_terminado" | "plan_terminado";

const ESTADOS_TERMINADOS = new Set(["canceled", "unpaid", "incomplete_expired", "paused"]);

/** Que decirle en /registro/plan. */
export function motivoSinAcceso(e: { gratisHasta: string | null; ultimaSuscripcion: string | null }, ahora: number = Date.now()): MotivoSinAcceso {
  if (e.ultimaSuscripcion && ESTADOS_TERMINADOS.has(e.ultimaSuscripcion)) return "plan_terminado";
  if (e.gratisHasta && Date.parse(e.gratisHasta) <= ahora) return "gratis_terminado";
  return "primera";
}
