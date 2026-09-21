import { createSupabaseAdminClient } from "@/src/lib/supabase/admin";

/**
 * El bucket de la portada: el video del tráiler y su imagen.
 *
 * Mismo esquema que los documentos y el audio: el servidor firma una credencial
 * acotada y el NAVEGADOR hace la transferencia. Un video no pasa por el límite
 * de 1 MB del cuerpo de una server action, así que no puede pasar por nosotros.
 *
 * 🔴 ESTE BUCKET ES PÚBLICO, Y ES EL ÚNICO DEL PROYECTO QUE LO ES.
 *
 *    `studio-documents` es privado porque son contenido pago y una URL se
 *    comparte por WhatsApp en dos segundos. Acá es al revés: el tráiler está en
 *    la portada y el objetivo literal es que lo vea cualquiera. Firmarlo sería
 *    firmar un cartel de la calle.
 *
 *    Consecuencia práctica: lo que se guarda en `landing_texts` es la URL
 *    pública definitiva, no una ruta que haya que firmar en cada visita.
 */

export const BUCKET_PORTADA = "landing-media";

/** 50 MiB: el techo por archivo del plan Free. Lo impone también el bucket. */
export const MAX_PORTADA_BYTES = 52_428_800;

/**
 * Lo que el bucket acepta, declarado también acá.
 *
 * ⚠️ Tiene que coincidir con `allowed_mime_types` de la migración 20260917. Si
 *    se agrega uno acá y no allá, Storage rechaza la subida DESPUÉS de que el
 *    navegador transfirió el archivo entero — el peor momento para enterarse.
 */
export const TIPOS_PORTADA = [
  "video/mp4",
  "video/webm",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
] as const;

export function mensajeDemasiadoGrande(nombre: string, bytes: number) {
  const mb = (bytes / 1_048_576).toFixed(1);
  return `"${nombre}" pesa ${mb} MB y el máximo es 50 MB.`;
}

/** Nombre seguro: sin acentos, espacios ni nada que rompa una URL. */
export function rutaDeMedia(nombreOriginal: string) {
  const limpio = nombreOriginal
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .toLowerCase()
    .slice(-80);

  /**
   * El prefijo temporal no es por prolijidad: es lo que hace que reemplazar el
   * tráiler se VEA. Con un nombre fijo, la URL no cambia y el CDN de Supabase
   * sigue sirviendo el archivo viejo — Brunela sube el video nuevo, no pasa
   * nada, y no hay error en ningún lado.
   */
  return `${Date.now()}-${limpio}`;
}

/** Credencial de un solo uso, atada a una ruta concreta y con vencimiento. */
export async function crearUrlDeSubida(path: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.storage
    .from(BUCKET_PORTADA)
    .createSignedUploadUrl(path, { upsert: true });

  if (error || !data) {
    throw new Error(error?.message ?? "No se pudo crear la URL de subida.");
  }
  return { path, signedUrl: data.signedUrl, token: data.token };
}

/** La URL definitiva de un archivo ya subido. El bucket es público: no se firma. */
export function urlPublica(path: string): string {
  const supabase = createSupabaseAdminClient();
  return supabase.storage.from(BUCKET_PORTADA).getPublicUrl(path).data.publicUrl;
}
