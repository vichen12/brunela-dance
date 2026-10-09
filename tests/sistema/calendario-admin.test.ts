import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  agruparPorDia, celdasDelMes, claveDia, diasDeLaSemana, esTablaInexistente, mesDeParametro, mesVecino,
  nombreMes, rangoConsultaMes, recortarCelda, sumarDiasClave, textoCupo, textoMas, textoPlanesVivo,
  type EventoCalendario,
} from "../../src/features/admin/calendario";

/**
 * Calendario de la admin (/admin/calendario y "Esta semana" en /admin).
 *
 * Calculan fechas y leen codigo: NO prueban la base.
 */

const leer = (p: string) => readFileSync(p, "utf8");
const ev = (id: string, inicio: string, tipo: EventoCalendario["tipo"] = "vivo"): EventoCalendario => ({
  id, tipo, inicio, titulo: id, href: "/x", detalle: "",
});

describe("los dias se cuentan en Madrid", () => {
  it("una clase a las 00:30 de Madrid cae ese dia, aunque en UTC sea el anterior", () => {
    // 00:30 del 10 de octubre en Madrid (CEST, +2) = 22:30 UTC del 9.
    expect(claveDia("2026-10-09T22:30:00Z")).toBe("2026-10-10");
  });

  it("en invierno la diferencia es una hora", () => {
    // 00:30 del 15 de diciembre en Madrid (CET, +1) = 23:30 UTC del 14.
    expect(claveDia("2026-12-14T23:30:00Z")).toBe("2026-12-15");
    expect(claveDia("2026-12-14T22:30:00Z")).toBe("2026-12-14");
  });

  it("agrupa por dia de Madrid y ordena por hora dentro del dia", () => {
    const g = agruparPorDia([
      ev("tarde", "2026-10-10T17:00:00Z"),
      ev("medianoche", "2026-10-09T22:30:00Z"),
      ev("ayer", "2026-10-09T10:00:00Z", "privada"),
    ]);
    expect([...g.keys()]).toEqual(["2026-10-09", "2026-10-10"]);
    expect(g.get("2026-10-10")!.map((e) => e.id)).toEqual(["medianoche", "tarde"]);
  });

  it("descarta lo que la consulta trajo de margen", () => {
    const g = agruparPorDia(
      [ev("sep", "2026-09-30T20:00:00Z"), ev("oct", "2026-10-01T08:00:00Z")],
      (k) => k.startsWith("2026-10"),
    );
    expect([...g.keys()]).toEqual(["2026-10-01"]);
  });

  it("el cambio de hora no se come ni duplica un dia de la semana", () => {
    // El 25 de octubre de 2026 Madrid pasa de +2 a +1.
    expect(diasDeLaSemana("2026-10-23")).toEqual([
      "2026-10-23", "2026-10-24", "2026-10-25", "2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29",
    ]);
    expect(sumarDiasClave("2026-12-31", 1)).toBe("2027-01-01");
  });
});

describe("la grilla del mes", () => {
  it("empieza en lunes y completa semanas enteras", () => {
    // 1 de octubre de 2026 es jueves: tres huecos (lun, mar, mie).
    const c = celdasDelMes("2026-10");
    expect(c.slice(0, 4)).toEqual([null, null, null, "2026-10-01"]);
    expect(c.length % 7).toBe(0);
    expect(c.filter(Boolean)).toHaveLength(31);
  });

  it("febrero bisiesto tiene 29", () => {
    expect(celdasDelMes("2028-02").filter(Boolean)).toHaveLength(29);
  });

  it("el rango de consulta cubre el mes de Madrid con margen", () => {
    const { desde, hasta } = rangoConsultaMes("2026-10");
    // 00:00 del 1 de octubre en Madrid = 22:00 UTC del 30 de septiembre.
    expect(Date.parse(desde)).toBeLessThanOrEqual(Date.parse("2026-09-30T22:00:00Z"));
    // 23:59 del 31 de octubre en Madrid (ya en +1) = 22:59 UTC del 31.
    expect(Date.parse(hasta)).toBeGreaterThan(Date.parse("2026-10-31T22:59:00Z"));
  });

  it("mes vecino cruza el año", () => {
    expect(mesVecino("2026-12", 1)).toBe("2027-01");
    expect(mesVecino("2026-01", -1)).toBe("2025-12");
  });

  it("un ?mes= raro vuelve al mes de hoy", () => {
    expect(mesDeParametro("2026-13", "2026-10-09")).toBe("2026-10");
    expect(mesDeParametro("cualquiera", "2026-10-09")).toBe("2026-10");
    expect(mesDeParametro("2027-02", "2026-10-09")).toBe("2027-02");
  });

  it("el nombre del mes va con mayuscula una sola vez", () => {
    expect(nombreMes("2026-10")).toBe("Octubre de 2026");
  });
});

describe("+N más", () => {
  it("hasta tres entran, con cuatro aparece +1 más", () => {
    expect(recortarCelda([1, 2, 3], 3)).toEqual({ visibles: [1, 2, 3], resto: 0 });
    expect(recortarCelda([1, 2, 3, 4], 3)).toEqual({ visibles: [1, 2, 3], resto: 1 });
    expect(recortarCelda([1, 2, 3, 4, 5, 6], 3).resto).toBe(3);
    expect(textoMas(0)).toBeNull();
    expect(textoMas(2)).toBe("+2 más");
  });
});

describe("textos de cada evento", () => {
  it("el cupo cuenta reservadas y, aparte, la lista de espera", () => {
    expect(textoCupo(8, 12)).toBe("8/12 anotadas");
    expect(textoCupo(12, 12, 2)).toBe("12/12 anotadas · completa · 2 en espera");
    expect(textoCupo(1, null)).toBe("1 anotada");
  });

  it("los planes salen del plan minimo de la sesion", () => {
    expect(textoPlanesVivo("corps_de_ballet")).toBe("Todos los planes");
    expect(textoPlanesVivo("solista")).toBe("Solista y Principal");
    expect(textoPlanesVivo("principal")).toBe("Solo Principal");
  });
});

describe("la tabla de sesiones privadas puede no existir todavia", () => {
  it("reconoce los tres modos en que avisa que falta", () => {
    expect(esTablaInexistente({ code: "42P01", message: 'relation "public.sesiones_privadas" does not exist' })).toBe(true);
    expect(esTablaInexistente({ code: "PGRST205", message: "Could not find the table 'public.sesiones_privadas' in the schema cache" })).toBe(true);
    expect(esTablaInexistente({ message: "Could not find the table 'public.sesiones_privadas'" })).toBe(true);
  });

  it("y no confunde otros errores con eso", () => {
    expect(esTablaInexistente(null)).toBe(false);
    expect(esTablaInexistente({ code: "42501", message: "permission denied for table sesiones_privadas" })).toBe(false);
  });

  it("la pagina no se cae: el error se mira, no se tira", () => {
    const src = leer("src/features/admin/calendario-datos.ts");
    expect(src).toMatch(/privadas\.error/);
    expect(src).toMatch(/esTablaInexistente\(privadas\.error\)/);
    expect(src).not.toMatch(/throw\s/);
  });
});

describe("guardas", () => {
  it("el modulo que usa service_role llama a requireAdmin (trampa 4)", () => {
    const src = leer("src/features/admin/calendario-datos.ts");
    expect(src).toMatch(/createSupabaseAdminClient\(\)/);
    const guarda = src.indexOf("await requireAdmin()");
    expect(guarda).toBeGreaterThan(-1);
    expect(guarda).toBeLessThan(src.indexOf("createSupabaseAdminClient()", src.indexOf("export async function")));
  });

  it("las sesiones canceladas no se piden", () => {
    expect(leer("src/features/admin/calendario-datos.ts")).toMatch(/\.neq\("estado", "cancelada"\)/);
  });

  it("la pagina del calendario exige admin", () => {
    expect(leer("app/admin/calendario/page.tsx")).toMatch(/await requireAdmin\(\)/);
  });

  it("el menu lleva Calendario justo despues de Resumen", () => {
    const src = leer("components/admin-sidebar.tsx");
    expect(src.indexOf('label: "Calendario"')).toBeGreaterThan(src.indexOf('label: "Resumen"'));
    expect(src.indexOf('label: "Calendario"')).toBeLessThan(src.indexOf('label: "Analíticas"'));
  });
});
