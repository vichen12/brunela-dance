import { beforeAll, afterAll, describe, expect, it } from "vitest";
import {
  admin,
  crearAlumna,
  crearClase,
  crearClaseConPlanes,
  exigirMigracionDePlanes,
  limpiarResiduos,
  type Alumna,
} from "./ayudantes";

/**
 * Combinacion libre de planes (migracion 20260921).
 *
 * QUE CAMBIO
 *   Hasta ahora el acceso al catalogo era un RANGO: "de este plan para arriba".
 *   Ahora es una LISTA: `videos.planes_permitidos`, y la policy
 *   `videos_select_allowed_by_tier` pregunta por pertenencia, no por rango.
 *
 * 🔴 ESA POLICY PROTEGE EL CATALOGO ENTERO. Es la cuarta vez que se reescribe
 *    (phase_a, 20260728, packs, esta). Un `or` mal cerrado ahi lo abre para
 *    todas y no da ningun error.
 *
 * POR ESO EL PRIMER BLOQUE NO PRUEBA LA NOVEDAD: prueba que lo que andaba antes
 * siga andando igual. Es la misma forma que tiene packs.test.ts, por el mismo
 * motivo.
 *
 * Y TODAS LAS PRUEBAS TIENEN CONTROL POSITIVO: que una alumna no vea una clase
 * se satisface igual si el sistema esta caido, si la clase no se creo o si la
 * consulta esta mal escrita. Cada bloque comprueba tambien QUIEN SI la ve.
 */

let sinPlan: Alumna;
let corps: Alumna;
let solista: Alumna;
let principal: Alumna;

beforeAll(async () => {
  await exigirMigracionDePlanes();
  await limpiarResiduos();

  [sinPlan, corps, solista, principal] = await Promise.all([
    crearAlumna("none"),
    crearAlumna("corps_de_ballet"),
    crearAlumna("solista"),
    crearAlumna("principal"),
  ]);
}, 60_000);

afterAll(async () => {
  await limpiarResiduos();
}, 60_000);

/** Ve la clase con SU cliente, o sea pasando por RLS. */
async function ve(alumna: Alumna, videoId: string): Promise<boolean> {
  const { data } = await alumna.cliente.from("videos").select("id").eq("id", videoId).maybeSingle();
  return data !== null;
}

describe("lo que andaba antes sigue andando", () => {
  it("una clase creada con solo el tier viejo se ve de ese plan para arriba", async () => {
    const clase = await crearClase("solista");

    // Control positivo primero: si estos dos fueran false, los dos de abajo
    // pasarian por el motivo equivocado.
    expect(await ve(solista, clase.id)).toBe(true);
    expect(await ve(principal, clase.id)).toBe(true);

    expect(await ve(corps, clase.id)).toBe(false);
    expect(await ve(sinPlan, clase.id)).toBe(false);
  });

  it("el trigger le arma la lista a una clase que solo trajo el tier", async () => {
    const clase = await crearClase("solista");

    const { data } = await admin()
      .from("videos")
      .select("planes_permitidos")
      .eq("id", clase.id)
      .single<{ planes_permitidos: string[] }>();

    expect(data?.planes_permitidos).toEqual(["solista", "principal"]);
  });

  it("sin plan no se ve nada, ni lo mas barato", async () => {
    const clase = await crearClase("corps_de_ballet");

    expect(await ve(corps, clase.id)).toBe(true); // control positivo
    expect(await ve(sinPlan, clase.id)).toBe(false);
  });

  it("un borrador no lo ve nadie, aunque su plan lo tenga permitido", async () => {
    const clase = await crearClaseConPlanes(["corps_de_ballet", "solista", "principal"], {
      status: "draft",
    });

    expect(await ve(corps, clase.id)).toBe(false);
    expect(await ve(solista, clase.id)).toBe(false);
    expect(await ve(principal, clase.id)).toBe(false);
  });
});

describe("la combinacion libre", () => {
  it("{corps, principal} deja a Solista afuera -- que es todo el punto", async () => {
    const clase = await crearClaseConPlanes(["corps_de_ballet", "principal"]);

    // Control positivo: los dos elegidos la ven.
    expect(await ve(corps, clase.id)).toBe(true);
    expect(await ve(principal, clase.id)).toBe(true);

    // 🔴 Esto es lo que el rango NO podia expresar. Si esto da true, la policy
    //    volvio a comparar rangos y la combinacion libre no existe.
    expect(await ve(solista, clase.id)).toBe(false);
  });

  it("un solo plan es un solo plan, ni el de arriba", async () => {
    const clase = await crearClaseConPlanes(["solista"]);

    expect(await ve(solista, clase.id)).toBe(true); // control positivo
    expect(await ve(corps, clase.id)).toBe(false);
    expect(await ve(principal, clase.id)).toBe(false);
  });

  it("los tres planes la ven cuando estan los tres", async () => {
    const clase = await crearClaseConPlanes(["corps_de_ballet", "solista", "principal"]);

    expect(await ve(corps, clase.id)).toBe(true);
    expect(await ve(solista, clase.id)).toBe(true);
    expect(await ve(principal, clase.id)).toBe(true);
    expect(await ve(sinPlan, clase.id)).toBe(false);
  });

  it("sacar un plan de la lista le saca la clase a esa alumna", async () => {
    const clase = await crearClaseConPlanes(["corps_de_ballet", "solista"]);
    expect(await ve(corps, clase.id)).toBe(true);

    await admin()
      .from("videos")
      .update({ planes_permitidos: ["solista"] })
      .eq("id", clase.id);

    expect(await ve(solista, clase.id)).toBe(true); // control positivo
    expect(await ve(corps, clase.id)).toBe(false);
  });
});

describe("membership_tier_required queda derivada y no manda", () => {
  it("se pone en el plan MAS BAJO de la lista", async () => {
    const clase = await crearClaseConPlanes(["principal", "corps_de_ballet"]);

    const { data } = await admin()
      .from("videos")
      .select("membership_tier_required")
      .eq("id", clase.id)
      .single<{ membership_tier_required: string }>();

    expect(data?.membership_tier_required).toBe("corps_de_ballet");
  });

  it("escribir el tier a secas reconstruye la lista con la regla vieja", async () => {
    const clase = await crearClaseConPlanes(["principal"]);

    await admin()
      .from("videos")
      .update({ membership_tier_required: "corps_de_ballet" })
      .eq("id", clase.id);

    const { data } = await admin()
      .from("videos")
      .select("planes_permitidos")
      .eq("id", clase.id)
      .single<{ planes_permitidos: string[] }>();

    expect(data?.planes_permitidos).toEqual(["corps_de_ballet", "solista", "principal"]);
  });

  it("si la escritura trae las dos cosas, gana la lista", async () => {
    // El formulario manda la lista; que alguien mande ademas un tier que no
    // corresponde no puede cambiar quien ve la clase.
    const marca = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const { data } = await admin()
      .from("videos")
      .insert({
        slug: `zz-test-clase-${marca}`,
        title_i18n: { es: `zz-test-clase ${marca}` },
        status: "published",
        planes_permitidos: ["principal"],
        membership_tier_required: "corps_de_ballet",
        duration_seconds: 60,
        published_at: new Date().toISOString(),
      })
      .select("id, membership_tier_required, planes_permitidos")
      .single<{ id: string; membership_tier_required: string; planes_permitidos: string[] }>();

    expect(data?.planes_permitidos).toEqual(["principal"]);
    expect(data?.membership_tier_required).toBe("principal");
    expect(await ve(corps, data!.id)).toBe(false);
    expect(await ve(principal, data!.id)).toBe(true); // control positivo
  });
});

describe("la base rechaza las listas que no pueden existir", () => {
  it("una lista vacia no entra", async () => {
    const clase = await crearClaseConPlanes(["solista"]);

    const { error } = await admin()
      .from("videos")
      .update({ planes_permitidos: [] })
      .eq("id", clase.id);

    // 23514 = check constraint. El codigo exacto, no "hubo error": un error de
    // tipo o de columna inexistente satisfaria igual un `not.toBeNull()`.
    expect(error?.code).toBe("23514");
  });

  it("'none' en la lista no entra -- seria el catalogo abierto", async () => {
    const clase = await crearClaseConPlanes(["solista"]);

    const { error } = await admin()
      .from("videos")
      .update({ planes_permitidos: ["none", "solista"] })
      .eq("id", clase.id);

    expect(error?.code).toBe("23514");
  });
});

describe("una alumna no puede escribir el acceso de una clase", () => {
  it("ni cambiarse la lista de planes a mano", async () => {
    const clase = await crearClaseConPlanes(["principal"]);

    const { error } = await corps.cliente
      .from("videos")
      .update({ planes_permitidos: ["corps_de_ballet"] })
      .eq("id", clase.id);

    // 42501 = permission denied. `authenticated` no tiene UPDATE sobre videos
    // (migracion 18), asi que ni siquiera llega a evaluarse una policy.
    expect(error?.code).toBe("42501");
    expect(await ve(corps, clase.id)).toBe(false);
  });
});
