import { bunnySignedUrls, bunnyVideoIdFromUrl, hasBunnyStreamEnv } from "@/src/lib/video/bunny";

/**
 * LA portada de una clase, para cualquier pantalla. Una sola regla:
 *
 *   1. Si Brunela subio una foto (thumbnail_url que NO es de Bunny), esa.
 *   2. Si no, el cuadro que genera Bunny, FIRMADO en el momento: con Token
 *      Authentication la URL guardada sin firma da 403.
 *   3. Si no hay ni una cosa ni la otra, null (la pantalla pone su fondo).
 *
 * 🔴 POR QUE EXISTE (2026-10-10): cada pantalla resolvia la portada a su
 *    manera. La biblioteca completa y el panel de clases PREFERIAN el cuadro
 *    de Bunny aunque hubiera foto subida, asi que la foto elegida no se veia; y
 *    mientras Bunny procesa el video ese cuadro todavia no existe, asi que la
 *    tarjeta quedaba vacia. Otras pantallas usaban thumbnail_url crudo, que si
 *    era la URL de Bunny sin firmar tambien daba 403.
 *
 * Solo servidor: firma con la clave de Bunny.
 */
export function portadaDeClase(v: {
  thumbnail_url?: string | null;
  bunny_video_id?: string | null;
  stream_playback_id?: string | null;
}): string | null {
  const guardada = v.thumbnail_url?.trim() || null;
  if (guardada && !esUrlDeBunny(guardada)) return guardada;

  const bunnyId = v.bunny_video_id ?? bunnyVideoIdFromUrl(v.stream_playback_id) ?? bunnyVideoIdFromUrl(guardada);
  if (bunnyId && hasBunnyStreamEnv()) return bunnySignedUrls(bunnyId).thumbnail;

  return null;
}

function esUrlDeBunny(url: string): boolean {
  const host = process.env.BUNNY_STREAM_CDN_HOSTNAME?.trim().toLowerCase();
  try {
    const h = new URL(url).hostname.toLowerCase();
    return h.endsWith(".b-cdn.net") || h.endsWith("mediadelivery.net") || (!!host && h === host);
  } catch {
    return false;
  }
}
