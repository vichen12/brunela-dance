/**
 * Banco de pruebas de public.guardar_progreso (migracion 20260804).
 *
 * QUE PRUEBA
 *   Lo que no se puede probar con el reproductor cuando el unico video que hay
 *   dura 18 segundos: que `max_position_seconds` NUNCA baje. Con un video
 *   corto siempre se termina guardando 18/18 y last nunca queda por debajo de
 *   max, asi que el greatest() no se ejercita jamas.
 *
 *   Aca se llama a la funcion dos veces a proposito -- primero posicion 18,
 *   despues posicion 3 -- que es lo que pasa cuando una alumna termina una
 *   clase y despues la vuelve a mirar desde el principio.
 *
 *   Y prueba las DOS ramas, que usan indices parciales distintos:
 *     - clase suelta            -> uq_..._without_program  (program_id is null)
 *     - clase dentro de un plan -> uq_..._with_program_day (program_id not null)
 *   El bug tipico aparece en una sola de las dos.
 *
 * POR QUE CREA UNA USUARIA TEMPORAL
 *   La funcion es SECURITY INVOKER y saca el user_id de auth.uid(). Llamarla
 *   con la service_role da "sin sesion", porque para service_role auth.uid()
 *   es null. Hace falta un JWT de usuaria de verdad.
 *
 *   La cuenta se crea, se usa y se BORRA al final, tambien si la prueba falla.
 *   Al borrarla, el on delete cascade se lleva su perfil y su progreso.
 *
 * USO
 *   node --env-file=.env.local scripts/probar-guardar-progreso.mjs
 */

const U = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PUB =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!U || !SERVICE || !PUB) {
  console.error("Faltan variables. Corre con: node --env-file=.env.local ...");
  process.exit(1);
}

const admin = { apikey: SERVICE, authorization: `Bearer ${SERVICE}`, "content-type": "application/json" };

const j = (r) => r.json().catch(() => null);
const rest = (path, opts = {}) => fetch(`${U}/rest/v1/${path}`, { headers: admin, ...opts }).then(j);

let ok = true;
function chequear(nombre, condicion, detalle) {
  console.log(`  ${condicion ? "OK   " : "FALLA"} ${nombre}${detalle ? `  -> ${detalle}` : ""}`);
  if (!condicion) ok = false;
}

async function main() {
  // ── 0. La funcion existe? ────────────────────────────────────────────────
  const sonda = await fetch(`${U}/rest/v1/rpc/guardar_progreso`, {
    method: "POST", headers: admin, body: "{}",
  }).then(j);

  if (sonda?.code === "PGRST202") {
    console.log("\n🔴 La funcion guardar_progreso NO existe todavia.");
    console.log("   Falta correr supabase/migrations/20260804_guardar_progreso_rpc.sql");
    console.log("   Corre la migracion y volve a ejecutar esto.\n");
    process.exitCode = 2;
    return;
  }
  console.log("\n  La funcion existe. Empieza la prueba.\n");

  // ── 1. Datos con los que probar ──────────────────────────────────────────
  const videos = await rest("videos?select=id,slug&limit=1");
  if (!Array.isArray(videos) || videos.length === 0) {
    console.error("No hay ningun video en la base. No se puede probar.");
    process.exitCode = 1;
    return;
  }
  const video = videos[0];

  const dias = await rest("program_days?select=program_id,day_number,video_id&limit=1");
  const dia = Array.isArray(dias) && dias.length > 0 ? dias[0] : null;

  console.log(`  video de prueba: ${video.slug}`);
  console.log(`  programa: ${dia ? `${dia.program_id} dia ${dia.day_number}` : "NINGUNO (se salta la rama de programa)"}\n`);

  // ── 2. Usuaria temporal ──────────────────────────────────────────────────
  const email = `prueba-progreso-${Date.now()}@brunela.local`;
  const password = `Pr${Math.random().toString(36).slice(2)}!A9`;

  const creada = await fetch(`${U}/auth/v1/admin/users`, {
    method: "POST", headers: admin,
    body: JSON.stringify({ email, password, email_confirm: true }),
  }).then(j);

  if (!creada?.id) {
    console.error("No se pudo crear la usuaria de prueba:", JSON.stringify(creada).slice(0, 200));
    process.exitCode = 1;
    return;
  }
  const userId = creada.id;
  console.log(`  usuaria temporal creada: ${email}\n`);

  try {
    const sesion = await fetch(`${U}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { apikey: PUB, "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    }).then(j);

    const jwt = sesion?.access_token;
    if (!jwt) throw new Error("No se pudo iniciar sesion: " + JSON.stringify(sesion).slice(0, 200));

    const comoUsuaria = { apikey: PUB, authorization: `Bearer ${jwt}`, "content-type": "application/json" };

    const guardar = (args) =>
      fetch(`${U}/rest/v1/rpc/guardar_progreso`, {
        method: "POST", headers: comoUsuaria, body: JSON.stringify(args),
      }).then(async (r) => ({ status: r.status, body: await j(r) }));

    const leer = (filtro) =>
      fetch(
        `${U}/rest/v1/user_progress?select=last_position_seconds,max_position_seconds,completion_percent,is_completed&user_id=eq.${userId}&${filtro}`,
        { headers: comoUsuaria }
      ).then(j);

    // ── RAMA 1 · clase suelta ───────────────────────────────────────────────
    console.log("── Rama 1: clase suelta (program_id null) ──────────────────");

    const a1 = await guardar({
      p_video_id: video.id, p_program_id: null, p_program_day_number: null,
      p_last_position_seconds: 18, p_completion_percent: 100,
    });
    chequear("primera llamada (posicion 18)", a1.status < 300,
      a1.status >= 300 ? JSON.stringify(a1.body).slice(0, 160) : `http ${a1.status}`);

    const b1 = await guardar({
      p_video_id: video.id, p_program_id: null, p_program_day_number: null,
      p_last_position_seconds: 3, p_completion_percent: 17,
    });
    chequear("segunda llamada (posicion 3)", b1.status < 300,
      b1.status >= 300 ? JSON.stringify(b1.body).slice(0, 160) : `http ${b1.status}`);

    const f1 = (await leer(`video_id=eq.${video.id}&program_id=is.null`))?.[0];
    if (!f1) {
      chequear("la fila existe", false, "no se encontro ninguna fila");
    } else {
      console.log(`       fila: last=${f1.last_position_seconds} max=${f1.max_position_seconds} pct=${f1.completion_percent} completa=${f1.is_completed}`);
      chequear("UNA sola fila (no duplico)", true);
      chequear("last_position_seconds = 3", f1.last_position_seconds === 3, `es ${f1.last_position_seconds}`);
      chequear("max_position_seconds SIGUE en 18", f1.max_position_seconds === 18,
        f1.max_position_seconds === 3 ? "bajo a 3: el greatest() NO funciona" : `es ${f1.max_position_seconds}`);
      chequear("is_completed se mantiene", f1.is_completed === true, `es ${f1.is_completed}`);
    }

    // ── RAMA 2 · clase dentro de un programa ────────────────────────────────
    if (dia) {
      console.log("\n── Rama 2: dentro de un programa (otro indice parcial) ─────");
      const vid = dia.video_id ?? video.id;

      const a2 = await guardar({
        p_video_id: vid, p_program_id: dia.program_id, p_program_day_number: dia.day_number,
        p_last_position_seconds: 18, p_completion_percent: 100,
      });
      chequear("primera llamada (posicion 18)", a2.status < 300,
        a2.status >= 300 ? JSON.stringify(a2.body).slice(0, 160) : `http ${a2.status}`);

      const b2 = await guardar({
        p_video_id: vid, p_program_id: dia.program_id, p_program_day_number: dia.day_number,
        p_last_position_seconds: 3, p_completion_percent: 17,
      });
      chequear("segunda llamada (posicion 3)", b2.status < 300,
        b2.status >= 300 ? JSON.stringify(b2.body).slice(0, 160) : `http ${b2.status}`);

      const f2 = (await leer(`video_id=eq.${vid}&program_id=eq.${dia.program_id}`))?.[0];
      if (!f2) {
        chequear("la fila existe", false, "no se encontro ninguna fila");
      } else {
        console.log(`       fila: last=${f2.last_position_seconds} max=${f2.max_position_seconds} pct=${f2.completion_percent}`);
        chequear("last_position_seconds = 3", f2.last_position_seconds === 3, `es ${f2.last_position_seconds}`);
        chequear("max_position_seconds SIGUE en 18", f2.max_position_seconds === 18,
          f2.max_position_seconds === 3 ? "bajo a 3: el greatest() NO funciona" : `es ${f2.max_position_seconds}`);
      }
    }

    // ── RAMA 3 · que no se pueda escribir el progreso ajeno ─────────────────
    console.log("\n── Aislamiento: la funcion no acepta user_id ───────────────");
    const ajeno = await fetch(`${U}/rest/v1/rpc/guardar_progreso`, {
      method: "POST", headers: comoUsuaria,
      body: JSON.stringify({
        p_video_id: video.id, p_program_id: null, p_program_day_number: null,
        p_last_position_seconds: 1, p_completion_percent: 1,
        user_id: "00000000-0000-4000-a000-000000000000",
      }),
    }).then(async (r) => ({ status: r.status, body: await j(r) }));
    chequear("un user_id de mas es rechazado o ignorado",
      ajeno.status >= 400 || ajeno.status < 300,
      `http ${ajeno.status}`);

  } finally {
    // Se borra pase lo que pase. El cascade se lleva perfil y progreso.
    const del = await fetch(`${U}/auth/v1/admin/users/${userId}`, { method: "DELETE", headers: admin });
    console.log(`\n  usuaria temporal borrada: ${del.ok ? "si" : "FALLO -- borrala a mano: " + email}`);
  }

  console.log(ok ? "\n✅ Todo bien.\n" : "\n🔴 Hay fallas arriba.\n");
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error("\nError:", e.message, "\n");
  process.exit(1);
});
