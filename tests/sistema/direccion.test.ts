import { describe, expect, it } from "vitest";
import { aDireccion } from "../../src/lib/slug";

/**
 * La direccion que se genera sola a partir del nombre.
 *
 * Se ejercita la funcion, no se mira su texto: es pura y devuelve una cadena,
 * asi que no hay excusa para probarla de otra forma.
 */

describe("aDireccion", () => {
  it.each([
    ["Pack de iniciación", "pack-de-iniciacion"],
    ["Ballet Clásico", "ballet-clasico"],
    ["Ballet · Nivel 2", "ballet-nivel-2"],
    ["Fundamentos en 7 días", "fundamentos-en-7-dias"],
    ["  ¿Qué es el PBT?  ", "que-es-el-pbt"],
    ["Clase de Ballet — Lunes", "clase-de-ballet-lunes"],
    ["Piñata", "pinata"],
    ["Coreografía & Musicalidad", "coreografia-musicalidad"],
    ["MAYÚSCULAS", "mayusculas"],
    ["guiones---repetidos", "guiones-repetidos"],
    ["---bordes---", "bordes"],
    ["Pilates    Reformer", "pilates-reformer"],
  ])("%j -> %j", (entrada, esperado) => {
    expect(aDireccion(entrada)).toBe(esperado);
  });

  it("un texto sin letras ni numeros da cadena vacia, no basura", () => {
    // Asi el formulario puede exigirlo y Brunela ve el error del campo, en vez
    // de guardar una direccion que es solo guiones.
    expect(aDireccion("¿¡—·!?")).toBe("");
    expect(aDireccion("   ")).toBe("");
  });

  it("nunca empieza ni termina en guion", () => {
    for (const t of ["¿Hola?", "—Ballet—", "  x  ", "1. Primero"]) {
      const d = aDireccion(t);
      expect(d.startsWith("-"), `"${t}" -> "${d}"`).toBe(false);
      expect(d.endsWith("-"), `"${t}" -> "${d}"`).toBe(false);
    }
  });

  it("acota el largo sin cortar en un guion", () => {
    const largo = aDireccion("palabra ".repeat(40));
    expect(largo.length).toBeLessThanOrEqual(80);
    expect(largo.endsWith("-")).toBe(false);
  });

  it("solo produce minusculas, numeros y guiones", () => {
    const d = aDireccion("Ñandú ÉPICO 2026 · ¡Vamos!");
    expect(d).toMatch(/^[a-z0-9-]*$/);
  });
});
