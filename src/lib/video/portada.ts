import { bunnySignedUrls, bunnyThumbnailUrl, bunnyVideoIdFromUrl, hasBunnyStreamEnv } from "@/src/lib/video/bunny";
import { esUrlDeBunny } from "./portada-publica";

// La portada para CORREOS (sin firma, que no vence) vive en portada-publica.ts:
// sin dependencias, para que la usen los correos y sus pruebas.
export { portadaPublicaDeClase } from "./portada-publica";

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

/**
 * La foto de una clase en una forma que se puede GUARDAR (en la portada de un
 * plan): la foto subida tal cual, o el cuadro de Bunny SIN firma. Una URL
 * firmada vence; esta se firma al mostrarla, con portadaDePlan().
 */
export function portadaFijaDeClase(v: {
  thumbnail_url?: string | null;
  bunny_video_id?: string | null;
  stream_playback_id?: string | null;
}): string | null {
  const guardada = v.thumbnail_url?.trim() || null;
  if (guardada && !esUrlDeBunny(guardada)) return guardada;
  const bunnyId = v.bunny_video_id ?? bunnyVideoIdFromUrl(v.stream_playback_id) ?? bunnyVideoIdFromUrl(guardada);
  return bunnyId && hasBunnyStreamEnv() ? bunnyThumbnailUrl(bunnyId) : null;
}

/** La portada guardada de un plan, lista para mostrar: si es un cuadro de Bunny, se firma. */
export function portadaDePlan(cover: string | null | undefined): string | null {
  return cover ? portadaDeClase({ thumbnail_url: cover }) : null;
}

/**
 * Para quien NO tiene el plan (vitrina con candado y pagina de venta): solo una
 * foto subida. Un cuadro de Bunny llevaria el id del video en la URL, y la
 * vitrina no expone ids de video.
 */
export function portadaDePlanVitrina(cover: string | null | undefined): string | null {
  return cover && !esUrlDeBunny(cover) ? cover : null;
}
