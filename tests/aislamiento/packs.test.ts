import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  admin,
  comprarPack,
  crearAlumna,
  crearClase,
  crearPack,
  exigirMigracionDePacks,
  limpiarResiduos,
  type Alumna,
} from "./ayudantes";

/**
 * Packs de clases.
 *
 * Un pack cambia la pregunta del sistema de "¿que plan tiene?" a "¿que plan
 * tiene O que compro?". Toca UNA policy -- videos_select_allowed_by_tier -- y
 * esa policy protege el catalogo ENTERO. Un `or` mal cerrado ahi lo abre para
 * todas, sin ningun error visible.
 *
 * Por eso el primer bloque de abajo no prueba los packs: prueba que lo que
 * andaba antes siga andando igual.
 */

let sinPlan: Alumna;
let otraSinPlan: Alumna;
let conPlan: Alumna;

let clasePrincipal: { id: string };
let claseSuelta: { id: string };
let pack: { id: string };

beforeAll(async () => {
  await exigirMigracionDePacks();
  await limpiarResiduos();

  [sinPlan, otraSinPlan, conPlan] = await Promise.all([
    crearAlumna("none"),
    crearAlumna("none"),
    crearAlumna("principal"),
  ]);

  // `clasePrincipal` va DENTRO del pack; `claseSuelta` queda afuera a proposito,
  // para comprobar que la compra no abre nada mas que lo comprado.
  [clasePrincipal, claseSuelta] = await Promise.all([
    crearClase("principal"),
    crearClase("principal"),
  ]);

  pack = await crearPack([clasePrincipal.id]);
}, 90_000);

afterAll(async () => {
  await limpiarResiduos();
}, 90_000);

// ── Que lo de antes siga igual ──────────────────────────────────────────────

describe("sin comprar nada (que no se haya roto el catalogo)", () => {
  it("sin plan NO ve una clase de principal", async () => {
    const { data } = await sinPlan.cliente
      .from("videos").select("id").eq("id", clasePrincipal.id);
    expect(data ?? []).toHaveLength(0);
  });

  it("con plan suficiente SI la ve", async () => {
    const { data } = await conPlan.cliente
      .from("videos").select("id").eq("id", clasePrincipal.id);
    expect((data ?? []).length).toBeGreaterThan(0);
  });

  it("sin plan tampoco ve la clase que quedo fuera del pack", async () => {
    const { data } = await sinPlan.cliente
      .from("videos").select("id").eq("id", claseSuelta.id);
    expect(data ?? []).toHaveLength(0);
  });
});

// ── Con el pack comprado ────────────────────────────────────────────────────

describe("con el pack comprado", () => {
  let compradora: Alumna;

  beforeAll(async () => {
    compradora = await crearAlumna("none");
    await comprarPack(pack.id, compradora.id);
  }, 60_000);

  it("ve la clase del pack aunque no tenga plan", async () => {
    const { data } = await compradora.cliente
      .from("videos").select("id").eq("id", clasePrincipal.id);
    expect((data ?? []).length).toBeGreaterThan(0);
  });

  it("NO ve una clase que no esta en el pack", async () => {
    const { data } = await compradora.cliente
      .from("videos").select("id").eq("id", claseSuelta.id);
    expect(data ?? []).toHaveLength(0);
  });

  it("la compra de otra NO le sirve a nadie mas", async () => {
    const { data } = await otraSinPlan.cliente
      .from("videos").select("id").eq("id", clasePrincipal.id);
    expect(data ?? []).toHaveLength(0);
  });

  it("una clase DESPUBLICADA deja de verse aunque este comprada", async () => {
    const c = await crearClase("principal");
    const p = await crearPack([c.id]);
    await comprarPack(p.id, compradora.id);

    const antes = await compradora.cliente.from("videos").select("id").eq("id", c.id);
    expect((antes.data ?? []).length).toBeGreaterThan(0);

    await admin().from("videos").update({ status: "draft" }).eq("id", c.id);

    const despues = await compradora.cliente.from("videos").select("id").eq("id", c.id);
    expect(despues.data ?? []).toHaveLength(0);
  });

  it("sacar la clase del pack le quita el acceso", async () => {
    const c = await crearClase("principal");
    const p = await crearPack([c.id]);
    await comprarPack(p.id, compradora.id);

    await admin().from("pack_videos").delete().eq("pack_id", p.id).eq("video_id", c.id);

    const { data } = await compradora.cliente.from("videos").select("id").eq("id", c.id);
    expect(data ?? []).toHaveLength(0);
  });
});

// ── Compras vencidas ────────────────────────────────────────────────────────

describe("una compra vencida", () => {
  it("NO da acceso", async () => {
    // Hoy los packs son permanentes (expires_at null), pero la columna existe.
    // Esto comprueba que la fecha se respeta el dia que se use.
    const c = await crearClase("principal");
    const p = await crearPack([c.id]);
    const ella = await crearAlumna("none");
    await comprarPack(p.id, ella.id, { vencida: true });

    const { data } = await ella.cliente.from("videos").select("id").eq("id", c.id);
    expect(data ?? []).toHaveLength(0);
  });
});

// ── Las tablas de packs ─────────────────────────────────────────────────────

describe("las tablas de packs no se dejan escribir ni filtran", () => {
  it("una alumna NO se puede regalar un pack", async () => {
    const { error } = await sinPlan.cliente
      .from("pack_purchases")
      .insert({
        pack_id: pack.id,
        user_id: sinPlan.id,
        stripe_checkout_session_id: `zz-test-falsa-${Date.now()}`,
      });
    // 42501: la frena el GRANT. Se exige el codigo exacto y no "hubo error":
    // con la tabla sin crear, cualquier error dejaria esto en verde.
    expect(error?.code).toBe("42501");
  });

  it("una alumna NO ve las compras de otra", async () => {
    const compradora = await crearAlumna("none");
    await comprarPack(pack.id, compradora.id);

    const { data } = await sinPlan.cliente
      .from("pack_purchases").select("id").eq("user_id", compradora.id);
    expect(data ?? []).toHaveLength(0);
  });

  it("una alumna SI ve las suyas", async () => {
    const compradora = await crearAlumna("none");
    await comprarPack(pack.id, compradora.id);

    const { data } = await compradora.cliente.from("pack_purchases").select("id");
    expect((data ?? []).length).toBeGreaterThan(0);
  });

  it("un pack SIN publicar no se ve", async () => {
    const p = await crearPack([]);
    await admin().from("packs").update({ is_published: false }).eq("id", p.id);

    const { data } = await sinPlan.cliente.from("packs").select("id").eq("id", p.id);
    expect(data ?? []).toHaveLength(0);
  });

  it("nadie puede editar un pack", async () => {
    const { error } = await sinPlan.cliente
      .from("packs").update({ price_cents: 1 }).eq("id", pack.id);
    expect(error?.code).toBe("42501");
  });

  it("la RPC de dos argumentos NO es alcanzable por una alumna", async () => {
    const conSesion = await sinPlan.cliente.rpc("has_purchased_video", {
      target_video_id: clasePrincipal.id,
      target_user_id: conPlan.id,
    });
    expect(conSesion.error).not.toBeNull();
    expect(conSesion.data).toBeNull();

    // Control positivo: la MISMA funcion responde por service_role. Sin esto, la
    // comprobacion de arriba pasaria igual si la funcion no existiera.
    const porServiceRole = await admin().rpc("has_purchased_video", {
      target_video_id: clasePrincipal.id,
      target_user_id: conPlan.id,
    });
    expect(porServiceRole.error).toBeNull();
    expect(porServiceRole.data).toBe(false);
  });
});

// ── La vitrina publica ──────────────────────────────────────────────────────

describe("la vista packs_publicos", () => {
  it("NO es alcanzable por una alumna con sesion", async () => {
    const { error } = await sinPlan.cliente.from("packs_publicos").select("slug");
    expect(error).not.toBeNull();
  });

  it("por service_role NO expone nada que permita reproducir", async () => {
    // La vista pide `is_published AND show_on_landing`. `crearPack` solo publica,
    // asi que hay que marcarlo para la portada o la consulta vuelve vacia -- y
    // una prueba sobre cero filas no prueba nada.
    const p = await crearPack([clasePrincipal.id]);
    await admin().from("packs").update({ show_on_landing: true }).eq("id", p.id);

    const { data, error } = await admin()
      .from("packs_publicos").select("*").like("slug", "zz-test-%").limit(1);
    expect(error).toBeNull();

    const fila = (data ?? [])[0];
    expect(fila, "la vista no devolvio nada: esta prueba no midio nada").toBeDefined();

    for (const prohibido of ["id", "stripe_price_id_test", "stripe_price_id_live", "video_id", "bunny_video_id"]) {
      expect(Object.keys(fila!)).not.toContain(prohibido);
    }
  });
});

/*
 * ── COMO COMPROBAR QUE ESTAS PRUEBAS PUEDEN FALLAR ─────────────────────────
 *
 *   -- Abre el catalogo entero:
 *   drop policy if exists "videos_select_allowed_by_tier" on public.videos;
 *   create policy "videos_select_allowed_by_tier"
 *     on public.videos for select to authenticated using (true);
 *
 *   npm run test:aislamiento
 *     -> tienen que ponerse en ROJO, como minimo:
 *        - sin plan NO ve una clase de principal
 *        - NO ve una clase que no esta en el pack
 *        - una compra vencida NO da acceso
 *
 * Y DESPUES SE RESTAURA corriendo de nuevo
 * supabase/migrations/20260805_packs_de_clases.sql.
 */
