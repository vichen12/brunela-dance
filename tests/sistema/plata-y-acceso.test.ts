import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { celda, BOM_UTF8 } from "../../src/lib/csv";

/**
 * Invariantes de la plata y del contenido pago.
 *
 * POR QUE ESTAS Y NO OTRAS
 *   La auditoria del 2026-08-05 listo todo lo que nunca se habia probado. De esa
 *   lista, lo que toca DINERO o ACCESO A CONTENIDO PAGO es lo que puede costar
 *   caro y en silencio, asi que va primero. Lo demas -- analiticas, exportacion,
 *   recuperar contraseña -- falla de forma visible y molesta, no cara.
 *
 * ⚠️ QUE PUEDE Y QUE NO PUEDE CUBRIR ESTE ARCHIVO
 *   Estas pruebas leen el codigo: comprueban INVARIANTES ESTRUCTURALES, no
 *   comportamiento en vivo. Detectan que alguien acepte un precio del navegador
 *   o firme una URL antes de filtrar. NO reemplazan cobrar de verdad contra
 *   Stripe ni reproducir un video: eso sigue en la lista de pendientes de
 *   CLAUDE.md y lo hace una persona.
 *
 *   Se dice aca para que un verde no se lea como "el cobro esta probado".
 */

const leer = (p: string) => readFileSync(p, "utf8");

// ════════════════════════════════════════════════════════════════════════════
// EL PRECIO LO PONE EL SERVIDOR, SIEMPRE
// ════════════════════════════════════════════════════════════════════════════

describe("nadie puede pagar menos manipulando la request", () => {
  const rutasDePago = [
    "app/api/stripe/checkout/route.ts",
    "app/api/stripe/checkout-pack/route.ts",
  ];

  it.each(rutasDePago)("%s no acepta importes ni price ids del cliente", (p) => {
    const src = leer(p);
    const esquema = src.match(/const schema = z\.object\(\{[\s\S]*?\n\}\)|const schema = z\.object\(\{[^}]*\}\)/)?.[0] ?? "";
    expect(esquema, `${p}: no se encontro el esquema de entrada`).not.toBe("");

    for (const prohibido of ["price", "amount", "cents", "importe", "total", "currency"]) {
      expect(
        esquema.toLowerCase(),
        `${p} acepta "${prohibido}" desde el navegador: el precio lo tiene que resolver el servidor`
      ).not.toContain(prohibido);
    }
  });

  it.each(rutasDePago)("%s resuelve el price id contra la base o el catalogo", (p) => {
    const src = leer(p);
    // El price id tiene que venir de una lectura del servidor. Si apareciera
    // dentro de line_items directo desde el body, ese seria el bug.
    expect(src).toMatch(/resolvePriceId\(|stripe_price_id_(test|live)/);
    expect(src).toMatch(/line_items:\s*\[\{\s*price:\s*priceId/);
  });

  it("el modo lo decide la clave secreta y nada mas", () => {
    // Si el modo saliera de una variable aparte, se podria quedar desincronizada
    // con la clave: clave de produccion con price ids de prueba, o al reves.
    const catalogo = leer("src/lib/stripe/catalog.ts");
    expect(catalogo).toMatch(/export function stripeMode\(secretKey/);
    expect(catalogo).toMatch(/sk\|rk\)_live_/);

    for (const p of ["app/api/stripe/checkout/route.ts", "app/api/stripe/checkout-pack/route.ts"]) {
      expect(leer(p), `${p} no deriva el modo de la clave`).toMatch(/stripeMode\(env\.STRIPE_SECRET_KEY\)/);
    }
  });

  it("las claves de verificacion de precios NO pueden cobrar", () => {
    // STRIPE_SECRET_KEY_TEST/LIVE existen solo para preguntarle a Stripe cuanto
    // vale un price. Si aparecieran en una ruta de cobro, una equivocacion de
    // modo cobraria de verdad con la clave que no toca.
    const soloEsteArchivo = "src/lib/stripe/verificar-precio.ts";
    for (const p of [
      "app/api/stripe/checkout/route.ts",
      "app/api/stripe/checkout-pack/route.ts",
      "app/api/stripe/portal/route.ts",
      "app/api/stripe/webhooks/route.ts",
    ]) {
      expect(leer(p), `${p} usa una clave que solo deberia usar ${soloEsteArchivo}`)
        .not.toMatch(/STRIPE_SECRET_KEY_(TEST|LIVE)/);
    }
    expect(leer(soloEsteArchivo)).toMatch(/prices\.retrieve/);
    // Y que ese modulo no cree sesiones de pago ni cobre.
    expect(leer(soloEsteArchivo)).not.toMatch(/checkout\.sessions\.create|paymentIntents\.create|subscriptions\.create/);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// NO SE PUEDE COMPRAR LO QUE NO ESTA A LA VENTA
// ════════════════════════════════════════════════════════════════════════════

describe("un pack despublicado no se compra ni con el enlace directo", () => {
  const ruta = () => leer("app/api/stripe/checkout-pack/route.ts");

  it("se comprueba is_published antes de cobrar", () => {
    const src = ruta();
    expect(src).toMatch(/if \(!pack \|\| !pack\.is_published\)/);
    // Y que la comprobacion ocurra ANTES de crear la sesion de pago.
    expect(src.indexOf("is_published")).toBeLessThan(src.indexOf("checkout.sessions.create"));
  });

  it("un pack sin identificador de Stripe no llega al cobro", () => {
    const src = ruta();
    expect(src).toMatch(/if \(!priceId\)/);
    expect(src.indexOf("if (!priceId)")).toBeLessThan(src.indexOf("checkout.sessions.create"));
  });

  it("no se cobra dos veces el mismo pack", () => {
    const src = ruta();
    expect(src).toContain('.from("pack_purchases")');
    expect(src).toMatch(/status:\s*409/);
    expect(src.indexOf("yaLoTiene")).toBeLessThan(src.indexOf("checkout.sessions.create"));
  });

  it("publicar exige clases adentro y price id del modo activo", () => {
    // Sin esto Brunela publica un pack vacio o sin cobro, y el fallo lo sufre la
    // alumna en el checkout, que es el peor lugar para descubrirlo.
    const acciones = leer("src/features/admin/packs-actions.ts");
    expect(acciones).toMatch(/no tiene ninguna clase adentro/);
    expect(acciones).toMatch(/identificador de Stripe/);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// EL WEBHOOK: ES LO QUE CONVIERTE UN PAGO EN ACCESO
// ════════════════════════════════════════════════════════════════════════════

describe("el webhook no pierde ni duplica una compra", () => {
  const src = () => leer("app/api/stripe/webhooks/route.ts");

  it("verifica la firma antes de tocar nada", () => {
    const s = src();
    expect(s).toMatch(/constructEvent\(payload, signature, env\.STRIPE_WEBHOOK_SECRET\)/);
    // Sin firma no se sigue: si no, cualquiera puede regalarse un pack con un
    // POST inventado.
    expect(s).toMatch(/if \(!signature\)/);
    expect(s.indexOf("constructEvent")).toBeLessThan(s.indexOf("registrarCompraDePack(event)"));
  });

  it("lee la metadata de la SESION, no de una suscripcion", () => {
    // En un pago unico no existe objeto suscripcion. Leerla del lugar
    // equivocado = pago cobrado sin acceso.
    const s = src();
    const fn = s.slice(s.indexOf("async function registrarCompraDePack"));
    expect(fn).toMatch(/session\.metadata\?\.user_id/);
    expect(fn).toMatch(/session\.metadata\?\.pack_id/);
  });

  it("un reintento de Stripe NO da dos packs", () => {
    const fn = src().slice(src().indexOf("async function registrarCompraDePack"));
    // 23505 = choque con el unique de stripe_checkout_session_id. Se trata como
    // exito porque el estado deseado ya esta.
    expect(fn).toMatch(/error\.code === "23505"/);
    expect(fn).toContain("stripe_checkout_session_id: session.id");
  });

  it("si falta la metadata LANZA, no sigue en silencio", () => {
    const fn = src().slice(src().indexOf("async function registrarCompraDePack"));
    // Lanzar devuelve 500 y Stripe reintenta. Tragarse el error dejaria a
    // alguien que pago sin su pack y sin ningun rastro.
    expect(fn).toMatch(/if \(!userId\) \{[\s\S]{0,200}throw new Error/);
    expect(fn).toMatch(/if \(!packId\) \{[\s\S]{0,200}throw new Error/);
  });

  it("no confunde el pago de un pack con el de una suscripcion", () => {
    const fn = src().slice(src().indexOf("async function registrarCompraDePack"));
    expect(fn).toMatch(/session\.mode !== "payment"/);
    expect(fn).toMatch(/session\.payment_status !== "paid"/);
  });

  it("guarda lo que se cobro de verdad, no el precio de lista", () => {
    // Con un cupon aplicado, el precio del pack y lo cobrado son distintos. El
    // precio puede cambiar mañana; lo que ella pago, no.
    const fn = src().slice(src().indexOf("async function registrarCompraDePack"));
    expect(fn).toContain("amount_total_cents: session.amount_total");
  });

  it("el camino de suscripciones sigue intacto", () => {
    const s = src();
    // El de packs se agrego al lado, no encima. Las dos guardas de orden que
    // protegen contra eventos de Stripe fuera de secuencia tienen que seguir.
    expect(s).toMatch(/customer\.subscription\.created/);
    expect(s).toMatch(/TERMINAL_STATUSES/);
    expect(s).toMatch(/last_event_at/);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// CONTENIDO PAGO: NADA QUE PERMITA ARMAR UNA URL DE REPRODUCCION
// ════════════════════════════════════════════════════════════════════════════

describe("los identificadores de reproduccion no salen del servidor", () => {
  it("la vitrina de la biblioteca los anula explicitamente", () => {
    const src = leer("app/dashboard/library/page.tsx");
    // Trae metadatos por service_role, que saltea RLS: la unica proteccion es
    // que esos campos no viajen.
    expect(src).toMatch(/NUNCA agregar aca bunny_video_id/);
  });

  it("la vitrina publica de packs es una VISTA, no la tabla", () => {
    // Una vista no puede devolver una columna que no selecciona. La lista de
    // columnas la impone Postgres y no un comentario en TypeScript.
    expect(leer("app/page.tsx")).toContain('.from("packs_publicos")');
    expect(leer("app/page.tsx")).not.toMatch(/\.from\("pack_videos"\)/);
  });

  it("la vista no expone nada reproducible", () => {
    const migracion = leer("supabase/migrations/20260805_packs_de_clases.sql");
    const vista = migracion.slice(
      migracion.indexOf("create view public.packs_publicos"),
      migracion.indexOf("revoke all on public.packs_publicos")
    );
    expect(vista.length, "no se encontro la definicion de la vista").toBeGreaterThan(0);
    for (const prohibido of ["bunny_video_id", "stream_playback_id", "video_id", "stripe_price_id"]) {
      expect(vista, `packs_publicos expone ${prohibido}`).not.toContain(prohibido);
    }
  });

  it("el proxy de video decide con el cliente DE LA ALUMNA", () => {
    const src = leer("app/api/video/[videoId]/[...path]/route.ts");
    // Si buscara con service_role, RLS no opinaria y cualquiera con el id
    // reproduciria cualquier clase.
    expect(src).toContain("createSupabaseServerClient");
    expect(src, "el proxy usa service_role: RLS dejaria de decidir").not.toContain("createSupabaseAdminClient");
    expect(src).toMatch(/status:\s*403/);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// EXPORTACION DE ALUMNAS: DATOS PERSONALES
// ════════════════════════════════════════════════════════════════════════════

describe("la exportacion de alumnas", () => {
  const src = () => leer("app/api/admin/export/alumnas/route.ts");

  it("exige admin", () => {
    expect(src()).toMatch(/requireAdmin\(\)/);
  });

  // ⚠️ ESTAS EJERCITAN LA FUNCION, no miran el texto del archivo.
  //
  //    La primera version comprobaba `expect(src()).toMatch(/[=+\-@]/)`, que la
  //    pasa CUALQUIER archivo que contenga un "=". Era una prueba que no podia
  //    fallar. Para poder ejercitarla de verdad hubo que sacar `celda` de la
  //    ruta a src/lib/csv.ts: lo que no se puede importar no se puede probar.

  it.each([
    ["=1+1", "'=1+1"],
    ["+1234", "'+1234"],
    ["-5", "'-5"],
    ["@SUM(A1)", "'@SUM(A1)"],
    ["\tAna", "'\tAna"],
    ["\rAna", "'\rAna"],
  ])("neutraliza %j como formula de Excel", (entrada, esperado) => {
    // El nombre lo escribe la alumna: es entrada no confiable que termina
    // abriendose en la maquina de Brunela.
    expect(celda(entrada)).toBe(`"${esperado}"`);
  });

  it("no toca un nombre normal", () => {
    expect(celda("Ana Martínez")).toBe('"Ana Martínez"');
  });

  it("escapa las comillas duplicandolas", () => {
    expect(celda('Ana "La Flaca"')).toBe('"Ana ""La Flaca"""');
  });

  it("null y undefined no escriben la palabra null", () => {
    expect(celda(null)).toBe('""');
    expect(celda(undefined)).toBe('""');
  });

  it("lleva BOM para que Excel no rompa los acentos", () => {
    expect(BOM_UTF8).toBe("﻿");
    expect(src()).toContain("BOM_UTF8 + [");
  });
});

// ── Un cupón del 100% también es una compra ─────────────────────────────────

describe("un pack regalado con cupón se registra igual", () => {
  const src = () => leer("app/api/stripe/webhooks/route.ts");

  it("acepta no_payment_required, no sólo paid", () => {
    // Stripe pone ese estado -- y NO "paid" -- cuando el total es 0, o sea con
    // un cupón del 100%. Exigiendo sólo "paid", la alumna completaba el
    // checkout y no recibía nada: el pago "funciona" y el acceso no llega.
    const fn = src().slice(src().indexOf("async function registrarCompraDePack"));
    expect(fn).toContain("no_payment_required");
    expect(fn, "vuelve a exigir solo 'paid'").not.toMatch(/payment_status !== "paid"/);
  });

  it("un estado que NO es de cobro se sigue rechazando", () => {
    // No es "acepta cualquier cosa": 'unpaid' tiene que seguir sin dar acceso.
    const fn = src().slice(src().indexOf("async function registrarCompraDePack"));
    expect(fn).toMatch(/ESTADOS_BUENOS\.has\(session\.payment_status\)/);
    expect(fn).toMatch(/ESTADOS_BUENOS = new Set\(\["paid", "no_payment_required"\]\)/);
  });
});
