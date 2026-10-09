/**
 * Borra TODO lo que creo scripts/sembrar-demo.mjs, y nada mas.
 *
 *   node --env-file=.env.local scripts/borrar-demo.mjs
 *
 * Solo toca filas marcadas como demo: slug `demo-...`, titulo/nombre
 * "Demo · ...", y cuentas `...@brunela.test`. El orden importa por las claves
 * foraneas RESTRICT (ver scripts/borrar-datos-de-prueba.sql): compras de packs
 * y dias de planes van antes que packs y clases.
 */
import { createClient } from "@supabase/supabase-js";

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const ok = (r, que) => { if (r.error) throw new Error(`${que}: ${r.error.message}`); return r.data; };
const ids = async (tabla, col, patron) => ok(await db.from(tabla).select("id").like(col, patron), tabla).map((x) => x.id);

// Cuentas demo
const cuentas = [];
for (let page = 1; page < 50; page++) {
  const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
  if (error) throw error;
  cuentas.push(...data.users.filter((u) => u.email?.toLowerCase().endsWith("@brunela.test")));
  if (data.users.length < 200) break;
}
const idsCuentas = cuentas.map((u) => u.id);

const packs = await ids("packs", "slug", "demo-%");
const clases = await ids("videos", "slug", "demo-%");
const planes = await ids("programs", "slug", "demo-%");
const sesiones = await ids("live_sessions", "slug", "demo-%");
const salas = await ids("chat_rooms", "name", "Demo · %");

if (packs.length) {
  ok(await db.from("pack_purchases").delete().in("pack_id", packs), "compras");
  ok(await db.from("pack_videos").delete().in("pack_id", packs), "pack_videos");
  ok(await db.from("packs").delete().in("id", packs), "packs");
}
if (planes.length) ok(await db.from("program_days").delete().in("program_id", planes), "dias");
if (clases.length) {
  ok(await db.from("program_days").delete().in("video_id", clases), "dias de clases demo en planes reales");
  ok(await db.from("pack_videos").delete().in("video_id", clases), "clases demo en packs reales");
  ok(await db.from("user_progress").delete().in("video_id", clases), "progreso");
}
if (planes.length) ok(await db.from("programs").delete().in("id", planes), "planes");
if (clases.length) ok(await db.from("videos").delete().in("id", clases), "clases");
if (sesiones.length) {
  for (const t of ["live_session_bookings", "live_session_invitations", "live_session_access_links"]) ok(await db.from(t).delete().in("live_session_id", sesiones), t);
  ok(await db.from("live_sessions").delete().in("id", sesiones), "sesiones");
}
if (salas.length) {
  ok(await db.from("chat_messages").delete().in("room_id", salas), "mensajes");
  ok(await db.from("chat_rooms").delete().in("id", salas), "salas");
}
ok(await db.from("documents").delete().like("title", "Demo · %"), "documentos");
ok(await db.from("studio_announcements").delete().like("title", "Demo · %"), "anuncios");

// Las cuentas al final: sus reservas, progreso y compras caen en cascada.
// Las salas de DM no tienen clave foranea (participant_ids es un arreglo):
// se borran las que tengan una cuenta demo adentro.
if (idsCuentas.length) {
  const dms = ok(await db.from("chat_rooms").select("id").overlaps("participant_ids", idsCuentas), "dms").map((x) => x.id);
  if (dms.length) {
    ok(await db.from("chat_messages").delete().in("room_id", dms), "mensajes dm");
    ok(await db.from("chat_rooms").delete().in("id", dms), "dms");
  }
  ok(await db.from("chat_messages").delete().in("user_id", idsCuentas), "mensajes sueltos");
  for (const u of cuentas) {
    const r = await db.auth.admin.deleteUser(u.id);
    if (r.error) console.warn("  no se pudo borrar", u.email, r.error.message);
  }
}
console.log(`Borrado: ${clases.length} clases, ${planes.length} planes, ${sesiones.length} sesiones, ${packs.length} packs, ${salas.length} salas, ${cuentas.length} cuentas.`);
