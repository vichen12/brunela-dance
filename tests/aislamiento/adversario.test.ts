import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  admin,
  anonimo,
  comprarPack,
  crearAlumna,
  crearClase,
  crearDocumento,
  crearPack,
  crearPrograma,
  crearSala,
  crearSesion,
  limpiarResiduos,
  ponerEnlace,
  sembrarMensaje,
  type Alumna,
} from "./ayudantes";

/**
 * Auditoria adversarial: atacar el sistema desde afuera, con credenciales
 * reales, y que el resultado sea el veredicto.
 *
 * POR QUE ESTE ARCHIVO EXISTE APARTE
 *   Los otros bancos prueban que lo que TIENE que funcionar funciona. Este prueba
 *   lo contrario: se pone en el lugar de alguien que quiere lo que no pago y le
 *   pide de todo a la base con su propia sesion.
 *
 *   Todo lo grave que se encontro en este proyecto aparecio asi. Las revisiones
 *   leyendo codigo fallaron tres veces: las policies fantasma de `categories`, el
 *   chat que no comprobaba el plan y las cuatro actions sin guarda pasaron por
 *   delante de varias lecturas antes de que una prueba con JWT real las mostrara.
 *
 * COMO SE LEE UN VERDE ACA
 *   Un verde significa "se intento y NO se filtro". Cada prueba dice que se
 *   pidio y con que credencial. Si algo se filtra, el rojo es el hallazgo.
 *
 * ⚠️ LOS CONTROLES POSITIVOS NO SON DECORATIVOS
 *   Cada bloque incluye al menos una prueba de que el contenido SI existe y SI
 *   es alcanzable por quien corresponde. Sin eso, una consulta que devuelve
 *   cero filas porque el sembrado fallo se leeria como "esta protegido".
 */

let sinPlan: Alumna;
let corps: Alumna;
let solista: Alumna;
let principal: Alumna;
let compradora: Alumna;

let clasePrincipal: { id: string };
let claseSolista: { id: string };
let claseDelPack: { id: string };
let claseFueraDelPack: { id: string };
let programaPrincipal: { id: string };
let sesionPrincipal: { id: string };
let docPrincipal: { id: string };
let salaPrincipal: { id: string };
let packVendido: { id: string };
let packSinPublicar: { id: string };

beforeAll(async () => {
  await limpiarResiduos();

  [sinPlan, corps, solista, principal, compradora] = await Promise.all([
    crearAlumna("none"),
    crearAlumna("corps_de_ballet"),
    crearAlumna("solista"),
    crearAlumna("principal"),
    crearAlumna("none"),
  ]);

  [clasePrincipal, claseSolista, claseDelPack, claseFueraDelPack] = await Promise.all([
    crearClase("principal"),
    crearClase("solista"),
    crearClase("principal"),
    crearClase("principal"),
  ]);

  [programaPrincipal, sesionPrincipal, docPrincipal, salaPrincipal] = await Promise.all([
    crearPrograma("principal"),
    crearSesion({ tier: "principal" }),
    crearDocumento("principal"),
    crearSala({ tipo: "tier", tier: "principal" }),
  ]);

  await ponerEnlace(sesionPrincipal.id, "https://zoom.test/secreto-de-principal");
  await sembrarMensaje(salaPrincipal.id, principal.id, "secreto de principal");

  packVendido = await crearPack([claseDelPack.id]);
  await comprarPack(packVendido.id, compradora.id);

  packSinPublicar = await crearPack([claseFueraDelPack.id]);
  await admin().from("packs").update({ is_published: false }).eq("id", packSinPublicar.id);
}, 120_000);

afterAll(async () => {
  await limpiarResiduos();
}, 90_000);

// ════════════════════════════════════════════════════════════════════════════
// SIN SESION — la clave publicable, que esta en el HTML de la landing
// ════════════════════════════════════════════════════════════════════════════

describe("sin sesion, con la clave publicable", () => {
  const tablas = [
    "videos", "programs", "program_days", "live_sessions", "live_session_access_links",
    "documents", "chat_rooms", "chat_messages", "profiles", "subscriptions",
    "packs", "pack_videos", "pack_purchases", "packs_publicos", "site_settings",
    "activity_events", "user_progress", "live_session_invitations",
  ];

  it.each(tablas)("no puede leer %s", async (t) => {
    const { data, error } = await anonimo().from(t).select("*").limit(5);
    // Se exige 42501 (permission denied) y NO solo "hubo error": un 404 por
    // tabla mal escrita tambien daria error y esto pasaria sin probar nada.
    expect(error?.code, `respuesta: ${JSON.stringify(data)?.slice(0, 200)}`).toBe("42501");
    expect(data).toBeNull();
  });

  it("no puede escribir en ninguna tabla", async () => {
    const { error } = await anonimo().from("profiles").insert({ email: "zz-test-intruso@x.com" });
    expect(error).not.toBeNull();
  });

  /**
   * ⚠️ NO SE ENUMERAN LAS FUNCIONES: SE DESCUBREN.
   *
   *    La primera version listaba tres a mano y por eso solo encontro una de las
   *    que respondian. Recorriendo las migraciones aparecen las 26, y las que se
   *    agreguen manana entran solas.
   *
   *    Una funcion en `public` a la que `anon` puede hacer EXECUTE es un endpoint
   *    RPC alcanzable desde internet con la clave que esta en el HTML de la
   *    landing. Y ojo con la trampa: toda funcion nace con EXECUTE para PUBLIC,
   *    asi que `revoke ... from anon` NO alcanza -- hay que revocar de `public`
   *    y volver a otorgar a authenticated. Costo una migracion entera aprenderlo.
   */
  /**
   * ⚠️ TRES EXCEPCIONES DECLARADAS, CON SU MOTIVO Y CON SU RESPUESTA ESPERADA.
   *
   *    Estas tres le responden a `anon` y se decidio el 2026-08-06 NO cerrarlas.
   *    No filtran nada -- devuelven exactamente el valor que se lista abajo -- y
   *    cerrarlas obliga a revocar de PUBLIC, lo que deja sin permiso a TODOS los
   *    roles a la vez. `is_admin()` esta en 188 policies: si el grant de vuelta
   *    a `authenticated` no entra, la app deja de leer entera. Y el SQL Editor
   *    de Supabase ya corto una transaccion en silencio ese mismo dia.
   *
   *    Riesgo alto contra beneficio cero, a dos dias de entregar.
   *
   * ⚠️ NO SE LAS SALTEA: SE LES EXIGE SEGUIR SIENDO INOFENSIVAS.
   *    Esa es la diferencia entre una excepcion y un verde falso. Si alguna
   *    empieza a devolver otra cosa -- por ejemplo si `is_admin()` pasara a
   *    aceptar un uuid y contestara sobre otra persona -- esta prueba se pone en
   *    rojo igual, porque compara la RESPUESTA y no solo el nombre.
   */
  const RESPONDEN_A_ANON = new Map<string, unknown>([
    ["is_admin", false],
    ["current_user_membership_tier", "none"],
    ["can_start_dm", false],
  ]);

  it("ninguna funcion NUEVA le responde a un anonimo", async () => {
    const dir = "supabase/migrations";
    const sql = readdirSync(dir)
      .filter((f) => f.endsWith(".sql"))
      // Se quitan los comentarios: las migraciones CITAN el SQL que explican, y
      // una funcion nombrada en una nota contaria como existente.
      .map((f) => readFileSync(join(dir, f), "utf8").replace(/--.*$/gm, ""))
      .join("\n");

    const funciones = [
      ...new Set([...sql.matchAll(/create or replace function public\.(\w+)\s*\(/g)].map((m) => m[1])),
    ].sort();

    // Sin esto, un regex mal escrito daria cero funciones y la prueba pasaria
    // sin haber probado nada.
    expect(funciones.length, "no se encontro ninguna funcion: el barrido esta roto").toBeGreaterThan(15);

    const inesperadas: string[] = [];
    for (const f of funciones) {
      if (RESPONDEN_A_ANON.has(f)) continue;
      const { error } = await anonimo().rpc(f, {});
      // 42883 / PGRST202: PostgREST ni la ve para ese rol. 42501: permiso denegado.
      const bloqueada = !!error && ["42883", "PGRST202", "42501"].includes(error.code ?? "");
      if (!bloqueada) inesperadas.push(f);
    }

    expect(
      inesperadas,
      `funciones nuevas alcanzables desde internet: ${inesperadas.join(", ")}. ` +
        `Si son inofensivas, se agregan a RESPONDEN_A_ANON con su valor esperado y su motivo; ` +
        `si no, hay que revocarlas de PUBLIC (no de anon: el permiso se hereda).`
    ).toHaveLength(0);
  }, 60_000);

  it.each([...RESPONDEN_A_ANON.entries()])(
    "la excepcion %s sigue siendo inofensiva para un anonimo",
    async (fn, esperado) => {
      const { data, error } = await anonimo().rpc(fn as string, {});
      expect(error, `${fn} dejo de responder: sacala de RESPONDEN_A_ANON`).toBeNull();
      expect(
        data,
        `${fn} le devuelve a un anonimo algo distinto de ${JSON.stringify(esperado)}: ` +
          `la excepcion dejo de ser inofensiva y hay que cerrarla`
      ).toBe(esperado);
    }
  );
});

// ════════════════════════════════════════════════════════════════════════════
// TIER NONE — cuenta creada, nada pagado
// ════════════════════════════════════════════════════════════════════════════

describe("con sesion y sin plan, intenta llegar a todo", () => {
  it("CONTROL: el contenido sembrado existe de verdad", async () => {
    // Sin esto, todo lo de abajo pasaria igual con la base vacia.
    const { count } = await admin().from("videos").select("id", { count: "exact", head: true })
      .eq("id", clasePrincipal.id);
    expect(count, "el sembrado fallo: las pruebas de abajo no medirian nada").toBe(1);
  });

  it("no llega a una clase de principal", async () => {
    const { data } = await sinPlan.cliente.from("videos").select("id, bunny_video_id, stream_playback_id")
      .eq("id", clasePrincipal.id);
    expect(data ?? []).toHaveLength(0);
  });

  it("no llega a un programa de principal", async () => {
    const { data } = await sinPlan.cliente.from("programs").select("id").eq("id", programaPrincipal.id);
    expect(data ?? []).toHaveLength(0);
  });

  it("no llega a una sesion en vivo de principal", async () => {
    const { data } = await sinPlan.cliente.from("live_sessions").select("id").eq("id", sesionPrincipal.id);
    expect(data ?? []).toHaveLength(0);
  });

  it("no llega al enlace de Zoom", async () => {
    const { data } = await sinPlan.cliente.from("live_session_access_links")
      .select("join_url").eq("live_session_id", sesionPrincipal.id);
    expect(data ?? []).toHaveLength(0);
  });

  it("no llega a los mensajes de una sala de principal", async () => {
    const { data } = await sinPlan.cliente.from("chat_messages").select("content")
      .eq("room_id", salaPrincipal.id);
    expect(data ?? []).toHaveLength(0);
  });

  it("no llega a los datos de otras alumnas", async () => {
    const { data } = await sinPlan.cliente.from("profiles").select("id, email").neq("id", sinPlan.id);
    expect(data ?? [], `filtro perfiles ajenos: ${JSON.stringify(data)?.slice(0, 200)}`).toHaveLength(0);
  });

  it("no llega a las suscripciones de otras", async () => {
    const { data } = await sinPlan.cliente.from("subscriptions").select("*").neq("user_id", sinPlan.id);
    expect(data ?? []).toHaveLength(0);
  });

  it("no puede pedir TODAS las clases sin filtro (barrido a ciegas)", async () => {
    // Sin `.eq()`: es lo que haria alguien que no sabe los ids y prueba a ver
    // que devuelve. Solo tendria que ver lo que su plan permite.
    const { data } = await sinPlan.cliente.from("videos").select("id, slug, bunny_video_id");
    const suyas = (data ?? []).filter((v: { id: string }) =>
      [clasePrincipal.id, claseSolista.id, claseDelPack.id, claseFueraDelPack.id].includes(v.id));
    expect(suyas, "el barrido devolvio clases pagas").toHaveLength(0);
  });

  it("ni un solo identificador de reproduccion se le escapa", async () => {
    // El dato que de verdad importa: con bunny_video_id se puede intentar armar
    // una URL. Se barre TODA la tabla y se comprueba que no venga ninguno.
    const { data } = await sinPlan.cliente.from("videos").select("bunny_video_id, stream_playback_id");
    const conId = (data ?? []).filter(
      (v: { bunny_video_id: string | null; stream_playback_id: string | null }) =>
        v.bunny_video_id !== null || v.stream_playback_id !== null
    );
    expect(conId, "se filtraron identificadores de reproduccion").toHaveLength(0);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// TIER CORPS — pago el mas barato, quiere el de arriba
// ════════════════════════════════════════════════════════════════════════════

describe("con corps_de_ballet, intenta lo de solista y principal", () => {
  it("CONTROL: solista SI ve la clase de solista", async () => {
    const { data } = await solista.cliente.from("videos").select("id").eq("id", claseSolista.id);
    expect((data ?? []).length, "el control positivo fallo: las de abajo no prueban nada").toBeGreaterThan(0);
  });

  it("no llega a una clase de solista", async () => {
    const { data } = await corps.cliente.from("videos").select("id").eq("id", claseSolista.id);
    expect(data ?? []).toHaveLength(0);
  });

  it("no llega a una clase de principal", async () => {
    const { data } = await corps.cliente.from("videos").select("id").eq("id", clasePrincipal.id);
    expect(data ?? []).toHaveLength(0);
  });

  it("no llega a un programa de principal", async () => {
    const { data } = await corps.cliente.from("programs").select("id").eq("id", programaPrincipal.id);
    expect(data ?? []).toHaveLength(0);
  });

  it("no llega al Zoom de una sesion de principal", async () => {
    const { data } = await corps.cliente.from("live_session_access_links")
      .select("join_url").eq("live_session_id", sesionPrincipal.id);
    expect(data ?? []).toHaveLength(0);
  });

  it("no puede reservar una sesion de principal", async () => {
    const { error } = await corps.cliente.from("live_session_bookings")
      .insert({ live_session_id: sesionPrincipal.id, user_id: corps.id });
    expect(error?.message).toContain("Membership tier does not allow");
  });
});

// ════════════════════════════════════════════════════════════════════════════
// CON UN PACK COMPRADO — quiere mas de lo que compro
// ════════════════════════════════════════════════════════════════════════════

describe("con un pack comprado, intenta pasarse de lo comprado", () => {
  it("CONTROL: SI ve la clase que compro", async () => {
    const { data } = await compradora.cliente.from("videos").select("id").eq("id", claseDelPack.id);
    expect((data ?? []).length, "el control positivo fallo").toBeGreaterThan(0);
  });

  it("no llega a una clase que NO esta en su pack", async () => {
    const { data } = await compradora.cliente.from("videos").select("id").eq("id", clasePrincipal.id);
    expect(data ?? []).toHaveLength(0);
  });

  it("comprar un pack NO le da el plan", async () => {
    const { data } = await compradora.cliente.from("programs").select("id").eq("id", programaPrincipal.id);
    expect(data ?? []).toHaveLength(0);
  });

  it("no puede agregarse clases a su propio pack", async () => {
    const { error } = await compradora.cliente.from("pack_videos")
      .insert({ pack_id: packVendido.id, video_id: clasePrincipal.id });
    expect(error?.code).toBe("42501");
  });

  it("no puede fabricarse una compra de otro pack", async () => {
    const { error } = await compradora.cliente.from("pack_purchases").insert({
      pack_id: packSinPublicar.id,
      user_id: compradora.id,
      stripe_checkout_session_id: `zz-test-falsificada-${Date.now()}`,
    });
    expect(error?.code).toBe("42501");
  });

  it("no ve el pack que esta SIN publicar", async () => {
    const { data } = await compradora.cliente.from("packs").select("id").eq("id", packSinPublicar.id);
    expect(data ?? []).toHaveLength(0);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// LA PLATA — activarse cosas sin pagar
// ════════════════════════════════════════════════════════════════════════════

describe("intenta darse acceso sin pagar", () => {
  it("no puede subirse el plan escribiendo su propio perfil", async () => {
    await sinPlan.cliente.from("profiles").update({ membership_tier: "principal" }).eq("id", sinPlan.id);

    // Se comprueba contra la BASE, no contra el error: el trigger
    // protect_profile_admin_fields revierte el campo en silencio y la escritura
    // puede devolver error null. Mirar solo el error diria que "no paso nada".
    const { data } = await admin().from("profiles").select("membership_tier").eq("id", sinPlan.id).single();
    expect(data?.membership_tier, "se auto-asigno un plan").toBe("none");
  });

  it("no puede hacerse admin", async () => {
    await sinPlan.cliente.from("profiles").update({ is_admin: true }).eq("id", sinPlan.id);
    const { data } = await admin().from("profiles").select("is_admin").eq("id", sinPlan.id).single();
    expect(data?.is_admin, "se auto-asigno admin").toBe(false);
  });

  it("no puede fabricarse una suscripcion activa", async () => {
    const { error } = await sinPlan.cliente.from("subscriptions").insert({
      user_id: sinPlan.id,
      provider_subscription_id: `zz-test-falsa-${Date.now()}`,
      membership_tier: "principal",
      status: "active",
    });
    expect(error).not.toBeNull();

    const { count } = await admin().from("subscriptions")
      .select("id", { count: "exact", head: true }).eq("user_id", sinPlan.id);
    expect(count, "quedo una suscripcion falsa en la base").toBe(0);
  });

  it("no puede cambiar el precio de un pack", async () => {
    const { error } = await sinPlan.cliente.from("packs").update({ price_cents: 1 }).eq("id", packVendido.id);
    expect(error?.code).toBe("42501");

    const { data } = await admin().from("packs").select("price_cents").eq("id", packVendido.id).single();
    expect(data?.price_cents).toBe(1000);
  });

  it("no puede tocar los precios de los planes", async () => {
    const { error } = await sinPlan.cliente.from("site_settings")
      .update({ value: { hackeado: true } }).eq("setting_key", "subscriptions.catalog");
    expect(error).not.toBeNull();
  });

  it("no puede invitarse a una sesion que no le corresponde", async () => {
    const { error } = await sinPlan.cliente.from("live_session_invitations")
      .insert({ live_session_id: sesionPrincipal.id, user_id: sinPlan.id });
    expect(error?.code).toBe("42501");
  });

  it("no puede marcarse progreso en una clase que no puede ver", async () => {
    const { error } = await sinPlan.cliente.from("user_progress").insert({
      user_id: sinPlan.id,
      video_id: clasePrincipal.id,
      completion_percent: 100,
    });
    // Puede fallar por policy o por FK; lo que importa es que NO quede escrito.
    const { count } = await admin().from("user_progress")
      .select("id", { count: "exact", head: true })
      .eq("user_id", sinPlan.id).eq("video_id", clasePrincipal.id);
    expect(count, `quedo progreso sobre contenido no accesible (error: ${error?.code})`).toBe(0);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// DOCUMENTOS — la columna dice que son contenido pago
// ════════════════════════════════════════════════════════════════════════════

describe("documentos del estudio", () => {
  it("CONTROL: el documento sembrado existe y pide plan principal", async () => {
    const { data } = await admin().from("documents")
      .select("id, membership_tier_required, is_published").eq("id", docPrincipal.id).single();
    expect(data?.membership_tier_required).toBe("principal");
    expect(data?.is_published).toBe(true);
  });

  it("una alumna SIN plan no llega a un documento de principal", async () => {
    const { data } = await sinPlan.cliente.from("documents")
      .select("id, title, file_url").eq("id", docPrincipal.id);
    expect(
      data ?? [],
      "🔴 FILTRACION: documents_select_published solo mira is_published y NO el plan, " +
        "aunque la columna membership_tier_required existe y la migracion dice que son contenido pago"
    ).toHaveLength(0);
  });

  it("una alumna de corps tampoco llega a uno de principal", async () => {
    const { data } = await corps.cliente.from("documents").select("id").eq("id", docPrincipal.id);
    expect(data ?? []).toHaveLength(0);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// SEGUNDA PASADA — superficies que la primera no ataco
// ════════════════════════════════════════════════════════════════════════════

describe("datos de otras alumnas por caminos menos obvios", () => {
  it("no llega al registro de eventos de Stripe de nadie", async () => {
    // subscription_webhook_events guarda el payload COMPLETO de cada evento
    // verificado: importes, ids de cliente, correos. Es de auditoria, no de
    // consumo.
    const { data, error } = await sinPlan.cliente.from("subscription_webhook_events").select("*").limit(5);
    expect(data ?? [], `error: ${error?.code}`).toHaveLength(0);
  });

  it("no puede escribirse eventos de actividad a nombre de otra", async () => {
    await sinPlan.cliente.from("activity_events").insert({
      user_id: principal.id,
      event_type: "video_start",
      video_id: clasePrincipal.id,
      session_id: "00000000-0000-0000-0000-000000000001",
      position_seconds: 0,
      occurred_at: new Date().toISOString(),
    });

    // Se comprueba contra la BASE: si la policy lo deja pasar, ensuciaria las
    // analiticas de otra persona.
    const { count } = await admin().from("activity_events")
      .select("id", { count: "exact", head: true })
      .eq("user_id", principal.id).eq("video_id", clasePrincipal.id);
    expect(count, "escribio actividad a nombre de otra alumna").toBe(0);
  });

  it("no lee la actividad de otras", async () => {
    const { data } = await sinPlan.cliente.from("activity_events").select("*").neq("user_id", sinPlan.id);
    expect(data ?? []).toHaveLength(0);
  });

  it("no lee las reservas de otras", async () => {
    await admin().from("live_session_bookings")
      .insert({ live_session_id: sesionPrincipal.id, user_id: principal.id, status: "reserved" });

    const { data } = await sinPlan.cliente.from("live_session_bookings").select("*").neq("user_id", sinPlan.id);
    expect(data ?? []).toHaveLength(0);
  });

  it("no lee los logros de otras", async () => {
    const { data } = await sinPlan.cliente.from("reward_claims").select("*").neq("user_id", sinPlan.id);
    expect(data ?? []).toHaveLength(0);
  });
});

describe("realtime sobre las tablas nuevas", () => {
  it("no recibe en vivo los packs que no ve", async () => {
    // Realtime autoriza por su propio camino, aunque se apoye en las mismas
    // policies. Probar solo REST deja la mitad sin medir -- por eso el chat se
    // prueba por los dos lados.
    const { data: sesion } = await sinPlan.cliente.auth.getSession();
    if (sesion.session?.access_token) await sinPlan.cliente.realtime.setAuth(sesion.session.access_token);

    const llego = await new Promise<boolean>((resolve) => {
      let resuelto = false;
      const listo = (v: boolean) => {
        if (resuelto) return;
        resuelto = true;
        sinPlan.cliente.removeChannel(canal);
        resolve(v);
      };
      const canal = sinPlan.cliente
        .channel(`zz-test-packs-${Math.random()}`)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "pack_purchases" }, () => listo(true))
        .subscribe(async (estado) => {
          if (estado !== "SUBSCRIBED") return;
          await comprarPack(packVendido.id, principal.id);
          setTimeout(() => listo(false), 6000);
        });
    });

    expect(llego, "recibio por realtime la compra de otra alumna").toBe(false);
  });
});
