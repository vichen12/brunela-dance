import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  errorSoloPara, esFaltaDeColumnaPlanes, leerPlanesDeCompra, normalizarPlanesDeCompra, planesDeCompraEnTexto,
  puedeComprarPack, textoSoloPara,
} from "../../src/features/studio/packs-reglas";

/**
 * Packs restringidos a planes (20261009_4_packs_por_plan.sql).
 *
 * "Poder crear un pack para un determinado plan, pero que por defecto se pueda
 * comprar en todos los planes." La regla es pura y se prueba aca; donde se
 * IMPONE (crearCheckoutDePack) se comprueba leyendo el codigo, porque es el
 * camino que cobra y no se llama a Stripe desde una prueba.
 */

const leer = (p: string) => readFileSync(p, "utf8");

describe("puedeComprarPack", () => {
  it("sin lista (NULL) lo compra cualquiera, tambien sin plan", () => {
    for (const tier of ["none", "corps_de_ballet", "solista", "principal", null, undefined]) {
      expect(puedeComprarPack(tier, null)).toBe(true);
      expect(puedeComprarPack(tier, undefined)).toBe(true);
    }
  });

  it("con lista, solo quien tiene uno de esos planes HOY", () => {
    const lista = ["solista", "principal"];
    expect(puedeComprarPack("solista", lista)).toBe(true);
    expect(puedeComprarPack("principal", lista)).toBe(true);
    expect(puedeComprarPack("corps_de_ballet", lista)).toBe(false);
    expect(puedeComprarPack("none", lista)).toBe(false);
    expect(puedeComprarPack(null, lista)).toBe(false);
    expect(puedeComprarPack("cualquier-cosa", lista)).toBe(false);
  });

  it("los tres planes NO son 'todas': quien no tiene plan queda afuera", () => {
    const tres = ["corps_de_ballet", "solista", "principal"];
    expect(puedeComprarPack("none", tres)).toBe(false);
    expect(puedeComprarPack("corps_de_ballet", tres)).toBe(true);
  });

  it("'none' dentro de la lista no habilita a quien no tiene plan (y la migracion lo prohibe)", () => {
    expect(puedeComprarPack("none", ["none", "solista"])).toBe(false);
  });

  it("una lista vacia o basura se lee como 'todas' (el CHECK no la deja guardar)", () => {
    expect(normalizarPlanesDeCompra([])).toBeNull();
    expect(normalizarPlanesDeCompra(["none"])).toBeNull();
    expect(normalizarPlanesDeCompra("solista")).toBeNull();
    expect(puedeComprarPack("none", [])).toBe(true);
  });
});

describe("textos", () => {
  it("nombra los planes en orden, no en el orden en que se tildaron", () => {
    expect(planesDeCompraEnTexto(["principal", "solista"])).toBe("Solista y Principal");
    expect(planesDeCompraEnTexto(["principal", "corps_de_ballet", "solista"])).toBe("Corps de Ballet, Solista y Principal");
    expect(textoSoloPara(["solista"])).toBe("Solo para alumnas de Solista");
    expect(textoSoloPara(null)).toBeNull();
  });

  it("el error del checkout es el pedido", () => {
    expect(errorSoloPara(["solista", "principal"])).toBe("Este pack es solo para alumnas de Solista y Principal.");
  });
});

describe("lo que manda el panel", () => {
  it("'todas' guarda NULL aunque vengan planes tildados de antes", () => {
    expect(leerPlanesDeCompra("todas", ["solista"])).toEqual({ ok: null });
    expect(leerPlanesDeCompra(null, [])).toEqual({ ok: null });
  });

  it("'planes' guarda la lista, ordenada y sin basura", () => {
    expect(leerPlanesDeCompra("planes", ["principal", "solista", "none", "x"])).toEqual({ ok: ["solista", "principal"] });
  });

  it("'planes' sin ninguno tildado es un error, no 'todas' en silencio", () => {
    const r = leerPlanesDeCompra("planes", []);
    expect("fallo" in r).toBe(true);
  });
});

describe("sin la migracion", () => {
  it("reconoce la columna que falta (42703) y nada mas", () => {
    expect(esFaltaDeColumnaPlanes({ code: "42703", message: "column packs.planes_que_pueden_comprar does not exist" })).toBe(true);
    expect(esFaltaDeColumnaPlanes({ code: "PGRST116", message: "otra cosa" })).toBe(false);
    expect(esFaltaDeColumnaPlanes(null)).toBe(false);
  });
});

describe("crearCheckoutDePack impone la regla", () => {
  const src = leer("src/lib/stripe/crear-checkout.ts");
  const pack = src.slice(src.indexOf("export async function crearCheckoutDePack"));

  it("la comprobacion va despues de 'ya lo tiene' y antes de crear la sesion de Stripe", () => {
    const ya = pack.indexOf('"Ya tenés este pack."');
    const regla = pack.indexOf("puedeComprarPack(");
    const stripe = pack.indexOf("stripe.checkout.sessions.create");
    expect(ya).toBeGreaterThan(0);
    expect(regla).toBeGreaterThan(ya);
    expect(stripe).toBeGreaterThan(regla);
  });

  it("responde 403 con el texto pedido", () => {
    expect(pack).toMatch(/status: 403, error: errorSoloPara\(soloPara\)/);
  });

  it("el plan sale del perfil de quien paga (la sesion), con service_role", () => {
    expect(pack).toMatch(/\.from\("profiles"\)\s*\.select\("membership_tier"\)\s*\.eq\("id", a\.user\.id\)/);
  });

  it("la columna NO va en el select principal del pack: sin la migracion romperia todos los packs", () => {
    const selectPrincipal = pack.slice(pack.indexOf('.from("packs")'), pack.indexOf("maybeSingle<PackFila>"));
    expect(selectPrincipal).not.toContain("planes_que_pueden_comprar");
  });

  it("sin la columna sigue (todas); con otro error frena", () => {
    expect(pack).toMatch(/errorRestriccion && !esFaltaDeColumnaPlanes\(errorRestriccion\)/);
  });
});

describe("la migracion", () => {
  const sql = leer("supabase/migrations/20261009_4_packs_por_plan.sql");
  const ejecutable = sql.split("\n").filter((l) => !l.trimStart().startsWith("--")).join("\n");

  it("cuenta con cardinality(), nunca con array_length (que da NULL y deja pasar)", () => {
    expect(ejecutable).toMatch(/cardinality\(planes_que_pueden_comprar\) >= 1/);
    expect(ejecutable).not.toMatch(/array_length/);
  });

  it("NULL por defecto: las filas existentes siguen siendo para todas", () => {
    expect(ejecutable).toMatch(/add column if not exists planes_que_pueden_comprar public\.membership_tier\[\];/);
    expect(ejecutable).not.toMatch(/not null/i);
  });

  it("sin begin/commit propios (trampa 7) y sin tocar policies ni la vista", () => {
    expect(ejecutable).not.toMatch(/^\s*(begin|commit)\s*;/im);
    expect(ejecutable).not.toMatch(/create (or replace )?(policy|view|function)/i);
  });

  it("esta en el orden de SETUP.md", () => {
    expect(leer("SETUP.md")).toContain("20261009_4_packs_por_plan.sql");
  });
});
