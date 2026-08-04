import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";

/**
 * Registro de actividad, solo-insercion.
 *
 * POR QUE NO ALCANZA CON /api/progress
 *   Esa ruta hace un UPSERT: pisa la misma fila en cada guardado. Sirve para
 *   "segui donde ibas", pero borra la historia -- ver el encabezado de
 *   supabase/migrations/20260803_activity_events.sql.
 *
 * POR QUE user_id NO VIENE EN EL CUERPO
 *   Sale de la sesion. Si viniera del cliente, cualquiera podria inflar las
 *   metricas de otra persona, o las propias. La policy de RLS
 *   `activity_events_insert_own` lo exige ademas del lado de la base: son dos
 *   cerraduras para lo mismo, a proposito.
 */

const schema = z.object({
  eventType: z.enum(["video_start", "video_heartbeat", "video_complete"]),
  videoId: z.string().uuid(),
  videoSlug: z.string().max(200).optional().nullable(),
  programId: z.string().uuid().optional().nullable(),
  sessionId: z.string().uuid(),
  positionSeconds: z.number().int().min(0).max(86_400),
  // Techo de 10 minutos: el heartbeat va cada 60 segundos, asi que un valor
  // mayor solo puede venir de un reloj mal medido o de alguien probando. Sin
  // este limite, un unico envio podria falsear "tiempo de uso" entero.
  secondsWatched: z.number().int().min(0).max(600).optional().nullable(),
});

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  const d = parsed.data;

  const { error } = await supabase.from("activity_events").insert({
    user_id: user.id,
    event_type: d.eventType,
    video_id: d.videoId,
    video_slug: d.videoSlug ?? null,
    program_id: d.programId ?? null,
    session_id: d.sessionId,
    position_seconds: d.positionSeconds,
    seconds_watched: d.secondsWatched ?? null,
  });

  if (error) {
    // Se registra en el servidor pero se le devuelve 204 igual al reproductor:
    // que la analitica falle no puede cortarle la clase a nadie. El sintoma de
    // que falta correr la migracion aparece aca, no en la pantalla de la alumna.
    console.error("[activity] insert fallo:", error.message);
  }

  return new NextResponse(null, { status: 204 });
}
