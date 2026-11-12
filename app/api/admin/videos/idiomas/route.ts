import { NextResponse } from "next/server";
import { requireAdmin } from "@/src/features/auth/guards";
import { createSupabaseAdminClient } from "@/src/lib/supabase/admin";
import { AUDIO_BUCKET, MAX_AUDIO_BYTES, audioObjectPath, isAudioLocale, oversizeMessage, audioLabel } from "@/src/lib/audio/config";
import { createAudioUploadUrl } from "@/src/lib/audio/storage";
import { SUBTITULOS_BUCKET, aVtt, esIdiomaSubtitulos, idiomasCargados, rutaSubtitulos } from "@/src/lib/audio/idiomas";

/**
 * Idiomas extra y subtitulos de UNA clase, desde su ficha en el panel.
 * Ver src/lib/audio/idiomas.ts. Todo opcional: nada de esto toca el video.
 *
 *   GET    ?bunny=<guid>                    -> que tiene cargado
 *   POST   { tipo:"audio", bunny, idioma, bytes } -> enlace para subir el mp3
 *          (el navegador lo sube directo: un mp3 pesa demasiado para pasar
 *          por este servidor)
 *   POST   form: tipo=subtitulos, bunny, idioma, archivo (.srt o .vtt)
 *   DELETE ?bunny=&tipo=&idioma=
 */

function guid(v: unknown): string | null {
  return typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v) ? v : null;
}
const mal = (error: string, status = 400) => NextResponse.json({ error }, { status });

export async function GET(request: Request) {
  await requireAdmin();
  const bunny = guid(new URL(request.url).searchParams.get("bunny"));
  if (!bunny) return mal("Falta la clase.");
  return NextResponse.json(await idiomasCargados(bunny), { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  await requireAdmin();
  const tipoContenido = request.headers.get("content-type") ?? "";

  if (tipoContenido.includes("application/json")) {
    const b = (await request.json().catch(() => null)) as { tipo?: string; bunny?: string; idioma?: string; bytes?: number } | null;
    const bunny = guid(b?.bunny);
    const idioma = String(b?.idioma ?? "");
    if (!bunny || b?.tipo !== "audio" || !isAudioLocale(idioma)) return mal("Datos incompletos.");
    if (typeof b.bytes === "number" && b.bytes > MAX_AUDIO_BYTES) return mal(oversizeMessage(audioLabel(idioma), b.bytes), 413);
    try {
      return NextResponse.json(await createAudioUploadUrl(bunny, idioma));
    } catch (e) {
      console.error("[idiomas] enlace de subida:", e instanceof Error ? e.message : e);
      return mal("No se pudo preparar la subida. Probá de nuevo en un momento.", 502);
    }
  }

  const fd = await request.formData().catch(() => null);
  const bunny = guid(fd?.get("bunny"));
  const idioma = String(fd?.get("idioma") ?? "");
  const archivo = fd?.get("archivo");
  if (!bunny || fd?.get("tipo") !== "subtitulos" || !esIdiomaSubtitulos(idioma) || !(archivo instanceof File)) return mal("Datos incompletos.");
  if (archivo.size > 2 * 1024 * 1024) return mal("Ese archivo de subtítulos es demasiado grande (máximo 2 MB).", 413);
  const vtt = aVtt(await archivo.text());
  if (!vtt) return mal("Ese archivo no parece de subtítulos. Tiene que ser .srt o .vtt.");

  const { error } = await createSupabaseAdminClient().storage
    .from(SUBTITULOS_BUCKET)
    .upload(rutaSubtitulos(bunny, idioma), new Blob([vtt], { type: "text/vtt" }), { contentType: "text/vtt", upsert: true });
  if (error) {
    console.error("[idiomas] subir subtitulos:", error.message);
    return mal("No se pudieron guardar los subtítulos. Probá de nuevo.", 502);
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  await requireAdmin();
  const q = new URL(request.url).searchParams;
  const bunny = guid(q.get("bunny"));
  const idioma = q.get("idioma") ?? "";
  const tipo = q.get("tipo");
  if (!bunny) return mal("Falta la clase.");
  const db = createSupabaseAdminClient().storage;
  const { error } =
    tipo === "audio" && isAudioLocale(idioma) ? await db.from(AUDIO_BUCKET).remove([audioObjectPath(bunny, idioma)])
    : tipo === "subtitulos" && esIdiomaSubtitulos(idioma) ? await db.from(SUBTITULOS_BUCKET).remove([rutaSubtitulos(bunny, idioma)])
    : { error: { message: "tipo" } };
  if (error) {
    console.error("[idiomas] quitar:", error.message);
    return mal("No se pudo quitar. Probá de nuevo.", 502);
  }
  return NextResponse.json({ ok: true });
}
