import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";
import { createSupabaseAdminClient } from "@/src/lib/supabase/admin";
import { portadaDeClase, portadaDePlan } from "@/src/lib/video/portada";

/**
 * La portada de un plan de trabajo para quien NO lo tiene (vitrina con candado
 * y pagina de venta).
 *
 * POR QUE EXISTE (2026-11-12)
 *   Ningun plan tenia portada subida, y la vitrina no mostraba nada: tarjetas
 *   rosas vacias. Para quien SI tiene el plan se usa el cuadro de Bunny de la
 *   primera clase, pero ese cuadro lleva el id del video en la URL, y la
 *   vitrina no expone ids de video (portadaDePlanVitrina).
 *
 *   Aca el servidor busca ese cuadro y devuelve LA IMAGEN, no la direccion: el
 *   navegador solo ve /api/planes/<id del plan>/portada. Ningun id de video,
 *   ningun slug de clase.
 *
 * Solo con sesion: la vitrina es del estudio privado. Lee con service_role
 * porque RLS, correctamente, no le muestra a ella los dias del plan.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse(null, { status: 401 });

  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new NextResponse(null, { status: 404 });

  const admin = createSupabaseAdminClient();
  const { data: plan } = await admin
    .from("programs")
    .select("cover_image_url, status")
    .eq("id", id)
    .maybeSingle<{ cover_image_url: string | null; status: string }>();
  if (!plan || plan.status !== "published") return new NextResponse(null, { status: 404 });

  let url = portadaDePlan(plan.cover_image_url);
  if (!url) {
    const { data: dias } = await admin
      .from("program_days")
      .select("day_number, videos(thumbnail_url, bunny_video_id, stream_playback_id)")
      .eq("program_id", id)
      .order("day_number", { ascending: true })
      .limit(30);
    for (const d of dias ?? []) {
      const v = (Array.isArray(d.videos) ? d.videos[0] : d.videos) as Parameters<typeof portadaDeClase>[0] | null;
      url = v ? portadaDeClase(v) : null;
      if (url) break;
    }
  }
  if (!url) return new NextResponse(null, { status: 404 });

  const r = await fetch(url, { signal: AbortSignal.timeout(8000) }).catch(() => null);
  if (!r?.ok || !r.body) return new NextResponse(null, { status: 404 });

  return new NextResponse(r.body, {
    headers: {
      "content-type": r.headers.get("content-type") ?? "image/jpeg",
      // Privada: es contenido del estudio. Una hora alcanza y evita ir a Bunny
      // en cada visita.
      "cache-control": "private, max-age=3600",
    },
  });
}
