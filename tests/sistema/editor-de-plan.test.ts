import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  NOTA_DESCANSO_POR_DEFECTO,
  ajustarCantidad,
  borrarDiaYCorrer,
  casillerosDesdeDias,
  filasParaGuardar,
  leerCasilleros,
  llevarDiaA,
  moverDia,
  seQuitanConContenido,
  type CasilleroDia,
} from "../../src/features/studio/dias-de-plan";
import { armarPlanesDeTrabajo } from "../../src/features/admin/planes-de-trabajo";

/**
 * El editor de planes a pantalla completa (2026-10-25): /admin/programs/nuevo
 * y /admin/programs/[id]. Se crea un plan CON sus dias y se guarda todo junto.
 */

const leer = (p: string) => readFileSync(p, "utf8");

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const C = "33333333-3333-4333-8333-333333333333";
const clase = (videoId: string): CasilleroDia => ({ tipo: "clase", videoId });
const descanso = (nota = NOTA_DESCANSO_POR_DEFECTO): CasilleroDia => ({ tipo: "descanso", nota });
const vacio: CasilleroDia = { tipo: "vacio" };

describe("casilleros del editor", () => {
  it("un plan nuevo arranca con 7 dias vacios, y la cantidad agrega o recorta al final", () => {
    const siete = ajustarCantidad([], 7);
    expect(siete).toHaveLength(7);
    expect(siete.every((d) => d.tipo === "vacio")).toBe(true);
    expect(ajustarCantidad([clase(A), clase(B), clase(C)], 2)).toEqual([clase(A), clase(B)]);
    expect(ajustarCantidad([clase(A)], 0)).toHaveLength(1);
    expect(ajustarCantidad([], 9999)).toHaveLength(365);
  });

  it("avisa cuantos dias cargados se perderian al recortar", () => {
    expect(seQuitanConContenido([clase(A), vacio, descanso(), clase(B)], 2)).toBe(2);
    expect(seQuitanConContenido([clase(A), vacio, vacio], 1)).toBe(0);
  });

  it("subir y bajar intercambian con el de al lado, sin salirse", () => {
    const d = [clase(A), descanso(), clase(B)];
    expect(moverDia(d, 2, -1)).toEqual([clase(A), clase(B), descanso()]);
    expect(moverDia(d, 0, -1)).toBe(d);
    expect(moverDia(d, 2, 1)).toBe(d);
  });

  it("llevar un dia a otro numero corre los del medio", () => {
    expect(llevarDiaA([clase(A), clase(B), clase(C)], 0, 3)).toEqual([clase(B), clase(C), clase(A)]);
    expect(llevarDiaA([clase(A), clase(B), clase(C)], 2, 1)).toEqual([clase(C), clase(A), clase(B)]);
    expect(llevarDiaA([clase(A), clase(B)], 0, 99)).toEqual([clase(B), clase(A)]);
  });

  it("sacar un dia corre los siguientes y nunca deja el plan sin dias", () => {
    expect(borrarDiaYCorrer([clase(A), descanso(), clase(B)], 1)).toEqual([clase(A), clase(B)]);
    expect(borrarDiaYCorrer([clase(A)], 0)).toEqual([clase(A)]);
  });

  it("al guardar, los vacios no se escriben y el texto por defecto va como null", () => {
    const filas = filasParaGuardar([clase(A), vacio, descanso(), descanso("Estirá suave")]);
    expect(filas).toEqual([
      { day_number: 1, video_id: A, es_descanso: false, nota: null },
      { day_number: 3, video_id: null, es_descanso: true, nota: null },
      { day_number: 4, video_id: null, es_descanso: true, nota: "Estirá suave" },
    ]);
    // Cada fila cumple el CHECK clase-o-descanso: exactamente una de las dos.
    for (const f of filas) expect((f.video_id !== null) !== f.es_descanso).toBe(true);
  });

  it("ida y vuelta con la base: huecos como vacios, descanso con su nota", () => {
    const desdeBase = casillerosDesdeDias(
      [
        { day_number: 1, video_id: A },
        { day_number: 3, video_id: null, es_descanso: true, nota: null },
        { day_number: 4, video_id: null, es_descanso: true, nota: "Caminá" },
      ],
      5
    );
    expect(desdeBase).toEqual([clase(A), vacio, descanso(), descanso("Caminá"), vacio]);
    expect(filasParaGuardar(desdeBase).map((f) => f.day_number)).toEqual([1, 3, 4]);
  });

  it("rechaza ENTERO un JSON de dias con forma rara", () => {
    expect(leerCasilleros(JSON.stringify([clase(A), vacio, descanso("x")]))).toHaveLength(3);
    expect(leerCasilleros("no es json")).toBeNull();
    expect(leerCasilleros("[]")).toBeNull();
    expect(leerCasilleros(JSON.stringify([{ tipo: "clase", videoId: "'; drop table" }]))).toBeNull();
    expect(leerCasilleros(JSON.stringify([{ tipo: "otro" }]))).toBeNull();
    expect(leerCasilleros(JSON.stringify(Array.from({ length: 366 }, () => vacio)))).toBeNull();
  });
});

describe("guardar el plan entero", () => {
  const src = leer("src/features/admin/dias-de-plan-actions.ts");
  const cuerpo = (nombre: string) => {
    const desde = src.indexOf(`export async function ${nombre}`);
    const hasta = src.indexOf("export async function", desde + 10);
    return src.slice(desde, hasta < 0 ? undefined : hasta);
  };

  it.each(["guardarPlanCompletoAction", "borrarPlanAction", "ponerClaseEnDiaDePlanAction"])(
    "%s llama requireAdmin() antes de tocar service_role (trampa 4)",
    (nombre) => {
      const c = cuerpo(nombre);
      expect(c.length).toBeGreaterThan(0);
      expect(c.indexOf("await requireAdmin()")).toBeGreaterThan(-1);
      expect(c.indexOf("await requireAdmin()")).toBeLessThan(c.indexOf("createSupabaseAdminClient()"));
    }
  );

  it("la duracion del plan sale de los casilleros, no de un campo aparte", () => {
    expect(cuerpo("guardarPlanCompletoAction")).toMatch(/duration_days: casilleros\.length/);
  });

  it("escribe los dias y DESPUES borra los vacios, sin borrar los que se intentaron escribir", () => {
    const c = cuerpo("guardarPlanCompletoAction");
    const upsert = c.indexOf('from("program_days").upsert(conPlan');
    const borrado = c.indexOf('from("program_days").delete()');
    expect(upsert).toBeGreaterThan(-1);
    expect(borrado).toBeGreaterThan(upsert);
    expect(c).toMatch(/const quedan = conPlan\.map\(\(f\) => f\.day_number\)/);
  });

  it("poner una clase desde el panel de la clase pisa el descanso en vez de chocar con el CHECK", () => {
    const c = cuerpo("ponerClaseEnDiaDePlanAction");
    expect(c).toMatch(/es_descanso: false, nota: null/);
    expect(leer("components/clase-en-planes.tsx")).toContain("formAction={ponerClaseEnDiaDePlanAction}");
    expect(leer("components/clase-en-planes.tsx")).not.toContain("agregarClaseAPlanAction}");
  });

  it("la subida con plan tambien pisa el descanso", () => {
    expect(leer("app/api/admin/videos/finalize/route.ts")).toMatch(/es_descanso: false, nota: null/);
  });

  it("el panel de la clase sabe que dias son descanso", () => {
    const { paraElegir } = armarPlanesDeTrabajo(
      [{ id: "p", title_i18n: { es: "Pies" }, duration_days: 5 }],
      [
        { id: "1", program_id: "p", day_number: 1, video_id: A },
        { id: "2", program_id: "p", day_number: 2, video_id: null },
      ]
    );
    expect(paraElegir[0].descansos).toEqual([2]);
    expect(paraElegir[0].proximoDia).toBe(3);
  });
});

describe("la lista y el editor", () => {
  it("cada tarjeta tiene un solo boton «Editar» que lleva al editor", () => {
    const src = leer("app/admin/programs/page.tsx");
    expect(src).toMatch(/href=\{`\/admin\/programs\/\$\{program\.id\}`\}/);
    expect(src).not.toContain("Editar y días");
    expect(src).not.toContain("?nueva=1");
    expect(src).toContain("/admin/programs/nuevo");
  });

  it("las dos paginas del editor exigen admin", () => {
    for (const p of ["app/admin/programs/[id]/page.tsx", "app/admin/programs/nuevo/page.tsx"]) {
      expect(leer(p), p).toMatch(/await requireAdmin\(\)/);
    }
  });

  it("el editor no usa <form action> (React lo resetearia al guardar)", () => {
    const src = leer("components/editor-plan.tsx");
    const principal = src.slice(src.indexOf('<form ref={formRef}'), src.indexOf(">", src.indexOf('<form ref={formRef}')));
    expect(principal).toContain("onSubmit={enviar}");
    expect(principal).not.toContain("action=");
  });

  it("«lo terminaron» en analiticas no cuenta hasta un descanso", () => {
    const src = leer("src/features/admin/analitica/queries.ts");
    expect(src).toContain('from("program_days").select("program_id, day_number, video_id")');
    expect(src).toMatch(/if \(!d\.video_id\) continue;/);
  });
});
