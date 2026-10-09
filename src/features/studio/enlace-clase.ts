/**
 * El enlace de una clase en vivo: Zoom, Google Meet o cualquier otro.
 *
 * Pedido de la duena: "que este la posibilidad de subir el link ya sea en Meet
 * o en Zoom, y que las inscriptas toquen unirse y abran ese link".
 *
 * El proveedor se DEDUCE de la URL y se guarda en
 * `live_session_access_links.provider`. Antes se escribia "zoom" fijo, aunque
 * el enlace fuera de Meet. No se le pregunta a Brunela: pegar el enlace ya dice
 * de donde es, y un desplegable mas seria una cosa mas para equivocarse.
 *
 * Modulo puro (sin servidor ni cliente): lo usan la action, las pantallas de
 * servidor y los componentes de cliente. Una funcion de aca NO cruza la
 * frontera como prop (trampa 6): cada lado la importa.
 */

export type Proveedor = "zoom" | "meet" | "otro";

/** El host de una URL, en minuscula, o null si no es una URL valida. */
function host(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * meet.google.com -> meet; zoom.us o *.zoom.us -> zoom; cualquier otra -> otro.
 *
 * ⚠️ Se compara el HOST exacto o el sufijo con punto, nunca `includes("zoom")`:
 *    `zoom.us.sitio-raro.com` o `notzoom.us` no son Zoom, y el boton diria
 *    "Unirse por Zoom" sobre un enlace que no lo es.
 */
export function detectarProveedor(url: string | null | undefined): Proveedor {
  const h = url ? host(url.trim()) : null;
  if (!h) return "otro";
  if (h === "meet.google.com") return "meet";
  if (h === "zoom.us" || h.endsWith(".zoom.us")) return "zoom";
  return "otro";
}

/**
 * El proveedor para MOSTRAR. Si hay URL manda la URL: las filas viejas dicen
 * "zoom" por el default de la columna aunque el enlace sea de Meet, y lo que
 * la alumna va a abrir es el enlace, no la columna.
 */
export function proveedorDe(provider: string | null | undefined, url?: string | null): Proveedor {
  if (url) return detectarProveedor(url);
  return provider === "zoom" || provider === "meet" ? provider : "otro";
}

export const NOMBRE_PROVEEDOR: Record<Proveedor, string> = {
  zoom: "Zoom",
  meet: "Google Meet",
  otro: "Enlace",
};

/** Texto del boton de la alumna. */
export function textoUnirse(p: Proveedor): string {
  return p === "meet" ? "Unirse por Meet" : p === "zoom" ? "Unirse por Zoom" : "Unirse a la clase";
}

/** Chip del panel: "Meet listo", "Zoom listo", "Enlace listo". */
export function textoListo(p: Proveedor): string {
  return p === "meet" ? "Meet listo" : p === "zoom" ? "Zoom listo" : "Enlace listo";
}

/**
 * Valida lo que pega Brunela. Devuelve la URL limpia o el motivo del rechazo.
 *
 * Solo https: un `javascript:` o un `http:` en un boton que abre cada alumna
 * seria un agujero o, como minimo, una advertencia del navegador.
 */
export function validarEnlace(crudo: string): { url: string } | { fallo: string } {
  const texto = crudo.trim();
  if (!texto) return { fallo: "Pegá el enlace de la clase." };
  let u: URL;
  try {
    u = new URL(texto);
  } catch {
    return { fallo: "Eso no parece un enlace. Copialo entero desde Zoom o Meet, empezando por https://" };
  }
  if (u.protocol !== "https:") return { fallo: "El enlace tiene que empezar con https://" };
  if (!u.hostname.includes(".")) return { fallo: "El enlace no tiene un dominio válido." };
  if (texto.length > 2000) return { fallo: "El enlace es demasiado largo." };
  return { url: u.toString() };
}
