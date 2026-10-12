/**
 * Lo de la portada que NO necesita la clave de Bunny: reconocer una URL de
 * Bunny y elegir la portada que puede ir en un correo. Sin imports, para que
 * lo usen los correos (src/features/correos/clase-nueva.ts) y sus pruebas.
 * La regla completa, con firma, esta en portada.ts.
 */

export function esUrlDeBunny(url: string): boolean {
  const host = process.env.BUNNY_STREAM_CDN_HOSTNAME?.trim().toLowerCase();
  try {
    const h = new URL(url).hostname.toLowerCase();
    return h.endsWith(".b-cdn.net") || h.endsWith("mediadelivery.net") || (!!host && h === host);
  } catch {
    return false;
  }
}

/**
 * La portada que puede ir en un CORREO: solo la foto que subio Brunela (URL
 * publica que no vence). El cuadro de Bunny no: va firmado y para cuando la
 * alumna abre el correo la firma ya vencio (403, imagen rota). Sin foto subida,
 * null y el correo sale sin imagen.
 */
export function portadaPublicaDeClase(v: { thumbnail_url?: string | null }): string | null {
  const guardada = v.thumbnail_url?.trim() || null;
  if (!guardada || esUrlDeBunny(guardada)) return null;
  return guardada.startsWith("https://") ? guardada : null;
}
