import { createSupabaseAdminClient } from "@/src/lib/supabase/admin";

/**
 * Documentos del estudio en Supabase Storage.
 *
 * Mismo esquema que el audio: el servidor firma una credencial acotada y el
 * NAVEGADOR hace la transferencia. Un PDF puede pasar el limite de 1 MB del
 * cuerpo de una server action, asi que no puede pasar por nosotros.
 *
 * COMPATIBILIDAD CON LAS FILAS VIEJAS
 *   `documents.file_url` guardaba una URL completa pegada a mano. Las filas
 *   nuevas guardan la RUTA dentro del bucket. `esRutaDeBucket()` distingue una
 *   de otra para que las dos conviviendo funcionen: sin eso, migrar el campo
 *   habria roto todo documento cargado antes.
 */

export const DOCS_BUCKET = "studio-documents";

/** 50 MiB: el techo por archivo del plan Free, no configurable desde aca. */
export const MAX_DOC_BYTES = 52_428_800;

export function mensajeDemasiadoGrande(nombre: string, bytes: number) {
  const mb = (bytes / 1_048_576).toFixed(1);
  return `"${nombre}" pesa ${mb} MB y el máximo es 50 MB.`;
}

/**
 * Una URL completa (empieza con http) es una fila vieja; cualquier otra cosa es
 * una ruta dentro del bucket, que hay que firmar antes de entregar.
 */
export function esRutaDeBucket(fileUrl: string) {
  return !/^https?:\/\//i.test(fileUrl);
}

/** Nombre de archivo seguro: sin acentos, espacios ni nada que rompa una URL. */
export function rutaDeDocumento(nombreOriginal: string) {
  const limpio = nombreOriginal
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .toLowerCase()
    .slice(-80);
  // Prefijo temporal: dos documentos con el mismo nombre no se pisan.
  return `${Date.now()}-${limpio}`;
}

/** Credencial de un solo uso, atada a una ruta concreta y con vencimiento. */
export async function crearUrlDeSubida(path: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.storage
    .from(DOCS_BUCKET)
    .createSignedUploadUrl(path, { upsert: true });

  if (error || !data) {
    throw new Error(error?.message ?? "No se pudo crear la URL de subida.");
  }
  return { path, signedUrl: data.signedUrl, token: data.token };
}

/**
 * Enlace de descarga con vencimiento. Se llama DESPUES de comprobar el plan de
 * la alumna: firmar es entregar el acceso.
 */
export async function firmarDescarga(fileUrl: string, ttlSegundos = 3600): Promise<string> {
  if (!esRutaDeBucket(fileUrl)) return fileUrl; // fila vieja: ya es una URL

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.storage
    .from(DOCS_BUCKET)
    .createSignedUrl(fileUrl, ttlSegundos);

  if (error || !data) return "";
  return data.signedUrl;
}

/** Best-effort: un archivo huerfano es aceptable, un borrado que falla no. */
export async function borrarDocumento(fileUrl: string) {
  if (!esRutaDeBucket(fileUrl)) return;
  try {
    const supabase = createSupabaseAdminClient();
    await supabase.storage.from(DOCS_BUCKET).remove([fileUrl]);
  } catch {
    /* no bloquea el borrado de la fila */
  }
}
