import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  claveMes, contarDelMes, cuandoPrivada, estadoVisible, inicioDelMes, isoAMadrid, madridAIso, mensajeAgendada, proximaDe,
  validarAgenda, ventanaUnirse, type SesionPrivada,
} from "../../src/features/studio/sesiones-privadas-reglas";

/**
 * Sesiones privadas 1 a 1 (migracion 20261009_2_sesiones_privadas.sql).
 *
 * Leen codigo y calculan fechas: NO prueban la base. Lo que la base hace (que
 * una alumna no pueda escribir) se verifica con el bloque comentado al final
 * de la migracion.
 */

const leer = (p: string) => readFileSync(p, "utf8");
const sinComentarios = (s: string) => s.replace(/--[^\n]*/g, "");

const ses = (o: Partial<SesionPrivada>): SesionPrivada => ({
  id: "x", alumna_id: "a", starts_at: "2026-10-16T16:00:00.000Z", duracion_minutos: 60,
  enlace: null, proveedor: null, nota: null, estado: "agendada", ...o,
});

describe("hora de Madrid", () => {
  it("18:00 de Madrid en octubre (verano, +2) son las 16:00 UTC", () => {
    expect(madridAIso("2026-10-16", "18:00")).toBe("2026-10-16T16:00:00.000Z");
  });

  it("18:00 de Madrid en noviembre (invierno, +1) son las 17:00 UTC", () => {
    expect(madridAIso("2026-11-16", "18:00")).toBe("2026-11-16T17:00:00.000Z");
  });

  it("el dia del cambio de hora (25 oct 2026) tambien cuadra", () => {
    expect(madridAIso("2026-10-25", "10:00")).toBe("2026-10-25T09:00:00.000Z");
    expect(isoAMadrid("2026-10-25T09:00:00.000Z")).toEqual({ fecha: "2026-10-25", hora: "10:00" });
  });

  it("ida y vuelta: lo que se guarda es lo que se vuelve a mostrar en el formulario", () => {
    for (const [f, h] of [["2026-03-29", "09:30"], ["2026-12-31", "23:45"], ["2027-01-01", "00:15"]]) {
      expect(isoAMadrid(madridAIso(f, h)!)).toEqual({ fecha: f, hora: h });
    }
  });

  it("rechaza fechas que no existen", () => {
    expect(madridAIso("2026-11-31", "10:00")).toBeNull();
    expect(madridAIso("2026-10-16", "25:00")).toBeNull();
    expect(madridAIso("", "10:00")).toBeNull();
  });
});

describe("el cupo del mes (X/2)", () => {
  it("cuenta agendadas y hechas del mes, no las canceladas", () => {
    const lista = [
      ses({ id: "1", starts_at: "2026-10-02T16:00:00Z" }),
      ses({ id: "2", starts_at: "2026-10-20T16:00:00Z", estado: "hecha" }),
      ses({ id: "3", starts_at: "2026-10-22T16:00:00Z", estado: "cancelada" }),
      ses({ id: "4", starts_at: "2026-11-02T16:00:00Z" }),
    ];
    expect(contarDelMes(lista, "2026-10")).toBe(2);
    expect(contarDelMes(lista, "2026-11")).toBe(1);
  });

  it("el mes es el de Madrid: el 31 a las 23:30 de Madrid es de ese mes", () => {
    // 31 oct 23:30 Madrid (invierno, +1) = 31 oct 22:30 UTC.
    const s = ses({ starts_at: "2026-10-31T22:30:00Z" });
    expect(claveMes(s.starts_at)).toBe("2026-10");
    // 1 nov 00:30 Madrid = 31 oct 23:30 UTC: ya es noviembre.
    expect(claveMes("2026-10-31T23:30:00Z")).toBe("2026-11");
  });

  it("el inicio del mes es la medianoche de Madrid del dia 1", () => {
    expect(inicioDelMes(Date.parse("2026-10-09T10:00:00Z"))).toBe("2026-09-30T22:00:00.000Z");
  });
});

describe("el boton Unirse", () => {
  const s = ses({ starts_at: "2026-10-16T16:00:00Z", duracion_minutos: 60 });
  const t = (iso: string) => Date.parse(iso);

  it("antes de los 15 minutos previos, todavia no", () => {
    expect(ventanaUnirse(s, t("2026-10-16T15:44:00Z"))).toBe("antes");
  });
  it("desde 15 minutos antes y hasta que termina, si", () => {
    expect(ventanaUnirse(s, t("2026-10-16T15:45:00Z"))).toBe("abierta");
    expect(ventanaUnirse(s, t("2026-10-16T16:59:00Z"))).toBe("abierta");
  });
  it("cuando termina, se apaga", () => {
    expect(ventanaUnirse(s, t("2026-10-16T17:00:00Z"))).toBe("terminada");
  });
  it("una agendada que ya termino se muestra como hecha", () => {
    expect(estadoVisible(s, t("2026-10-16T17:01:00Z"))).toBe("hecha");
    expect(estadoVisible({ ...s, estado: "cancelada" }, t("2026-10-16T17:01:00Z"))).toBe("cancelada");
  });
  it("la proxima es la agendada mas cercana que no termino, nunca una cancelada", () => {
    const lista = [
      ses({ id: "vieja", starts_at: "2026-10-01T16:00:00Z" }),
      ses({ id: "cancelada", starts_at: "2026-10-17T16:00:00Z", estado: "cancelada" }),
      ses({ id: "lejos", starts_at: "2026-10-30T16:00:00Z" }),
      ses({ id: "cerca", starts_at: "2026-10-20T16:00:00Z" }),
    ];
    expect(proximaDe(lista, t("2026-10-16T12:00:00Z"))?.id).toBe("cerca");
  });
});

describe("el formulario de agendar", () => {
  const ahora = Date.parse("2026-10-09T10:00:00Z");
  const base = { fecha: "2026-10-16", hora: "18:00", duracion: "60", enlace: "", nota: "" };

  it("acepta lo minimo, sin enlace", () => {
    const v = validarAgenda(base, { ahora });
    expect("ok" in v && v.ok.startsAt).toBe("2026-10-16T16:00:00.000Z");
    expect("ok" in v && v.ok.enlace).toBeNull();
  });
  it("deduce el proveedor del enlace", () => {
    const v = validarAgenda({ ...base, enlace: "https://meet.google.com/abc-defg-hij" }, { ahora });
    expect("ok" in v && v.ok.proveedor).toBe("meet");
  });
  it("rechaza http y cosas que no son enlaces", () => {
    expect("fallo" in validarAgenda({ ...base, enlace: "http://zoom.us/j/1" }, { ahora })).toBe(true);
    expect("fallo" in validarAgenda({ ...base, enlace: "javascript:alert(1)" }, { ahora })).toBe(true);
  });
  it("rechaza el pasado al agendar, pero no al editar", () => {
    expect("fallo" in validarAgenda({ ...base, fecha: "2026-10-01" }, { ahora })).toBe(true);
    expect("ok" in validarAgenda({ ...base, fecha: "2026-10-01" }, { ahora, permitirPasado: true })).toBe(true);
  });
  it("la duracion va de 15 a 240", () => {
    expect("fallo" in validarAgenda({ ...base, duracion: "10" }, { ahora })).toBe(true);
    expect("fallo" in validarAgenda({ ...base, duracion: "300" }, { ahora })).toBe(true);
  });
  it("el mensaje al chat dice el dia y la hora de Madrid", () => {
    expect(mensajeAgendada("2026-10-16T16:00:00.000Z", false)).toContain("viernes 16 de octubre a las 18:00");
  });
});

describe("los recordatorios de la admin", () => {
  const ahora = Date.parse("2026-10-16T15:00:00Z"); // 17:00 en Madrid
  it("a menos de una hora, en minutos", () => {
    expect(cuandoPrivada("2026-10-16T15:45:00Z", ahora).texto).toBe("en 45 min");
    expect(cuandoPrivada("2026-10-16T16:00:00Z", ahora).texto).toBe("en 1 h");
  });
  it("mas lejos, dia y hora de Madrid", () => {
    expect(cuandoPrivada("2026-10-16T18:00:00Z", ahora).texto).toBe("hoy a las 20:00");
    expect(cuandoPrivada("2026-10-17T08:00:00Z", ahora).texto).toBe("mañana a las 10:00");
  });
  it("ya empezada, ahora", () => {
    expect(cuandoPrivada("2026-10-16T14:50:00Z", ahora)).toMatchObject({ texto: "ahora", enCurso: true });
  });
});

describe("la base y el panel", () => {
  const sql = sinComentarios(leer("supabase/migrations/20261009_2_sesiones_privadas.sql"));

  it("la migracion no trae begin/commit propios (trampa 7)", () => {
    expect(sql).not.toMatch(/^\s*(begin|commit)\s*;/im);
  });

  it("RLS activa, una sola policy y es de SELECT", () => {
    expect(sql).toMatch(/alter table public\.sesiones_privadas enable row level security/);
    const policies = [...sql.matchAll(/create policy\s+"[^"]+"\s+on public\.sesiones_privadas\s+for (\w+)/g)].map((m) => m[1]);
    expect(policies).toEqual(["select"]);
  });

  it("authenticated solo puede leer; anon nada", () => {
    expect(sql).toMatch(/revoke all on public\.sesiones_privadas from anon, authenticated;/);
    const grants = [...sql.matchAll(/grant\s+([\w\s,]+?)\s+on\s+public\.sesiones_privadas\s+to\s+(\w+)/g)].map((m) => `${m[1]}->${m[2]}`);
    expect(grants).toEqual(["select->authenticated"]);
  });

  it("cada action llama a requireAdmin ANTES que nada (trampa 4)", () => {
    const src = leer("src/features/admin/sesiones-privadas-actions.ts");
    const encontradas = [...src.matchAll(/export async function (\w+)\([^)]*\)[^{]*\{\s*\n\s*(.+)/g)];
    // Control: si el patron no encuentra las tres, la prueba no esta probando nada.
    expect(encontradas.map((m) => m[1]).sort()).toEqual(["agendarSesionPrivadaAction", "cancelarSesionPrivadaAction", "editarSesionPrivadaAction"]);
    for (const m of encontradas) {
      expect(m[2], `${m[1]} no empieza por requireAdmin()`).toMatch(/requireAdmin\(\)/);
    }
  });

  it("el chat directo NO vive en un archivo 'use server' (seria un endpoint publico)", () => {
    expect(leer("src/features/admin/chat-directo.ts")).not.toMatch(/^\s*["']use server["']/m);
  });

  it("el lado de la alumna lee con SU cliente y filtra por su id", () => {
    const src = leer("src/features/studio/sesiones-privadas.ts");
    expect(src).toContain("createSupabaseServerClient");
    expect(src).not.toContain("createSupabaseAdminClient");
    expect(src).toMatch(/\.eq\("alumna_id", userId\)/);
  });

  it("todas las lecturas toleran que falte la tabla", () => {
    for (const p of [
      "src/features/studio/sesiones-privadas.ts",
      "src/features/admin/recordatorios.ts",
      "app/admin/sesiones-privadas/page.tsx",
      "app/admin/users/[id]/page.tsx",
    ]) {
      expect(leer(p), p).toContain("esFaltaDeTabla");
    }
  });
});
