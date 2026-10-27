import { describe, expect, it } from "vitest";
import { resolveTierFromPrice } from "../../src/lib/stripe/plan-de-precio";

/**
 * Una alumna que se suscribio con un precio que despues Brunela cambio.
 * Su codigo ya no esta en el catalogo; el plan sale de la marca del precio.
 */
const catalogo = {
  currency: "eur",
  trial_days: 7,
  tiers: [
    { tier: "solista" as const, display_order: 2, amount_monthly: 35, amount_yearly: 340, prices: { test: { monthly: "price_nuevo", yearly: null }, live: { monthly: null, yearly: null } } },
  ],
};

describe("el webhook reconoce el plan de un precio reemplazado", () => {
  it("control positivo: el precio actual sale del catalogo", () => {
    expect(resolveTierFromPrice(catalogo, { id: "price_nuevo" })).toBe("solista");
  });
  it("un precio viejo, fuera del catalogo, sale por su marca", () => {
    expect(resolveTierFromPrice(catalogo, { id: "price_viejo", metadata: { tier: "solista" } })).toBe("solista");
  });
  it("sin marca y fuera del catalogo, no inventa un plan", () => {
    expect(resolveTierFromPrice(catalogo, { id: "price_viejo", metadata: {} })).toBeNull();
  });
  it("una marca que no es un plan no da acceso", () => {
    expect(resolveTierFromPrice(catalogo, { id: "price_x", metadata: { tier: "admin" } })).toBeNull();
  });
  it("el catalogo le gana a una marca vieja", () => {
    expect(resolveTierFromPrice(catalogo, { id: "price_nuevo", metadata: { tier: "principal" } })).toBe("solista");
  });
});
