import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Ayudantes para las pruebas de aislamiento del chat.
 *
 * POR QUE CORREN CONTRA SUPABASE REAL
 *   Lo que se prueba es RLS, y RLS se evalua en el servidor. Un simulacro
 *   probaria el simulacro. No hay forma honesta de verificar que una alumna de
 *   corps no llega a una sala de principal sin preguntarselo a Postgres.
 *
 * POR QUE CADA PRUEBA CREA SUS PROPIAS ALUMNAS
 *   Para no depender de que existan cuentas concretas ni de en que estado
 *   quedaron. Se crean con la API de admin, se usan y se BORRAN en un finally,
 *   asi que tambien se limpian si la prueba falla. El on delete cascade se
 *   lleva perfiles, mensajes y progreso.
 *
 * ⚠️ ESTO ESCRIBE EN LA BASE DE VERDAD
 *   Todo lo que crea lleva el prefijo `zz-test-`, y `limpiarResiduos()` borra
 *   cualquier cosa con ese prefijo que haya quedado de una corrida interrumpida.
 */

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const PUB =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const PREFIJO = "zz-test-";

export type Tier = "none" | "corps_de_ballet" | "solista" | "principal";

export type Alumna = {
  id: string;
  email: string;
  tier: Tier;
  /** Cliente ya autenticado como ella. Es el que hay que usar para probar. */
  cliente: SupabaseClient;
};

export function admin(): SupabaseClient {
  return createClient(URL, SERVICE, { auth: { persistSession: false } });
}

/** Crea una alumna con su plan y devuelve un cliente logueado como ella. */
export async function crearAlumna(tier: Tier): Promise<Alumna> {
  const a = admin();
  const email = `${PREFIJO}${tier}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@brunela.local`;
  const password = `Zz${Math.random().toString(36).slice(2)}!9A`;

  const { data, error } = await a.auth.admin.createUser({
    email, password, email_confirm: true,
  });
  if (error || !data.user) throw new Error(`No se pudo crear la alumna: ${error?.message}`);

  // El plan se pone con service_role: el trigger protect_profile_admin_fields
  // revierte membership_tier si lo escribe la propia usuaria, que es
  // exactamente lo que tiene que hacer.
  const { error: e2 } = await a.from("profiles").update({ membership_tier: tier }).eq("id", data.user.id);
  if (e2) throw new Error(`No se pudo asignar el plan: ${e2.message}`);

  const cliente = createClient(URL, PUB, { auth: { persistSession: false } });
  const { error: e3 } = await cliente.auth.signInWithPassword({ email, password });
  if (e3) throw new Error(`No se pudo iniciar sesion: ${e3.message}`);

  return { id: data.user.id, email, tier, cliente };
}

/** Crea una sala. `tier` solo aplica cuando el tipo es 'tier'. */
export async function crearSala(opts: {
  tipo: "community" | "tier" | "dm";
  tier?: Tier;
  participantes?: string[];
}): Promise<{ id: string }> {
  const a = admin();
  const { data, error } = await a
    .from("chat_rooms")
    .insert({
      name: `${PREFIJO}${opts.tipo}-${Date.now()}`,
      type: opts.tipo,
      tier_required: opts.tier ?? "none",
      is_archived: false,
      participant_ids: opts.participantes ?? [],
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(`No se pudo crear la sala: ${error?.message}`);
  return data;
}

/**
 * Crea una sesion en vivo publicada.
 *
 * `capacity` por defecto es alto para que el cupo no interfiera: las pruebas que
 * miden el cupo lo bajan a proposito.
 */
export async function crearSesion(opts: {
  tier: Exclude<Tier, "none">;
  capacity?: number;
  /** Para probar que una invitacion saltea la ventana de reservas. */
  cerradaDesdeHace?: boolean;
}): Promise<{ id: string }> {
  const a = admin();
  const marca = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const empieza = new Date(Date.now() + 86_400_000);

  const { data, error } = await a
    .from("live_sessions")
    .insert({
      slug: `${PREFIJO}sesion-${marca}`,
      title_i18n: { es: `${PREFIJO}sesion ${marca}` },
      status: "scheduled",
      membership_tier_required: opts.tier,
      starts_at: empieza.toISOString(),
      ends_at: new Date(empieza.getTime() + 3_600_000).toISOString(),
      session_timezone: "Europe/Madrid",
      capacity: opts.capacity ?? 50,
      booking_closes_at: opts.cerradaDesdeHace
        ? new Date(Date.now() - 3_600_000).toISOString()
        : null,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(`No se pudo crear la sesion: ${error?.message}`);
  return data;
}

/**
 * Falla RUIDOSAMENTE si la migracion de invitaciones no esta puesta.
 *
 * ⚠️ POR QUE EXISTE ESTO
 *   Sin esta guarda, la ausencia de la tabla pone en VERDE a las pruebas que
 *   solo comprueban "hubo error": autoinvitarse y la RPC de dos argumentos
 *   pasaban porque la tabla no existia, no porque estuvieran protegidas.
 *   Una prueba que pasa por el motivo equivocado es peor que una que falla.
 */
export async function exigirMigracionDeInvitaciones() {
  const a = admin();

  const tabla = await a.from("live_session_invitations").select("id").limit(1);
  if (tabla.error) {
    throw new Error(
      `FALTA LA MIGRACION DE INVITACIONES.\n\n` +
        `  ${tabla.error.code ?? "?"}: ${tabla.error.message}\n\n` +
        `  1. Correr supabase/migrations/20260805_invitaciones_a_sesiones.sql\n` +
        `     (PEGAR SIN el begin;/commit; -- trampa 7 de CLAUDE.md)\n\n` +
        `  2. Si la tabla YA existe, es la cache de esquema de PostgREST, que\n` +
        `     ya paso antes en este proyecto. Comprobar y refrescar:\n\n` +
        `       select to_regclass('public.live_session_invitations');\n` +
        `       notify pgrst, 'reload schema';\n`
    );
  }

  // La tabla puede estar y las funciones no: son bloques distintos de la misma
  // migracion, y el editor de Supabase ya corto una a la mitad una vez.
  const fn = await a.rpc("current_user_is_invited_to_live_session", {
    target_live_session_id: "00000000-0000-0000-0000-000000000000",
  });
  if (fn.error) {
    throw new Error(
      `La tabla esta pero las FUNCIONES no.\n\n` +
        `  ${fn.error.code ?? "?"}: ${fn.error.message}\n\n` +
        `  La migracion entro a medias. Volver a correrla entera.\n`
    );
  }
}

/** Invita a una alumna. Es lo que hace Brunela desde el panel, por service_role. */
export async function invitar(sessionId: string, userId: string) {
  const { error } = await admin()
    .from("live_session_invitations")
    .insert({ live_session_id: sessionId, user_id: userId });
  if (error) throw new Error(`No se pudo invitar: ${error.message}`);
}

/** Carga el enlace de Zoom de una sesion. */
export async function ponerEnlace(sessionId: string, url = "https://zoom.test/zz") {
  const { error } = await admin()
    .from("live_session_access_links")
    .upsert({ live_session_id: sessionId, join_url: url });
  if (error) throw new Error(`No se pudo poner el enlace: ${error.message}`);
}

/** Escribe un mensaje con service_role, sin pasar por las policies. */
export async function sembrarMensaje(roomId: string, userId: string, texto: string) {
  const { error } = await admin()
    .from("chat_messages")
    .insert({ room_id: roomId, user_id: userId, content: texto });
  if (error) throw new Error(`No se pudo sembrar el mensaje: ${error.message}`);
}

/**
 * Se suscribe al canal de una sala y espera un mensaje.
 *
 * Devuelve `true` si LLEGO algo antes del plazo. Es la unica forma de probar el
 * camino de realtime, que es DISTINTO del de REST: uno lo autoriza PostgREST y
 * el otro el servidor de Realtime. Probar solo REST dejaria la mitad sin medir.
 */
export async function recibePorRealtime(
  alumna: Alumna,
  roomId: string,
  disparar: () => Promise<void>,
  msPlazo = 6000
): Promise<boolean> {
  const { data } = await alumna.cliente.auth.getSession();
  const token = data.session?.access_token;
  if (token) await alumna.cliente.realtime.setAuth(token);

  return new Promise<boolean>((resolve) => {
    let resuelto = false;
    const listo = (v: boolean) => {
      if (resuelto) return;
      resuelto = true;
      alumna.cliente.removeChannel(canal);
      resolve(v);
    };

    const canal = alumna.cliente
      .channel(`zz-test-${roomId}-${Math.random()}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages", filter: `room_id=eq.${roomId}` },
        () => listo(true)
      )
      .subscribe(async (estado) => {
        if (estado !== "SUBSCRIBED") return;
        // El disparo va DESPUES de estar suscrita: si se manda antes, no llega
        // y la prueba diria "no recibe" por un problema de tiempos, no de RLS.
        await disparar();
        setTimeout(() => listo(false), msPlazo);
      });
  });
}

/** Borra todo lo que empiece con el prefijo. Corre aunque la prueba falle. */
export async function limpiarResiduos() {
  const a = admin();

  const { data: salas } = await a.from("chat_rooms").select("id").like("name", `${PREFIJO}%`);
  for (const s of salas ?? []) {
    await a.from("chat_messages").delete().eq("room_id", s.id);
    await a.from("chat_rooms").delete().eq("id", s.id);
  }

  // Las sesiones van ANTES que los perfiles: el on delete cascade de
  // live_sessions se lleva reservas, invitaciones y enlaces, asi que borrando la
  // sesion no queda nada colgando que impida borrar la alumna despues.
  const { data: sesiones } = await a.from("live_sessions").select("id").like("slug", `${PREFIJO}%`);
  for (const s of sesiones ?? []) {
    await a.from("live_sessions").delete().eq("id", s.id);
  }

  const { data: packs } = await a.from("packs").select("id").like("slug", `${PREFIJO}%`);
  for (const p of packs ?? []) {
    // Las compras van PRIMERO: pack_purchases.pack_id es `on delete restrict`,
    // asi que con una compra viva el pack no se deja borrar.
    await a.from("pack_purchases").delete().eq("pack_id", p.id);
    await a.from("packs").delete().eq("id", p.id);
  }

  await a.from("documents").delete().like("title", `${PREFIJO}%`);
  await a.from("programs").delete().like("slug", `${PREFIJO}%`);

  const { data: clases } = await a.from("videos").select("id").like("slug", `${PREFIJO}%`);
  for (const c of clases ?? []) {
    await a.from("videos").delete().eq("id", c.id);
  }

  const { data: perfiles } = await a.from("profiles").select("id").like("email", `${PREFIJO}%`);
  for (const p of perfiles ?? []) {
    await a.from("chat_bans").delete().eq("user_id", p.id);
    await a.from("chat_mutes").delete().eq("user_id", p.id);
    await a.auth.admin.deleteUser(p.id);
  }
}

// ── Packs ───────────────────────────────────────────────────────────────────

/** Falla ruidosamente si la migracion de packs no esta puesta. */
export async function exigirMigracionDePacks() {
  const a = admin();

  const tabla = await a.from("packs").select("id").limit(1);
  if (tabla.error) {
    throw new Error(
      `FALTA LA MIGRACION DE PACKS.\n\n` +
        `  ${tabla.error.code ?? "?"}: ${tabla.error.message}\n\n` +
        `  1. Correr supabase/migrations/20260805_packs_de_clases.sql\n` +
        `     (PEGAR SIN el begin;/commit; -- trampa 7 de CLAUDE.md)\n\n` +
        `  2. Si la tabla YA existe, es la cache de esquema de PostgREST:\n\n` +
        `       select to_regclass('public.packs');\n` +
        `       notify pgrst, 'reload schema';\n`
    );
  }

  const fn = await a.rpc("current_user_has_purchased_video", {
    target_video_id: "00000000-0000-0000-0000-000000000000",
  });
  if (fn.error) {
    throw new Error(
      `Las tablas estan pero las FUNCIONES no.\n\n` +
        `  ${fn.error.code ?? "?"}: ${fn.error.message}\n\n` +
        `  La migracion entro a medias. Volver a correrla entera.\n`
    );
  }
}

/** Una clase publicada que exige `tier`. Es lo que un pack va a desbloquear. */
export async function crearClase(tier: Exclude<Tier, "none">): Promise<{ id: string }> {
  const marca = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const { data, error } = await admin()
    .from("videos")
    .insert({
      slug: `${PREFIJO}clase-${marca}`,
      title_i18n: { es: `${PREFIJO}clase ${marca}` },
      status: "published",
      membership_tier_required: tier,
      duration_seconds: 60,
      published_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(`No se pudo crear la clase: ${error?.message}`);
  return data;
}

export async function crearPack(videoIds: string[]): Promise<{ id: string }> {
  const marca = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const { data, error } = await admin()
    .from("packs")
    .insert({
      slug: `${PREFIJO}pack-${marca}`,
      name_i18n: { es: `${PREFIJO}pack ${marca}` },
      price_cents: 1000,
      is_published: true,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(`No se pudo crear el pack: ${error?.message}`);

  if (videoIds.length > 0) {
    const { error: e2 } = await admin()
      .from("pack_videos")
      .insert(videoIds.map((v) => ({ pack_id: data.id, video_id: v })));
    if (e2) throw new Error(`No se pudieron agregar clases al pack: ${e2.message}`);
  }
  return data;
}

/** Simula lo que escribe el webhook al cobrarse un pack. */
export async function comprarPack(
  packId: string,
  userId: string,
  opts: { vencida?: boolean } = {}
) {
  const { error } = await admin().from("pack_purchases").insert({
    user_id: userId,
    pack_id: packId,
    stripe_checkout_session_id: `${PREFIJO}cs-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    amount_total_cents: 1000,
    currency: "eur",
    expires_at: opts.vencida ? new Date(Date.now() - 86_400_000).toISOString() : null,
  });
  if (error) throw new Error(`No se pudo registrar la compra: ${error.message}`);
}

// ── Sembrado para la auditoria adversarial ──────────────────────────────────

export async function crearPrograma(tier: Exclude<Tier, "none">): Promise<{ id: string }> {
  const marca = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const { data, error } = await admin()
    .from("programs")
    .insert({
      slug: `${PREFIJO}prog-${marca}`,
      title_i18n: { es: `${PREFIJO}prog ${marca}` },
      status: "published",
      membership_tier_required: tier,
      duration_days: 7,
      published_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(`No se pudo crear el programa: ${error?.message}`);
  return data;
}

export async function crearDocumento(tier: Exclude<Tier, "none">): Promise<{ id: string }> {
  const marca = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const { data, error } = await admin()
    .from("documents")
    .insert({
      title: `${PREFIJO}doc ${marca}`,
      file_url: `${PREFIJO}${marca}.pdf`,
      membership_tier_required: tier,
      is_published: true,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(`No se pudo crear el documento: ${error?.message}`);
  return data;
}

/** Cliente ANONIMO: la clave publicable, sin ninguna sesion. */
export function anonimo(): SupabaseClient {
  return createClient(URL, PUB, { auth: { persistSession: false } });
}
