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

  const { data: perfiles } = await a.from("profiles").select("id").like("email", `${PREFIJO}%`);
  for (const p of perfiles ?? []) {
    await a.from("chat_bans").delete().eq("user_id", p.id);
    await a.from("chat_mutes").delete().eq("user_id", p.id);
    await a.auth.admin.deleteUser(p.id);
  }
}
