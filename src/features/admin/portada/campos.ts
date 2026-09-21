/**
 * La lista blanca de lo que se puede editar en la portada.
 *
 * 🔴 ESTO NO ES UNA LISTA DE ETIQUETAS: ES EL LÍMITE DE LO EDITABLE.
 *
 *    Una server action es un endpoint POST público (trampa 4 de CLAUDE.md):
 *    esconder un campo en la interfaz no protege nada. La acción que escribe en
 *    `landing_texts` valida la clave CONTRA ESTE REGISTRO y rechaza cualquier
 *    otra, así que aunque alguien fabrique el POST a mano no puede inventar una
 *    clave ni tocar una que no esté acá.
 *
 *    Es la misma idea que "una acción por ajuste" en settings-actions.ts, pero
 *    declarativa, para que no haya que escribir una acción por cada texto.
 *
 * QUÉ NO ESTÁ ACÁ, Y ES A PROPÓSITO
 *    Los textos del hero y de las secciones en cuatro idiomas quedaron FUERA de
 *    alcance por decisión del dueño (2026-09-21): son ~42 campos × 4 idiomas, es
 *    lo más trabajoso y lo que menos se toca. Siguen viniendo de
 *    `src/i18n/public.ts`, compilados. Está anotado como mejora futura.
 *
 *    Tampoco están la estructura, las secciones, los colores ni la tipografía.
 *    El límite es CONTENIDO SÍ, FORMA NO: si Brunela puede mover todo, rompe el
 *    diseño y no tiene cómo volver atrás.
 */

export type TipoDeCampo = "url" | "lista";

export type CampoDePortada = {
  clave: string;
  tipo: TipoDeCampo;
  etiqueta: string;
  ayuda: string;
};

export const CAMPOS: readonly CampoDePortada[] = [
  {
    clave: "video.src",
    tipo: "url",
    etiqueta: "Video del tráiler",
    ayuda: "El video que se reproduce de fondo en la portada.",
  },
  {
    clave: "video.poster",
    tipo: "url",
    etiqueta: "Imagen del tráiler",
    ayuda:
      "Se ve mientras el video carga, y queda fija si alguien tiene el video bloqueado. Conviene que sea un cuadro del propio video.",
  },
  {
    clave: "about.highlights",
    tipo: "lista",
    etiqueta: "Certificados y formación",
    ayuda: "Las etiquetas que aparecen en «Sobre mí». Una por línea.",
  },
] as const;

const PORATRIBUTO = new Map(CAMPOS.map((c) => [c.clave, c]));

/** El campo, o null si la clave no está declarada. La acción rechaza el null. */
export function campo(clave: string): CampoDePortada | null {
  return PORATRIBUTO.get(clave) ?? null;
}

/**
 * Valida y normaliza lo que llegó del formulario para esa clave.
 *
 * Devuelve `{ valor }` si sirve, o `{ error }` con un mensaje que Brunela pueda
 * leer. Nunca tira: un error de validación no es una excepción, es una
 * respuesta.
 */
export function validar(
  c: CampoDePortada,
  crudo: string
): { valor: string | string[] } | { error: string } {
  const texto = crudo.trim();

  if (c.tipo === "lista") {
    const items = texto
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l !== "");

    if (items.length > 12) {
      return { error: `«${c.etiqueta}»: son ${items.length} y el máximo es 12.` };
    }
    // Una lista vacía es válida: significa "no mostrar la sección".
    return { valor: items };
  }

  // tipo === "url"
  if (texto === "") return { valor: "" }; // vaciar = volver al valor por defecto

  /**
   * ⚠️ SOLO http(s), Y SE COMPRUEBA CON EL PARSER, NO CON UNA EXPRESIÓN REGULAR.
   *
   *    Esto termina en el `src` de un <video> y en el `poster` de la portada
   *    pública. Un `javascript:` ahí es un XSS servido a todo internet. El
   *    parser de URL de la plataforma sabe qué es un esquema; una expresión
   *    regular escrita a mano, no.
   */
  let url: URL;
  try {
    url = new URL(texto);
  } catch {
    return { error: `«${c.etiqueta}»: eso no es una dirección web válida.` };
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return { error: `«${c.etiqueta}»: la dirección tiene que empezar con https://` };
  }

  return { valor: url.toString() };
}
