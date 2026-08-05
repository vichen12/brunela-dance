import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  admin,
  crearAlumna,
  crearSala,
  limpiarResiduos,
  recibePorRealtime,
  sembrarMensaje,
  type Alumna,
} from "./ayudantes";

/**
 * Aislamiento del chat.
 *
 * Hasta hoy NADA verificaba que una alumna de corps no viera los mensajes de
 * una sala de principal, ni que un DM fuera privado. Estas pruebas existen
 * para que romper esa regla se note, no para que se descubra despues.
 *
 * SE PRUEBAN LOS DOS CAMINOS
 *   REST y realtime autorizan por lugares distintos: uno lo resuelve PostgREST
 *   y el otro el servidor de Realtime, aunque las dos apoyen en las mismas
 *   policies. Probar solo uno deja la mitad sin medir.
 *
 * COMO COMPROBAR QUE ESTAS PRUEBAS PUEDEN FALLAR
 *   Ver el bloque al final del archivo. Una prueba que no puede fallar no es
 *   una prueba.
 */

let corps: Alumna;
let principal: Alumna;
let sinPlan: Alumna;
let otra: Alumna;

let salaPrincipal: { id: string };
let salaCorps: { id: string };
let salaComunidad: { id: string };
let dmAjeno: { id: string };

beforeAll(async () => {
  await limpiarResiduos();

  [corps, principal, sinPlan, otra] = await Promise.all([
    crearAlumna("corps_de_ballet"),
    crearAlumna("principal"),
    crearAlumna("none"),
    crearAlumna("solista"),
  ]);

  [salaPrincipal, salaCorps, salaComunidad] = await Promise.all([
    crearSala({ tipo: "tier", tier: "principal" }),
    crearSala({ tipo: "tier", tier: "corps_de_ballet" }),
    crearSala({ tipo: "community" }),
  ]);

  // Un DM entre `otra` y `principal`. `corps` no participa.
  dmAjeno = await crearSala({ tipo: "dm", participantes: [otra.id, principal.id] });

  await Promise.all([
    sembrarMensaje(salaPrincipal.id, principal.id, "secreto de principal"),
    sembrarMensaje(salaCorps.id, corps.id, "hola corps"),
    sembrarMensaje(salaComunidad.id, principal.id, "hola a todas"),
    sembrarMensaje(dmAjeno.id, otra.id, "esto es privado"),
  ]);
}, 60_000);

afterAll(async () => {
  await limpiarResiduos();
}, 60_000);

// ── Plan ────────────────────────────────────────────────────────────────────

describe("aislamiento por plan", () => {
  it("corps NO lee los mensajes de una sala de principal", async () => {
    const { data } = await corps.cliente
      .from("chat_messages").select("id, content").eq("room_id", salaPrincipal.id);
    expect(data ?? []).toHaveLength(0);
  });

  it("corps NO recibe por realtime los mensajes de una sala de principal", async () => {
    const llego = await recibePorRealtime(corps, salaPrincipal.id, async () => {
      await sembrarMensaje(salaPrincipal.id, principal.id, "en vivo, solo principal");
    });
    expect(llego).toBe(false);
  });

  it("corps SI lee su propia sala", async () => {
    const { data } = await corps.cliente
      .from("chat_messages").select("id").eq("room_id", salaCorps.id);
    expect((data ?? []).length).toBeGreaterThan(0);
  });

  it("principal SI lee una sala de corps (rango mayor incluye al menor)", async () => {
    const { data } = await principal.cliente
      .from("chat_messages").select("id").eq("room_id", salaCorps.id);
    expect((data ?? []).length).toBeGreaterThan(0);
  });

  it("quien no tiene plan NO lee ninguna sala de tier", async () => {
    const { data } = await sinPlan.cliente
      .from("chat_messages").select("id").eq("room_id", salaCorps.id);
    expect(data ?? []).toHaveLength(0);
  });

  it("quien no tiene plan SI lee la sala de comunidad", async () => {
    const { data } = await sinPlan.cliente
      .from("chat_messages").select("id").eq("room_id", salaComunidad.id);
    expect((data ?? []).length).toBeGreaterThan(0);
  });

  it("corps NO puede escribir en una sala de principal", async () => {
    const { error } = await corps.cliente
      .from("chat_messages")
      .insert({ room_id: salaPrincipal.id, user_id: corps.id, content: "me cuelo" });
    expect(error).not.toBeNull();
  });
});

// ── Mensajes privados ───────────────────────────────────────────────────────

describe("mensajes privados", () => {
  it("nadie lee un DM del que no participa", async () => {
    const { data } = await corps.cliente
      .from("chat_messages").select("id, content").eq("room_id", dmAjeno.id);
    expect(data ?? []).toHaveLength(0);
  });

  it("nadie recibe por realtime un DM del que no participa", async () => {
    const llego = await recibePorRealtime(corps, dmAjeno.id, async () => {
      await sembrarMensaje(dmAjeno.id, otra.id, "sigue siendo privado");
    });
    expect(llego).toBe(false);
  });

  it("quien SI participa lo lee", async () => {
    const { data } = await otra.cliente
      .from("chat_messages").select("id").eq("room_id", dmAjeno.id);
    expect((data ?? []).length).toBeGreaterThan(0);
  });

  it("nadie escribe en un DM ajeno", async () => {
    const { error } = await corps.cliente
      .from("chat_messages")
      .insert({ room_id: dmAjeno.id, user_id: corps.id, content: "me meto" });
    expect(error).not.toBeNull();
  });
});

// ── Moderación ──────────────────────────────────────────────────────────────

describe("moderacion", () => {
  it("una alumna baneada no puede escribir", async () => {
    await admin().from("chat_bans").insert({
      user_id: corps.id, banned_by: principal.id, reason: "prueba", expires_at: null,
    });

    const { error } = await corps.cliente
      .from("chat_messages")
      .insert({ room_id: salaComunidad.id, user_id: corps.id, content: "estoy baneada" });

    await admin().from("chat_bans").delete().eq("user_id", corps.id);
    expect(error).not.toBeNull();
  });

  it("una alumna muteada no puede escribir", async () => {
    await admin().from("chat_mutes").insert({
      user_id: corps.id, muted_by: principal.id, reason: "prueba", expires_at: null,
    });

    const { error } = await corps.cliente
      .from("chat_messages")
      .insert({ room_id: salaComunidad.id, user_id: corps.id, content: "estoy muteada" });

    await admin().from("chat_mutes").delete().eq("user_id", corps.id);
    expect(error).not.toBeNull();
  });

  it("un muteo VENCIDO ya no frena", async () => {
    await admin().from("chat_mutes").insert({
      user_id: corps.id, muted_by: principal.id, reason: "vencido",
      expires_at: new Date(Date.now() - 60_000).toISOString(),
    });

    const { error } = await corps.cliente
      .from("chat_messages")
      .insert({ room_id: salaComunidad.id, user_id: corps.id, content: "ya puedo" });

    await admin().from("chat_mutes").delete().eq("user_id", corps.id);
    expect(error).toBeNull();
  });
});

/*
 * ── COMO COMPROBAR QUE ESTAS PRUEBAS PUEDEN FALLAR ─────────────────────────
 *
 * Una prueba que pasa siempre no prueba nada. Para verificarlo, se invierte una
 * regla A PROPOSITO en el SQL Editor y se confirma que el rojo aparece:
 *
 *   -- Abre el chat a cualquiera, sin mirar el plan:
 *   drop policy if exists "chat_messages_select_room_member" on public.chat_messages;
 *   create policy "chat_messages_select_room_member"
 *     on public.chat_messages for select to authenticated
 *     using (true);
 *
 *   npm run test:aislamiento
 *     -> tienen que ponerse en ROJO, como minimo:
 *        - corps NO lee los mensajes de una sala de principal
 *        - quien no tiene plan NO lee ninguna sala de tier
 *        - nadie lee un DM del que no participa
 *
 * Y DESPUES SE RESTAURA corriendo de nuevo
 * supabase/migrations/20260804_chat_aislamiento_por_plan.sql, que vuelve a
 * crear las tres policies como corresponde.
 *
 * ⚠️ Hacerlo en un momento sin nadie usando el sistema: mientras la policy este
 *    invertida, el chat esta abierto de verdad.
 */
