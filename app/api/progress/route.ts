import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";

const schema = z.object({
  videoId: z.string().uuid(),
  programId: z.string().uuid().nullable().optional(),
  programDayNumber: z.number().int().positive().nullable().optional(),
  lastPositionSeconds: z.number().int().min(0),
  completionPercent: z.number().min(0).max(100)
});

/**
 * Lightweight progress upsert used by the video player (called periodically).
 * Auth + tier access are enforced by RLS via the user-scoped Supabase client.
 */
export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  const { videoId, programId, programDayNumber, lastPositionSeconds, completionPercent } = parsed.data;

  // ── Camino nuevo: UN viaje ────────────────────────────────────────────────
  // La funcion resuelve el maximo con greatest() del lado de la base, asi que
  // desaparece el select previo. Ver 20260804_guardar_progreso_rpc.sql.
  //
  // El user_id NO se manda: la funcion lo toma de auth.uid(). Un parametro se
  // puede falsificar desde la consola; auth.uid() no.
  const rpc = await supabase.rpc("guardar_progreso", {
    p_video_id: videoId,
    p_program_id: programId ?? null,
    p_program_day_number: programId ? programDayNumber ?? null : null,
    p_last_position_seconds: lastPositionSeconds,
    p_completion_percent: completionPercent,
  });

  if (!rpc.error) {
    return NextResponse.json({ ok: true });
  }

  // ── Camino viejo: dos viajes ──────────────────────────────────────────────
  // Solo mientras la migracion no este corrida. PostgREST devuelve PGRST202
  // ("could not find the function") cuando la funcion no existe todavia.
  //
  // Cualquier OTRO error se propaga: si la funcion existe pero fallo, caer al
  // camino viejo escondería el problema y guardaría igual, que es peor que
  // fallar -- nadie se enteraría de que la ruta rapida esta rota.
  if (rpc.error.code !== "PGRST202") {
    return NextResponse.json({ error: rpc.error.message }, { status: 500 });
  }

  const baseQuery = supabase
    .from("user_progress")
    .select("id, max_position_seconds")
    .eq("user_id", user.id)
    .eq("video_id", videoId);

  const { data: existing } = await (programId
    ? baseQuery.eq("program_id", programId).limit(1).maybeSingle()
    : baseQuery.is("program_id", null).limit(1).maybeSingle());

  const payload = {
    user_id: user.id,
    video_id: videoId,
    program_id: programId ?? null,
    program_day_number: programId ? programDayNumber ?? null : null,
    last_position_seconds: lastPositionSeconds,
    max_position_seconds: Math.max(lastPositionSeconds, Number(existing?.max_position_seconds ?? 0)),
    completion_percent: completionPercent,
    is_completed: completionPercent >= 90
  };

  const result = existing?.id
    ? await supabase.from("user_progress").update(payload).eq("id", existing.id)
    : await supabase.from("user_progress").insert(payload);

  if (result.error) {
    return NextResponse.json({ error: result.error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
