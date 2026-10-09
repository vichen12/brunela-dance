import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  diasRestantes, estaVencido, nuevoVencimiento, progreso, sumarMeses, textoRestante, generarContrasena,
} from "../../src/features/studio/acceso-gratis-reglas";

/**
 * Acceso gratis por tiempo (migracion 20261009_acceso_gratis.sql).
 *
 * Estas pruebas leen codigo y calculan fechas: NO prueban la base. Lo que la
 * base hace (el trigger que impide que una alumna se regale un plan) se
 * verifica por comportamiento con el bloque comentado al final de la migracion.
 */

const leer = (p: string) => readFileSync(p, "utf8");
const sinComentarios = (s: string) => s.replace(/--[^\n]*/g, "");

describe("las fechas del regalo", () => {
  it("un mes desde el 31 de enero es fin de febrero, no 3 de marzo", () => {
    expect(sumarMeses(new Date("2027-01-31T12:00:00Z"), 1).toISOString().slice(0, 10)).toBe("2027-02-28");
    expect(sumarMeses(new Date("2028-01-31T12:00:00Z"), 1).toISOString().slice(0, 10)).toBe("2028-02-29");
    expect(sumarMeses(new Date("2026-10-09T12:00:00Z"), 12).toISOString().slice(0, 10)).toBe("2027-10-09");
  });

  it("extender suma desde el fin vigente, no desde hoy", () => {
    const ahora = new Date("2026-10-09T10:00:00Z");
    const fin = nuevoVencimiento("2026-10-20T10:00:00Z", "dias", 10, ahora);
    expect(fin.toISOString().slice(0, 10)).toBe("2026-10-30");
  });

  it("un regalo vencido vuelve a correr desde hoy", () => {
    const ahora = new Date("2026-10-09T10:00:00Z");
    const fin = nuevoVencimiento("2026-09-01T10:00:00Z", "meses", 1, ahora);
    expect(fin.toISOString().slice(0, 10)).toBe("2026-11-09");
  });

  it("los dias restantes son de calendario en Madrid", () => {
    // 23:30 en Madrid (21:30 UTC en octubre) y vence al dia siguiente a las 10.
    const ahora = Date.parse("2026-10-09T21:30:00Z");
    expect(diasRestantes("2026-10-10T08:00:00Z", ahora)).toBe(1);
    expect(textoRestante("2026-10-10T08:00:00Z", ahora)).toBe("termina mañana");
    expect(diasRestantes("2026-10-09T21:50:00Z", ahora)).toBe(0);
    expect(textoRestante("2026-10-21T08:00:00Z", ahora)).toBe("te quedan 12 días");
  });

  it("vencido es estricto, y sin fecha no hay vencimiento", () => {
    const ahora = Date.parse("2026-10-09T10:00:00Z");
    expect(estaVencido("2026-10-09T09:59:59Z", ahora)).toBe(true);
    expect(estaVencido("2026-10-09T10:00:01Z", ahora)).toBe(false);
    expect(estaVencido(null, ahora)).toBe(false);
  });

  it("la barra va de 0 a 100 y no se sale", () => {
    expect(progreso("2026-10-01T00:00:00Z", "2026-10-11T00:00:00Z", Date.parse("2026-10-06T00:00:00Z"))).toBe(50);
    expect(progreso("2026-10-01T00:00:00Z", "2026-10-11T00:00:00Z", Date.parse("2027-01-01T00:00:00Z"))).toBe(100);
    expect(progreso("2026-10-01T00:00:00Z", "2026-10-11T00:00:00Z", Date.parse("2026-01-01T00:00:00Z"))).toBe(0);
  });

  it("la contraseña provisoria no trae caracteres que se confunden al dictarla", () => {
    let i = 0;
    const c = generarContrasena((n) => (i++ * 7) % n);
    expect(c).toMatch(/^Bru-[a-zA-Z2-9]{10}$/);
    expect(c.slice(4)).not.toMatch(/[01lIoO]/);
  });
});

describe("una alumna no se puede regalar un plan", () => {
  const sql = sinComentarios(leer("supabase/migrations/20261009_acceso_gratis.sql"));

  it("la migracion no trae begin/commit propios (trampa 7)", () => {
    expect(sql).not.toMatch(/^\s*(begin|commit)\s*;/im);
  });

  it("el trigger conserva la guarda de service_role (trampa 1)", () => {
    expect(sql).toMatch(/if auth\.uid\(\) is not null and not public\.is_admin\(\) then/);
  });

  it("protege las columnas del regalo, y deja libre solo la marca del aviso", () => {
    for (const c of ["acceso_gratis_hasta", "acceso_gratis_desde", "acceso_gratis_plan", "acceso_gratis_otorgado_por"]) {
      expect(sql).toContain(`new.${c}`);
    }
    expect(sql).not.toContain("new.acceso_gratis_aviso_visto_at");
  });

  it("la funcion es una copia ENTERA de la vigente (trampa 8)", () => {
    for (const c of ["membership_tier", "is_admin", "email", "is_studio_owner"]) {
      expect(sql).toMatch(new RegExp(`new\\.${c}\\s*=\\s*old\\.${c}`));
    }
  });
});

describe("el panel y la baja", () => {
  it("cada action del acceso gratis llama a requireAdmin ANTES que nada", () => {
    const src = leer("src/features/admin/acceso-gratis-actions.ts");
    const encontradas = [...src.matchAll(/export async function (\w+)\([^)]*\)[^{]*\{\s*\n\s*(.+)/g)];
    // Control: si el patron no encuentra las tres, la prueba no esta probando nada.
    expect(encontradas.map((m) => m[1]).sort()).toEqual(["crearAlumnaGratisAction", "darAccesoGratisAction", "quitarAccesoGratisAction"]);
    for (const m of encontradas) {
      expect(m[2], `${m[1]} no empieza por requireAdmin()`).toMatch(/requireAdmin\(\)/);
    }
  });

  it("la contraseña provisoria no viaja en la URL", () => {
    const src = leer("src/features/admin/acceso-gratis-actions.ts");
    expect(src).not.toMatch(/redirect\([^)]*contrasena/);
  });

  it("la baja no toca a quien paga ni a una admin", () => {
    const src = leer("src/features/studio/acceso-gratis.ts");
    expect(src).toMatch(/conSuscripcionQueDaAcceso/);
    expect(src).toMatch(/\.eq\("is_admin", false\)/);
    // La fecha se conserva: es lo que muestra el aviso.
    expect(src).not.toMatch(/acceso_gratis_hasta:\s*null/);
  });

  it("las lecturas toleran que falte la migracion (42703)", () => {
    for (const f of ["src/features/studio/acceso-gratis.ts", "app/admin/users/page.tsx", "app/admin/users/[id]/page.tsx"]) {
      expect(leer(f), f).toMatch(/esFaltaDeMigracion/);
    }
    // Y la consulta principal de la lista NO pide esas columnas.
    expect(leer("app/admin/users/page.tsx")).not.toMatch(/select\("id, email, full_name, membership_tier[^"]*acceso_gratis/);
    expect(leer("src/features/auth/profile.ts")).not.toMatch(/acceso_gratis/);
  });

  it("el webhook cierra el regalo solo DESPUES de aplicar la suscripcion, y sin lanzar", () => {
    const src = leer("app/api/stripe/webhooks/route.ts");
    expect(src).toMatch(/if \(suscripcion\.applied\) await cerrarAccesoGratisSiPaga\(event\)/);
    const cuerpo = src.slice(src.indexOf("async function cerrarAccesoGratisSiPaga"), src.indexOf("export async function POST"));
    expect(cuerpo).not.toMatch(/throw /);
    expect(cuerpo).not.toMatch(/membership_tier/);
  });
});
