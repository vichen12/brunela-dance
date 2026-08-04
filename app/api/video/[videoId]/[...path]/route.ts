import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";
import { getBunnyTokenAuthKey } from "@/src/lib/env";
import {
  bunnyAssetUrlFactory,
  bunnyManifestUrl,
  hasBunnyStreamEnv,
  SEGMENT_URL_TTL_SECONDS
} from "@/src/lib/video/bunny";
import { rewriteHlsManifest } from "@/src/lib/video/hls-manifest";

/**
 * Access-gated HLS manifest route.
 *
 * Serves Bunny's .m3u8 files with every child URI rewritten to an absolute,
 * signed URL, because neither hls.js nor Safari's native player will carry
 * Bunny's directory token to segment requests on their own. See
 * src/lib/video/hls-manifest.ts for the full reasoning.
 *
 * ONLY manifests pass through here. Segments are handed to the browser as
 * direct CDN URLs and never touch our server, so this stays cheap: a few tens
 * of KB per viewer per class, whatever the class weighs.
 *
 * Access is enforced by RLS, exactly like the page that embeds the player: the
 * lookup runs on the USER's Supabase client, so videos_select_allowed_by_tier
 * decides. A member without the right tier gets no row back and a 403 here,
 * even if they somehow learned the Bunny GUID.
 */

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Short TTL: this one is consumed immediately, by us, server-side. */
const UPSTREAM_TTL_SECONDS = 300;

type Params = { params: Promise<{ videoId: string; path: string[] }> };

export async function GET(_request: Request, { params }: Params) {
  const { videoId, path } = await params;

  if (!UUID.test(videoId)) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  if (!hasBunnyStreamEnv()) {
    // Mismo motivo que el log de mas abajo: sin esto, un deploy al que le falta
    // una variable devuelve 503 en silencio y en los logs no queda rastro.
    console.error(
      "[video] faltan variables de Bunny",
      JSON.stringify({
        apiKey: Boolean(process.env.BUNNY_STREAM_API_KEY),
        libraryId: Boolean(process.env.BUNNY_STREAM_LIBRARY_ID),
        cdnHostname: Boolean(process.env.BUNNY_STREAM_CDN_HOSTNAME),
      })
    );
    return NextResponse.json({ error: "video no configurado" }, { status: 503 });
  }

  const manifestPath = (path ?? []).join("/");

  // Segments must never be proxied: that would push every viewer's video bytes
  // through our server instead of the CDN.
  if (!manifestPath.toLowerCase().endsWith(".m3u8")) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  // Defense in depth. URL normalization in the rewriter already collapses "..",
  // but nothing should be able to hand-craft a path out of the directory.
  if ((path ?? []).some((part) => part === ".." || part.includes("\\"))) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // videoId is a validated UUID, so it is safe to interpolate into the filter.
  // Older rows only carry the GUID inside stream_playback_id, and those classes
  // have to keep playing.
  const { data: allowed } = await supabase
    .from("videos")
    .select("id")
    .or(`bunny_video_id.eq.${videoId},stream_playback_id.ilike.%${videoId}%`)
    .limit(1)
    .maybeSingle<{ id: string }>();

  if (!allowed) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const upstream = await fetch(bunnyAssetUrlFactory(videoId, UPSTREAM_TTL_SECONDS)(manifestPath), {
    cache: "no-store"
  });

  if (!upstream.ok) {
    // Bunny suele explicar el rechazo en el cuerpo, y son pocas lineas.
    const detalle = await upstream.text().then((t) => t.slice(0, 300)).catch(() => "");

    // POR QUE SE REGISTRA ACA
    //   Este camino no lanza ninguna excepcion: devuelve una respuesta a
    //   proposito. Asi que en los Runtime Logs de Vercel la invocacion figura
    //   como exitosa, en ~100 ms, sin un solo mensaje. Ya nos costo una tarde:
    //   el 502 se veia en el navegador y en los logs no habia absolutamente
    //   nada que mirar.
    //
    //   NUNCA la clave, ni firmada ni en partes. Solo si esta puesta.
    console.error(
      "[video] bunny rechazo el manifest",
      JSON.stringify({
        bunnyStatus: upstream.status,
        videoId,
        manifestPath,
        // 403 con esto en false = falta BUNNY_STREAM_TOKEN_AUTH_KEY en el
        // entorno, o el deploy todavia no la tomo. Es la causa mas comun.
        tokenKeyPresente: getBunnyTokenAuthKey() !== null,
        detalle,
      })
    );

    // 404 es del contenido: ese video no existe en la biblioteca.
    if (upstream.status === 404) {
      return NextResponse.json({ error: "not found", motivo: "bunny_404" }, { status: 404 });
    }

    // 401 y 403 de Bunny NO son "la alumna no tiene acceso": eso ya se decidio
    // arriba con RLS y esta persona paso. Si Bunny nos rechaza a NOSOTROS es
    // porque nuestra firma esta mal, o sea configuracion del servidor. Por eso
    // sale como 5xx y no como 403: un 403 aca mandaria a revisar el plan de la
    // alumna, que es el lugar equivocado.
    const esFirma = upstream.status === 401 || upstream.status === 403;
    return NextResponse.json(
      {
        error: esFirma ? "firma rechazada por el CDN" : "el CDN de video no respondio bien",
        motivo: esFirma ? "upstream_firma" : "upstream_error",
        bunnyStatus: upstream.status,
      },
      { status: 502 }
    );
  }

  const signAsset = bunnyAssetUrlFactory(videoId, SEGMENT_URL_TTL_SECONDS);
  const manifestBase = bunnyManifestUrl(videoId).replace(/playlist\.m3u8$/, "");

  const rewritten = rewriteHlsManifest(await upstream.text(), manifestPath, {
    playlist: (child) => `${manifestBase}${child}`,
    asset: signAsset
  });

  return new NextResponse(rewritten, {
    status: 200,
    headers: {
      "content-type": "application/vnd.apple.mpegurl",
      // Signed URLs inside expire, and the response is per-user by definition.
      "cache-control": "private, no-store, max-age=0"
    }
  });
}
