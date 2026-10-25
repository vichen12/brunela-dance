import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  NOTA_DESCANSO_MAX,
  NOTA_DESCANSO_POR_DEFECTO,
  avanceDelPlan,
  diasSinCargar,
  esFaltaDeColumnaDescanso,
  filtrarOpciones,
  normalizarBusqueda,
} from "../../src/features/studio/dias-de-plan";

/**
 * Planes de trabajo: buscador de clases, dias de descanso y su avance.
 * (2026-10-25, migracion 20261025_dia_de_descanso.sql)
 */

const leer = (p: string) => readFileSync(p, "utf8");

describe("buscador de clases", () => {
  const clases = [
    { value: "1", label: "Relevé en barra" },
    { value: "2", label: "Barra de pies" },
    { value: "3", label: "Giros: PIROUETTE en dehors" },
    { value: "4", label: "Estiramiento suave" },
  ];

  it("ignora tildes y mayusculas", () => {
    expect(normalizarBusqueda("  ReLEVÉ   en  Barra ")).toBe("releve en barra");
    expect(filtrarOpciones(clases, "releve").map((c) => c.value)).toEqual(["1"]);
    expect(filtrarOpciones(clases, "RELEVÉ").map((c) => c.value)).toEqual(["1"]);
    expect(filtrarOpciones(clases, "pirouette").map((c) => c.value)).toEqual(["3"]);
  });

  it("todas las palabras, en cualquier orden", () => {
    expect(filtrarOpciones(clases, "pies barra").map((c) => c.value)).toEqual(["2"]);
    expect(filtrarOpciones(clases, "barra").map((c) => c.value)).toEqual(["1", "2"]);
    expect(filtrarOpciones(clases, "barra giros")).toEqual([]);
  });

  it("vacio devuelve todas, sin copiar de menos", () => {
    expect(filtrarOpciones(clases, "")).toHaveLength(4);
    expect(filtrarOpciones(clases, "   ")).toHaveLength(4);
  });

  it("no toca <Desplegable>: el buscador es un componente aparte", () => {
    expect(leer("components/elegir-con-buscador.tsx")).toMatch(/export function ElegirConBuscador/);
    expect(leer("components/desplegable.tsx")).not.toMatch(/filtrarOpciones|buscador/i);
  });
});

describe("dia de descanso: avance", () => {
  // Plan: 1 clase, 2 clase, 3 descanso, 4 clase, 5 descanso
  const dias = [
    { day_number: 1 },
    { day_number: 2 },
    { day_number: 3, es_descanso: true },
    { day_number: 4 },
    { day_number: 5, es_descanso: true },
  ];
  const prog = (entradas: [number, boolean][]) =>
    new Map(entradas.map(([n, ok]) => [n, { is_completed: ok, completion_percent: ok ? 100 : 30 }]));

  it("un descanso cuenta en el total", () => {
    expect(avanceDelPlan(dias, prog([])).total).toBe(5);
  });

  it("al terminar el dia anterior, HOY es el descanso (no se saltea solo)", () => {
    const a = avanceDelPlan(dias, prog([[1, true], [2, true]]));
    expect(a.hoy?.day_number).toBe(3);
    expect(a.hecho.get(3)).toBe(false);
    expect(a.completos).toBe(2);
    // La tarjeta del descanso ofrece la proxima CLASE, no el proximo dia.
    expect(a.siguienteClase?.day_number).toBe(4);
  });

  it("se da por hecho en cuanto ella abre un dia posterior, aunque no lo termine", () => {
    const a = avanceDelPlan(dias, prog([[1, true], [2, true], [4, false]]));
    expect(a.hecho.get(3)).toBe(true);
    expect(a.hoy?.day_number).toBe(4);
    expect(a.completos).toBe(3);
  });

  it("un descanso al final se cierra al terminar todas las clases", () => {
    const a = avanceDelPlan(dias, prog([[1, true], [2, true], [4, true]]));
    expect(a.hecho.get(5)).toBe(true);
    expect(a.terminado).toBe(true);
    expect(a.completos).toBe(5);
    expect(a.hoy).toBeNull();
  });

  it("sin descansos, la regla es la de siempre: hecho = clase completada", () => {
    const solo = [{ day_number: 1 }, { day_number: 2 }];
    const a = avanceDelPlan(solo, prog([[1, true], [2, false]]));
    expect(a.completos).toBe(1);
    expect(a.hoy?.day_number).toBe(2);
    expect(a.terminado).toBe(false);
  });

  it("los huecos (numeros sin nada) son otra cosa: solo los lista el panel", () => {
    expect(diasSinCargar([1, 2, 3, 5, 6, 7, 8], 8)).toEqual([4]);
    expect(diasSinCargar([1, 2], 4)).toEqual([3, 4]);
    // Un dia cargado mas alla de la duracion estira el rango.
    expect(diasSinCargar([1, 6], 3)).toEqual([2, 3, 4, 5]);
  });

  it("el texto por defecto es el de Brunela, exacto, y entra en el CHECK", () => {
    expect(NOTA_DESCANSO_POR_DEFECTO).toBe(
      "Hoy también estás avanzando, aunque no entrenes. Dale a tu cuerpo el tiempo que necesita para recuperarse y volver con más energía. ¡Descansa, te lo mereces! 💗"
    );
    expect(NOTA_DESCANSO_POR_DEFECTO.length).toBeLessThanOrEqual(NOTA_DESCANSO_MAX);
  });

  it("reconoce la falta de migracion (42703 o columna desconocida) y nada mas", () => {
    expect(esFaltaDeColumnaDescanso({ code: "42703", message: "column program_days.es_descanso does not exist" })).toBe(true);
    expect(esFaltaDeColumnaDescanso({ code: "PGRST204", message: "Could not find the 'es_descanso' column of 'program_days'" })).toBe(true);
    expect(esFaltaDeColumnaDescanso({ code: "42501", message: "permission denied" })).toBe(false);
    expect(esFaltaDeColumnaDescanso(null)).toBe(false);
  });
});

describe("la migracion 20261025_dia_de_descanso.sql", () => {
  const sql = leer("supabase/migrations/20261025_dia_de_descanso.sql");
  // Sin los comentarios: lo que cuenta es lo que se ejecuta.
  const codigo = sql.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");

  it("exactamente una de las dos: clase o descanso", () => {
    expect(codigo).toMatch(/add constraint program_days_clase_o_descanso\s+check \(\(video_id is not null\) <> es_descanso\)/);
  });

  it("la nota se mide con char_length y tiene el mismo tope que la pantalla", () => {
    expect(codigo).toContain(`check (nota is null or char_length(nota) <= ${NOTA_DESCANSO_MAX})`);
  });

  it("no trae begin/commit propios (trampa 7)", () => {
    expect(codigo).not.toMatch(/^\s*(begin|commit)\s*;/im);
  });

  it("no redefine funciones ni policies (trampa 8)", () => {
    expect(codigo).not.toMatch(/create\s+(or\s+replace\s+)?(function|policy)/i);
    expect(codigo).not.toMatch(/drop\s+policy/i);
  });

  it("esta en el orden de SETUP.md", () => {
    expect(leer("SETUP.md")).toContain("20261025_dia_de_descanso.sql");
  });
});

describe("dia de descanso: pantallas", () => {
  it("la accion que guarda dias exige admin (trampa 4) y escribe las tres columnas juntas", () => {
    const src = leer("src/features/admin/dias-de-plan-actions.ts");
    const cuerpo = src.slice(src.indexOf("export async function guardarDiaDePlanAction"));
    expect(cuerpo.indexOf("await requireAdmin()")).toBeGreaterThan(-1);
    expect(cuerpo.indexOf("await requireAdmin()")).toBeLessThan(cuerpo.indexOf("createSupabaseAdminClient()"));
    expect(cuerpo).toMatch(/video_id: null, es_descanso: true, nota/);
    expect(cuerpo).toMatch(/es_descanso: false, nota: null/);
  });

  it("en la ficha un descanso no enlaza a ninguna clase", () => {
    const src = leer("app/dashboard/programs/[slug]/page.tsx");
    const fila = src.slice(src.indexOf("if (day.es_descanso) {"), src.indexOf("const clase = claseDe(day.videos);"));
    expect(fila.length, "no se encontro la fila del descanso").toBeGreaterThan(0);
    expect(fila).toContain("Día de descanso");
    expect(fila).not.toMatch(/<Link|href=/);
  });

  it("la pagina de venta sigue sin leer el dia por dia ni las notas", () => {
    const src = leer("app/dashboard/programs/[slug]/page.tsx");
    // Hasta el CSS: ahi hay clases como .pd-dia-nota, que no son datos.
    const bloqueada = src.slice(src.indexOf("async function PlanBloqueado"), src.indexOf("const CSS = `"));
    expect(bloqueada.length).toBeGreaterThan(0);
    expect(bloqueada).not.toContain("program_days");
    expect(bloqueada).not.toMatch(/\bnota\b|es_descanso/);
  });

  it("la vitrina no le pide a service_role ni la nota ni que dias son descanso", () => {
    const src = leer("app/dashboard/programs/page.tsx");
    const deAdmin = src.match(/admin\.from\("program_days"\)\.select\("([^"]*)"\)/)?.[1] ?? "";
    expect(deAdmin, "no se encontro la consulta de service_role").not.toBe("");
    for (const prohibido of ["nota", "es_descanso", "day_number"]) {
      expect(deAdmin).not.toMatch(new RegExp(`\\b${prohibido}\\b`));
    }
    // Los descansos se cuentan con el cliente DE LA ALUMNA (RLS).
    const fn = src.slice(src.indexOf("async function descansosHechos"));
    expect(fn).toMatch(/supabase\s*\.from\("program_days"\)/);
    expect(fn).not.toMatch(/admin\.from|createSupabaseAdminClient/);
  });

  it("la portada del plan se sube, no se pega", () => {
    const src = leer("components/editor-plan.tsx");
    expect(src).toMatch(/<SubirPortadaClase\s+name="coverImageUrl"/);
    expect(src).not.toMatch(/placeholder="https:\/\/…"/);
  });
});
