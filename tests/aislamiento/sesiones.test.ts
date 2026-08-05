import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  admin,
  crearAlumna,
  crearSesion,
  exigirMigracionDeInvitaciones,
  invitar,
  limpiarResiduos,
  ponerEnlace,
  type Alumna,
} from "./ayudantes";

/**
 * Invitaciones a sesiones en vivo.
 *
 * Una invitacion es la PRIMERA cosa del sistema que da acceso sin mirar el plan.
 * Hasta ahora todo salia de membership_tier_required y nada mas. Eso la vuelve
 * la pieza con mas superficie de error del proyecto: abre tres lugares a la vez
 * y uno de ellos protege el enlace de Zoom.
 *
 * Estas pruebas existen para que abrirla de mas se note.
 *
 * LOS TRES LUGARES, QUE SON TRES PRUEBAS DISTINTAS
 *   1. verla en el listado ....... policy live_sessions_select_allowed_by_tier
 *   2. poder reservarla .......... trigger validate_live_session_booking
 *   3. ver el enlace de Zoom ..... can_current_user_view_live_session_link()
 *
 *   Pasar solo la 1 es el fallo tipico: la alumna ve la clase, la reserva, y el
 *   Zoom no le aparece nunca.
 */

let sinPlan: Alumna;
let otraSinPlan: Alumna;
let principal: Alumna;

let sesion: { id: string };

beforeAll(async () => {
  // Lo PRIMERO. Si la migracion no esta, todo el archivo tiene que caerse con un
  // mensaje que diga que hacer -- no repartir verdes que no significan nada.
  await exigirMigracionDeInvitaciones();
  await limpiarResiduos();

  [sinPlan, otraSinPlan, principal] = await Promise.all([
    crearAlumna("none"),
    crearAlumna("none"),
    crearAlumna("principal"),
  ]);

  sesion = await crearSesion({ tier: "principal" });
  await ponerEnlace(sesion.id);
}, 60_000);

afterAll(async () => {
  await limpiarResiduos();
}, 60_000);

// ── Sin invitacion: nada cambia ─────────────────────────────────────────────

describe("sin invitacion (que lo de hoy siga igual)", () => {
  it("sin plan NO ve la sesion", async () => {
    const { data } = await sinPlan.cliente
      .from("live_sessions").select("id").eq("id", sesion.id);
    expect(data ?? []).toHaveLength(0);
  });

  it("sin plan NO puede reservar", async () => {
    const { error } = await sinPlan.cliente
      .from("live_session_bookings")
      .insert({ live_session_id: sesion.id, user_id: sinPlan.id });
    // El motivo importa: un insert puede fallar por diez cosas. Lo que se
    // prueba es que la frena EL PLAN, no un not-null ni un permiso suelto.
    expect(error?.message).toContain("Membership tier does not allow");
  });

  it("sin plan NO ve el enlace de Zoom", async () => {
    const { data } = await sinPlan.cliente
      .from("live_session_access_links").select("join_url").eq("live_session_id", sesion.id);
    expect(data ?? []).toHaveLength(0);
  });

  it("con plan suficiente SI ve la sesion (no se rompio lo que andaba)", async () => {
    const { data } = await principal.cliente
      .from("live_sessions").select("id").eq("id", sesion.id);
    expect((data ?? []).length).toBeGreaterThan(0);
  });
});

// ── Con invitacion: los tres lugares ────────────────────────────────────────

describe("con invitacion", () => {
  let invitada: Alumna;
  let sesionInvitada: { id: string };

  beforeAll(async () => {
    invitada = await crearAlumna("none");
    sesionInvitada = await crearSesion({ tier: "principal" });
    await ponerEnlace(sesionInvitada.id);
    await invitar(sesionInvitada.id, invitada.id);
  }, 60_000);

  it("1 · la ve, aunque no tenga plan", async () => {
    const { data } = await invitada.cliente
      .from("live_sessions").select("id").eq("id", sesionInvitada.id);
    expect((data ?? []).length).toBeGreaterThan(0);
  });

  it("2 · la puede reservar", async () => {
    const { error } = await invitada.cliente
      .from("live_session_bookings")
      .insert({ live_session_id: sesionInvitada.id, user_id: invitada.id });
    expect(error).toBeNull();
  });

  it("3 · YA reservada, ve el enlace de Zoom", async () => {
    // Depende de la prueba anterior a proposito: sin reserva no tiene que verlo,
    // y eso es justamente lo que comprueba la ultima prueba de este bloque.
    const { data } = await invitada.cliente
      .from("live_session_access_links").select("join_url").eq("live_session_id", sesionInvitada.id);
    expect((data ?? []).length).toBeGreaterThan(0);
  });

  it("la invitacion NO la mete en otras sesiones", async () => {
    const { data } = await invitada.cliente
      .from("live_sessions").select("id").eq("id", sesion.id);
    expect(data ?? []).toHaveLength(0);
  });

  it("la invitacion de otra NO le sirve a nadie mas", async () => {
    const { data } = await otraSinPlan.cliente
      .from("live_sessions").select("id").eq("id", sesionInvitada.id);
    expect(data ?? []).toHaveLength(0);
  });

  it("invitada SIN reservar NO ve el enlace", async () => {
    const s = await crearSesion({ tier: "principal" });
    await ponerEnlace(s.id);
    await invitar(s.id, invitada.id);

    const { data } = await invitada.cliente
      .from("live_session_access_links").select("join_url").eq("live_session_id", s.id);
    expect(data ?? []).toHaveLength(0);
  });
});

// ── Lo que la invitacion NO tiene que abrir ─────────────────────────────────

describe("limites de la invitacion", () => {
  it("el CUPO se respeta: con la sala llena cae en lista de espera, no en reserva", async () => {
    const s = await crearSesion({ tier: "principal", capacity: 1 });
    // La sala se llena con alguien que si tiene plan.
    await admin().from("live_session_bookings")
      .insert({ live_session_id: s.id, user_id: principal.id, status: "reserved" });

    const colada = await crearAlumna("none");
    await invitar(s.id, colada.id);

    const { data, error } = await colada.cliente
      .from("live_session_bookings")
      .insert({ live_session_id: s.id, user_id: colada.id })
      .select("status")
      .single();

    expect(error).toBeNull();
    // El trigger la degrada. Si esto dijera 'reserved', la invitacion estaria
    // sobrevendiendo una sala de Zoom con limite duro.
    expect(data?.status).toBe("waitlisted");
  });

  it("una sesion en BORRADOR sigue siendo invisible aunque haya invitacion", async () => {
    const s = await crearSesion({ tier: "principal" });
    const espia = await crearAlumna("none");
    await invitar(s.id, espia.id);
    await admin().from("live_sessions").update({ status: "draft" }).eq("id", s.id);

    const { data } = await espia.cliente
      .from("live_sessions").select("id").eq("id", s.id);
    expect(data ?? []).toHaveLength(0);
  });

  it("la ventana de reservas cerrada SI la saltea (es a proposito)", async () => {
    const s = await crearSesion({ tier: "principal", cerradaDesdeHace: true });
    const tarde = await crearAlumna("none");
    await invitar(s.id, tarde.id);

    const { error } = await tarde.cliente
      .from("live_session_bookings")
      .insert({ live_session_id: s.id, user_id: tarde.id });
    expect(error).toBeNull();
  });

  it("sin invitacion, la ventana cerrada SI frena", async () => {
    const s = await crearSesion({ tier: "principal", cerradaDesdeHace: true });
    const { error } = await principal.cliente
      .from("live_session_bookings")
      .insert({ live_session_id: s.id, user_id: principal.id });
    // Es el par de la prueba anterior: aquella comprueba que la invitacion
    // ABRE la ventana, esta que sin invitacion sigue CERRADA. Si no se exigiera
    // el motivo, las dos pasarian con la ventana rota de cualquier otra forma.
    expect(error?.message).toContain("Booking window is closed");
  });
});

// ── La tabla de invitaciones en si ──────────────────────────────────────────

describe("la tabla de invitaciones no filtra ni se deja escribir", () => {
  it("una alumna NO ve las invitaciones de otra", async () => {
    const s = await crearSesion({ tier: "principal" });
    await invitar(s.id, principal.id);

    const { data } = await sinPlan.cliente
      .from("live_session_invitations").select("id").eq("live_session_id", s.id);
    expect(data ?? []).toHaveLength(0);
  });

  it("una alumna SI ve las suyas", async () => {
    const s = await crearSesion({ tier: "principal" });
    await invitar(s.id, sinPlan.id);

    const { data } = await sinPlan.cliente
      .from("live_session_invitations").select("id").eq("live_session_id", s.id);
    expect((data ?? []).length).toBeGreaterThan(0);
  });

  it("una alumna NO se puede autoinvitar", async () => {
    const s = await crearSesion({ tier: "principal" });
    const { error } = await sinPlan.cliente
      .from("live_session_invitations")
      .insert({ live_session_id: s.id, user_id: sinPlan.id });

    // Se exige el codigo EXACTO, no "hubo error". 42501 es permission denied:
    // la frena el GRANT, que es donde tiene que frenarla. Con "not.toBeNull()"
    // esta prueba pasaba tambien cuando la tabla no existia.
    expect(error?.code).toBe("42501");
  });

  it("una alumna NO puede borrar su invitacion ni la de nadie", async () => {
    const s = await crearSesion({ tier: "principal" });
    await invitar(s.id, sinPlan.id);

    await sinPlan.cliente
      .from("live_session_invitations").delete().eq("live_session_id", s.id);

    // Se comprueba contra la base, no contra el error: un delete que no borra
    // nada tambien puede devolver error null.
    const { count } = await admin()
      .from("live_session_invitations")
      .select("id", { count: "exact", head: true })
      .eq("live_session_id", s.id);
    expect(count).toBe(1);
  });

  it("la RPC de dos argumentos NO es alcanzable por una alumna", async () => {
    // Si estuviera expuesta, cualquiera podria enumerar quien esta invitada a que.
    const s = await crearSesion({ tier: "principal" });

    const conSesion = await sinPlan.cliente.rpc("is_invited_to_live_session", {
      target_live_session_id: s.id,
      target_user_id: principal.id,
    });
    // Sin EXECUTE, PostgREST ni la ve: no esta en el esquema expuesto para ese
    // rol. Se comprueba tambien que NO devolvio dato, que es lo que importa.
    expect(conSesion.error).not.toBeNull();
    expect(conSesion.data).toBeNull();

    // Y el control positivo: la MISMA funcion si responde por service_role. Sin
    // esto, la prueba de arriba pasaria igual si la funcion no existiera --
    // que es exactamente como paso en falso la primera vez.
    const porServiceRole = await admin().rpc("is_invited_to_live_session", {
      target_live_session_id: s.id,
      target_user_id: principal.id,
    });
    expect(porServiceRole.error).toBeNull();
    expect(porServiceRole.data).toBe(false);
  });

  it("la RPC de un argumento SI funciona, y solo habla de quien pregunta", async () => {
    const s = await crearSesion({ tier: "principal" });
    await invitar(s.id, sinPlan.id);

    const propia = await sinPlan.cliente.rpc("current_user_is_invited_to_live_session", {
      target_live_session_id: s.id,
    });
    const ajena = await otraSinPlan.cliente.rpc("current_user_is_invited_to_live_session", {
      target_live_session_id: s.id,
    });

    expect(propia.data).toBe(true);
    expect(ajena.data).toBe(false);
  });
});

/*
 * ── COMO COMPROBAR QUE ESTAS PRUEBAS PUEDEN FALLAR ─────────────────────────
 *
 * Se invierte la regla A PROPOSITO en el SQL Editor y se confirma el rojo:
 *
 *   -- Abre el enlace de Zoom a cualquiera con sesion:
 *   create or replace function public.can_current_user_view_live_session_link(uuid)
 *   returns boolean language sql stable security definer set search_path = public
 *   as $$ select auth.uid() is not null $$;
 *
 *   npm run test:aislamiento
 *     -> tiene que ponerse en ROJO, como minimo:
 *        - sin plan NO ve el enlace de Zoom
 *        - invitada SIN reservar NO ve el enlace
 *
 * Y DESPUES SE RESTAURA corriendo de nuevo
 * supabase/migrations/20260805_invitaciones_a_sesiones.sql.
 *
 * ⚠️ Hacerlo sin nadie usando el sistema: mientras este invertida, el enlace
 *    esta abierto de verdad.
 */
