import { readFileSync, existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  decidirActivando,
  destinoDeElegirPlan,
  destinoDelEstudio,
  motivoSinAcceso,
  onboardingPideElPago,
  tieneAccesoAlEstudio,
  RUTA_ELEGIR_PLAN,
  RUTA_ONBOARDING,
  type DatosDeAcceso,
} from "../../src/features/acceso/reglas";
import { diasDePrueba, intervaloInicial, planInicial, tarjetasDePlanes, PLAN_TEXTOS } from "../../src/features/planes/planes";
import {
  destinosPackPorDefecto,
  destinosSuscripcionPorDefecto,
  parametrosCheckoutPack,
  parametrosCheckoutSuscripcion,
} from "../../src/lib/stripe/parametros-checkout";

/**
 * El pago como ultimo paso del alta (pedido de la duena, 2026-10-09):
 * "quiero que se pague ahi mismo, y cuando este pagado que se abra la cuenta".
 *
 * Tres cosas que no pueden fallar en silencio:
 *   1. Quien NO tiene acceso no entra al estudio, y quien SI lo tiene no paga.
 *   2. Ningun estado deja a nadie rebotando entre /dashboard y /registro/*.
 *   3. La sesion de Stripe que arma el onboarding es la MISMA que la de
 *      siempre (prueba gratis, metadata, cupones, texto legal).
 */

const leer = (p: string) => readFileSync(p, "utf8");
const AHORA = Date.parse("2026-10-09T12:00:00Z");
const AYER = "2026-10-08T12:00:00Z";
const MANANA = "2026-10-10T12:00:00Z";

const base: DatosDeAcceso = { esAdmin: false, tier: "none", tienePack: false, gratisHasta: null };

// ── 1 · La regla de acceso ──────────────────────────────────────────────────

describe("tieneAccesoAlEstudio", () => {
  it("sin plan, sin pack y sin regalo: NO", () => {
    expect(tieneAccesoAlEstudio(base, AHORA)).toBe(false);
  });
  it.each(["corps_de_ballet", "solista", "principal"] as const)("con plan %s: SI (pago, prueba, gracia o regalo)", (tier) => {
    expect(tieneAccesoAlEstudio({ ...base, tier }, AHORA)).toBe(true);
  });
  it("con un pack comprado: SI (los packs son para siempre)", () => {
    expect(tieneAccesoAlEstudio({ ...base, tienePack: true }, AHORA)).toBe(true);
  });
  it("admin: SI, aunque no tenga plan", () => {
    expect(tieneAccesoAlEstudio({ ...base, esAdmin: true }, AHORA)).toBe(true);
  });
  it("acceso gratis vigente: SI, aunque el plan haya quedado en none", () => {
    expect(tieneAccesoAlEstudio({ ...base, gratisHasta: MANANA }, AHORA)).toBe(true);
  });
  it("acceso gratis VENCIDO y sin plan: NO", () => {
    expect(tieneAccesoAlEstudio({ ...base, gratisHasta: AYER }, AHORA)).toBe(false);
  });
});

describe("el onboarding solo cobra a quien no tiene acceso", () => {
  it("sin acceso: pide el pago", () => {
    expect(onboardingPideElPago({ esAdmin: false, tieneAcceso: false })).toBe(true);
  });
  it("alumna invitada con meses gratis / con pack / con plan: NO paga, entra", () => {
    expect(onboardingPideElPago({ esAdmin: false, tieneAcceso: true })).toBe(false);
  });
  it("admin: NO paga", () => {
    expect(onboardingPideElPago({ esAdmin: true, tieneAcceso: false })).toBe(false);
  });
});

// ── 2 · Sin bucles ──────────────────────────────────────────────────────────

/**
 * Simula la navegacion: cada pantalla decide con la MISMA funcion que usa el
 * codigo. Desde cualquier punto de entrada, en cualquier estado, la cadena de
 * redirecciones tiene que terminar en una pantalla que se muestra.
 */
function navegar(desde: string, e: { esAdmin: boolean; onboardingCompleto: boolean; tieneAcceso: boolean }) {
  const visto: string[] = [];
  let ruta: string | null = desde;
  while (ruta) {
    if (visto.includes(ruta)) throw new Error(`bucle: ${[...visto, ruta].join(" -> ")}`);
    visto.push(ruta);
    if (ruta === "/dashboard") ruta = destinoDelEstudio(e);
    else if (ruta === RUTA_ELEGIR_PLAN) ruta = destinoDeElegirPlan(e);
    // El onboarding: completado -> /dashboard; si no, se muestra.
    else if (ruta === RUTA_ONBOARDING) ruta = e.onboardingCompleto ? "/dashboard" : null;
    else ruta = null;
  }
  return visto[visto.length - 1];
}

describe("ninguna combinacion deja a nadie rebotando", () => {
  const estados: { esAdmin: boolean; onboardingCompleto: boolean; tieneAcceso: boolean }[] = [];
  for (const esAdmin of [false, true])
    for (const onboardingCompleto of [false, true])
      for (const tieneAcceso of [false, true]) estados.push({ esAdmin, onboardingCompleto, tieneAcceso });

  it.each(estados)("%o", (e) => {
    for (const desde of ["/dashboard", RUTA_ELEGIR_PLAN, RUTA_ONBOARDING]) {
      const final = navegar(desde, e);
      // Una admin sin onboarding que abre el onboarding a mano lo ve (puede
      // completarlo); desde cualquier otro lado entra al estudio.
      if (e.esAdmin) expect(final).toBe(desde === RUTA_ONBOARDING && !e.onboardingCompleto ? RUTA_ONBOARDING : "/dashboard");
      else if (!e.onboardingCompleto) expect(final).toBe(RUTA_ONBOARDING);
      else if (!e.tieneAcceso) expect(final).toBe(RUTA_ELEGIR_PLAN);
      else expect(final).toBe("/dashboard");
    }
  });

  it("la compuerta del estudio y /registro/plan son espejos", () => {
    for (const e of estados) {
      const estudioDejaPasar = destinoDelEstudio(e) === null;
      const planDevuelveAlEstudio = destinoDeElegirPlan(e) === "/dashboard";
      expect(planDevuelveAlEstudio, JSON.stringify(e)).toBe(estudioDejaPasar);
    }
  });
});

describe("/registro/activando", () => {
  it("con el acceso ya escrito: al estudio", () => {
    expect(decidirActivando({ sesionEsSuya: true, pagoCompleto: true, tieneAcceso: true })).toBe("estudio");
  });
  it("pago completo y el webhook todavia no llego: espera (NO da acceso)", () => {
    expect(decidirActivando({ sesionEsSuya: true, pagoCompleto: true, tieneAcceso: false })).toBe("esperar");
  });
  it("una sesion de OTRA persona no hace esperar ni abre nada", () => {
    expect(decidirActivando({ sesionEsSuya: false, pagoCompleto: true, tieneAcceso: false })).toBe("elegir");
  });
  it("pago sin completar: vuelve a elegir con el aviso", () => {
    expect(decidirActivando({ sesionEsSuya: true, pagoCompleto: false, tieneAcceso: false })).toBe("cancelado");
  });
  it("la pantalla no escribe en la base ni usa service_role", () => {
    const src = leer("app/registro/activando/page.tsx");
    expect(src).not.toMatch(/\.(update|insert|upsert|delete)\(/);
    expect(src).not.toMatch(/createSupabaseAdminClient|SERVICE_ROLE/);
    // Compara la sesion de Stripe con la de Supabase, no con la URL.
    expect(src).toMatch(/sesion\.metadata\?\.user_id === user\.id/);
    expect(src).toMatch(/sesion\.status === "complete"/);
    expect(src).toMatch(/http-?[eE]quiv|httpEquiv="refresh"/);
  });
});

describe("motivoSinAcceso", () => {
  it("primera vez", () => {
    expect(motivoSinAcceso({ gratisHasta: null, ultimaSuscripcion: null }, AHORA)).toBe("primera");
  });
  it("el regalo vencio", () => {
    expect(motivoSinAcceso({ gratisHasta: AYER, ultimaSuscripcion: null }, AHORA)).toBe("gratis_terminado");
  });
  it("la suscripcion se cancelo", () => {
    expect(motivoSinAcceso({ gratisHasta: null, ultimaSuscripcion: "canceled" }, AHORA)).toBe("plan_terminado");
  });
  it("un checkout abandonado (incomplete) no es 'tu plan termino'", () => {
    expect(motivoSinAcceso({ gratisHasta: null, ultimaSuscripcion: "incomplete" }, AHORA)).toBe("primera");
  });
});

describe("las pantallas usan la regla, no una copia", () => {
  it("el layout del estudio decide con destinoDelEstudio + tieneAccesoAlEstudio", () => {
    const src = leer("app/dashboard/layout.tsx");
    expect(src).toMatch(/destinoDelEstudio\(/);
    expect(src).toMatch(/tieneAccesoAlEstudio\(/);
    // Y que la decision se USE: calcularla y no redirigir no cierra nada.
    expect(src).toMatch(/if \(destino\) redirect\(destino as never\)/);
    // La baja del gratis vencido se aplica ANTES de decidir: si no, el layout y
    // /registro/plan podrian leer planes distintos.
    expect(src.indexOf("aplicarBajaSiVencio(")).toBeLessThan(src.indexOf("destinoDelEstudio("));
  });
  it("/registro/* NO esta bajo el layout del estudio", () => {
    expect(existsSync("app/registro/layout.tsx")).toBe(false);
    expect(existsSync("app/registro/plan/page.tsx")).toBe(true);
    expect(existsSync("app/registro/activando/page.tsx")).toBe(true);
  });
  it("leerAccesoAlEstudio aplica la baja antes de mirar el plan", () => {
    const src = leer("src/features/acceso/servidor.ts");
    expect(src.indexOf("aplicarBajaSiVencio(")).toBeLessThan(src.indexOf("tieneAccesoAlEstudio("));
  });
  it("el onboarding y /registro/plan cobran solo despues de mirar el acceso", () => {
    const src = leer("src/features/auth/registro.ts");
    for (const accion of ["completarOnboardingAction", "pagarPlanAction"]) {
      const ini = src.indexOf(`export async function ${accion}`);
      const cuerpo = src.slice(ini, src.indexOf("\nexport ", ini + 1) === -1 ? undefined : src.indexOf("\nexport ", ini + 1));
      expect(cuerpo, accion).toMatch(/requireUser\(\)/);
      expect(cuerpo.indexOf("onboardingPideElPago("), accion).toBeGreaterThan(-1);
      expect(cuerpo.indexOf("onboardingPideElPago("), accion).toBeLessThan(cuerpo.indexOf("irAlPago("));
    }
  });
  it("el onboarding muestra el paso del plan SOLO si pide el pago", () => {
    const src = leer("app/registro/onboarding/page.tsx");
    expect(src).toMatch(/onboardingPideElPago\(acceso\)/);
    expect(src).toMatch(/pidePago \? await cargarEleccionDePlan/);
    expect(src).toContain('"Entrar al estudio"');
  });
  it("el onboarding y /registro/plan usan las funciones de cobro compartidas", () => {
    const src = leer("src/features/auth/registro.ts");
    expect(src).toMatch(/crearCheckoutDeSuscripcion\(/);
    expect(src).toMatch(/crearCheckoutDePack\(/);
    expect(src).not.toMatch(/checkout\.sessions\.create|new Stripe\(/);
    expect(src).toMatch(/\/registro\/activando\?session_id=\{CHECKOUT_SESSION_ID\}/);
  });
  it("el selector de plan es server component (sin JS) con radios nativos", () => {
    const src = leer("components/elegir-plan.tsx");
    expect(src).not.toMatch(/["']use client["']/);
    expect(src).toMatch(/type="radio" name="plan"/);
    expect(src).toMatch(/type="radio" name="interval"/);
    expect(src).toMatch(/:has\(input\[name="interval"\]\[value="yearly"\]:checked\)/);
  });
});

// ── 3 · Catalogo -> tarjetas ────────────────────────────────────────────────

const CATALOGO = {
  currency: "eur",
  trial_days: 7,
  tiers: [
    { tier: "principal" as const, display_order: 3, amount_monthly: 59, amount_yearly: 559 },
    { tier: "corps_de_ballet" as const, display_order: 1, amount_monthly: 16, amount_yearly: 154 },
    { tier: "solista" as const, display_order: 2, amount_monthly: 31, amount_yearly: 299 },
  ],
};

describe("tarjetasDePlanes", () => {
  const t = tarjetasDePlanes(CATALOGO);
  it("respeta el orden del catalogo", () => {
    expect(t.map((x) => x.tier)).toEqual(["corps_de_ballet", "solista", "principal"]);
  });
  it("los importes salen del catalogo, no de una lista escrita a mano", () => {
    expect(t[0].mensual).toBe("16€");
    expect(t[0].anual).toBe("154€");
    expect(t[1].mensual).toBe("31€");
    expect(t[2].anual).toBe("559€");
    const otro = tarjetasDePlanes({ ...CATALOGO, tiers: [{ ...CATALOGO.tiers[2], amount_monthly: 9.9 }] });
    expect(otro[0].mensual).toBe("9,90€");
  });
  it("nombre y lo que incluye salen del texto compartido con /dashboard/plan", () => {
    expect(t[1].nombre).toBe(PLAN_TEXTOS.solista.nombre);
    expect(t[1].incluye).toEqual(PLAN_TEXTOS.solista.incluye);
    expect(leer("components/plan-client.tsx")).toMatch(/PLAN_TEXTOS\.solista\.incluye/);
  });
  it("calcula el equivalente mensual y el ahorro del anual", () => {
    expect(t[0].anualPorMes).toBe("12,80€");
    expect(t[0].ahorro).toBe(20); // 16*12=192 -> 154
  });
  it("un plan sin importe no se ofrece", () => {
    expect(tarjetasDePlanes({ ...CATALOGO, tiers: [{ ...CATALOGO.tiers[0], amount_monthly: 0 }] })).toEqual([]);
  });
  it("sin catalogo, nada", () => {
    expect(tarjetasDePlanes(null)).toEqual([]);
  });
  it("prueba gratis: la del catalogo, 7 si no dice", () => {
    expect(diasDePrueba(CATALOGO)).toBe(7);
    expect(diasDePrueba({ ...CATALOGO, trial_days: 14 })).toBe(14);
    expect(diasDePrueba(null)).toBe(7);
  });
  it("preselecciona el que venia eligiendo, o Solista", () => {
    expect(planInicial("principal", t)).toBe("principal");
    expect(planInicial(null, t)).toBe("solista");
    expect(planInicial("inventado", t)).toBe("solista");
    expect(intervaloInicial("yearly")).toBe("yearly");
    expect(intervaloInicial("cualquiera")).toBe("monthly");
  });
});

// ── 4 · Los parametros de Stripe no cambiaron ───────────────────────────────

describe("la sesion de suscripcion lleva todo lo de siempre", () => {
  const p = parametrosCheckoutSuscripcion({
    userId: "u1",
    tier: "solista",
    priceId: "price_x",
    trialDays: 7,
    customerId: "cus_1",
    destinos: destinosSuscripcionPorDefecto("https://x.test"),
  });
  it("modo, precio, cliente", () => {
    expect(p.mode).toBe("subscription");
    expect(p.line_items).toEqual([{ price: "price_x", quantity: 1 }]);
    expect(p.customer).toBe("cus_1");
  });
  it("prueba gratis y metadata en la SUSCRIPCION (de ahi la lee el webhook) y en la sesion", () => {
    expect(p.subscription_data?.trial_period_days).toBe(7);
    expect(p.subscription_data?.metadata).toEqual({ user_id: "u1", tier: "solista" });
    expect(p.metadata).toEqual({ user_id: "u1", tier: "solista" });
  });
  it("cupones y consentimiento legal", () => {
    expect(p.allow_promotion_codes).toBe(true);
    expect(JSON.stringify(p.custom_text)).toMatch(/desistimiento/);
  });
  it("las vueltas por defecto son las de /dashboard/plan", () => {
    expect(p.success_url).toBe("https://x.test/dashboard/plan?success=Suscripcion%20activada");
    expect(p.cancel_url).toBe("https://x.test/dashboard/plan?error=Pago%20cancelado");
  });
});

describe("la sesion del pack lleva todo lo de siempre", () => {
  const p = parametrosCheckoutPack({
    userId: "u1",
    pack: { id: "p1", slug: "pies" },
    priceId: "price_p",
    customerId: "cus_1",
    destinos: destinosPackPorDefecto("https://x.test"),
  });
  it("pago unico, sin suscripcion", () => {
    expect(p.mode).toBe("payment");
    expect(p.subscription_data).toBeUndefined();
  });
  it("la metadata va en la SESION: es lo unico que lee el webhook del pack", () => {
    expect(p.metadata).toEqual({ user_id: "u1", pack_id: "p1", pack_slug: "pies" });
  });
  it("cupones y consentimiento legal", () => {
    expect(p.allow_promotion_codes).toBe(true);
    expect(JSON.stringify(p.custom_text)).toMatch(/desistimiento/);
  });
  it("vuelve a la biblioteca con el aviso de siempre", () => {
    expect(p.success_url).toMatch(/^https:\/\/x\.test\/dashboard\/library\?success=/);
  });
});
