/**
 * Las traducciones del FAQ: qué idioma se muestra y cómo se guarda lo que
 * escribe Brunela.
 *
 * Es un archivo SIN "use server" a propósito: lo importan la acción (para
 * armar lo que se guarda), el panel (para el chip de estado de cada pestaña) y
 * la portada (para elegir qué texto mostrar). Una sola regla, tres lectores.
 *
 * 🔴 CÓMO ESTÁ GUARDADA UNA TRADUCCIÓN — leer antes de tocar nada.
 *
 *    Ver la nota larga de la migración 20260917_portada_editable.sql. En corto:
 *
 *      question_i18n[idioma]       el texto que SE MUESTRA en ese idioma, lo
 *                                  haya escrito Brunela o la máquina.
 *      question_auto_i18n[idioma]  NO es la traducción: es el texto EN ESPAÑOL
 *                                  del que se tradujo a máquina. Que la clave
 *                                  exista es lo que dice «esto es automático».
 *
 *    De ahí sale el orden de preferencia sin que la vista pública tenga que
 *    saber nada:
 *
 *      - Brunela escribe su traducción → se guarda en question_i18n[idioma] y
 *        se BORRA la marca de question_auto_i18n. La manual pisa a la
 *        automática porque ocupa su mismo lugar.
 *      - Deja la pestaña vacía y había automática → no se toca nada: sigue la
 *        automática.
 *      - Deja la pestaña vacía y no había automática → se borra el idioma, y
 *        la portada cae al español.
 *
 *    Resultado: manual > automática > español, y `landing_faq_publico` (que
 *    sólo expone question_i18n / answer_i18n) ya alcanza para mostrarlo bien.
 *    No hizo falta migración.
 */

export const IDIOMAS_FAQ = ["es", "en", "fr", "it"] as const;
export type IdiomaFaq = (typeof IDIOMAS_FAQ)[number];

/** Los que se traducen. El español es la base y es obligatorio. */
export const IDIOMAS_TRADUCIBLES = ["en", "fr", "it"] as const;
export type IdiomaTraducible = (typeof IDIOMAS_TRADUCIBLES)[number];

export const NOMBRE_IDIOMA: Record<IdiomaFaq, string> = {
  es: "español",
  en: "inglés",
  fr: "francés",
  it: "italiano",
};

export type Jsonb = Record<string, unknown> | null | undefined;

export type FilaFaqIdiomas = {
  question_i18n: Jsonb;
  answer_i18n: Jsonb;
  question_auto_i18n: Jsonb;
  answer_auto_i18n: Jsonb;
};

function texto(obj: Jsonb, clave: string): string {
  const v = obj?.[clave];
  return typeof v === "string" ? v.trim() : "";
}

function tieneClave(obj: Jsonb, clave: string): boolean {
  return Boolean(obj) && Object.prototype.hasOwnProperty.call(obj, clave);
}

export type EstadoTraduccion = "tuya" | "automatica" | "espanol";

/**
 * Qué se ve hoy en ese idioma. Es lo que dice el chip de cada pestaña.
 *
 * `desactualizada`: la automática se hizo a partir de un español que ya no es
 * el de ahora. La portada la sigue mostrando, pero conviene saberlo.
 */
export function estadoDeIdioma(
  fila: FilaFaqIdiomas,
  idioma: IdiomaTraducible
): { estado: EstadoTraduccion; desactualizada: boolean } {
  const hayTexto = texto(fila.question_i18n, idioma) !== "" && texto(fila.answer_i18n, idioma) !== "";
  if (!hayTexto) return { estado: "espanol", desactualizada: false };

  const esAuto = tieneClave(fila.question_auto_i18n, idioma) || tieneClave(fila.answer_auto_i18n, idioma);
  if (!esAuto) return { estado: "tuya", desactualizada: false };

  const desactualizada =
    (tieneClave(fila.question_auto_i18n, idioma) && texto(fila.question_auto_i18n, idioma) !== texto(fila.question_i18n, "es")) ||
    (tieneClave(fila.answer_auto_i18n, idioma) && texto(fila.answer_auto_i18n, idioma) !== texto(fila.answer_i18n, "es"));

  return { estado: "automatica", desactualizada };
}

/**
 * Lo que la portada muestra en un idioma: la traducción si está COMPLETA
 * (pregunta y respuesta), si no el español.
 *
 * ⚠️ Pregunta y respuesta van juntas. Con una sola traducida, la visitante
 *    leería la pregunta en inglés y la respuesta en español: peor que todo en
 *    español.
 */
export function textoParaIdioma(
  question_i18n: Jsonb,
  answer_i18n: Jsonb,
  idioma: IdiomaFaq
): { pregunta: string; respuesta: string } {
  const p = texto(question_i18n, idioma);
  const r = texto(answer_i18n, idioma);
  if (p !== "" && r !== "") return { pregunta: p, respuesta: r };
  return { pregunta: texto(question_i18n, "es"), respuesta: texto(answer_i18n, "es") };
}

/**
 * Arma las cuatro columnas a guardar a partir del formulario y de lo que ya
 * había. Nunca tira: devuelve `{ error }` con un mensaje para Brunela.
 *
 * ⚠️ PARTE DE LO EXISTENTE Y PISA SÓLO LO QUE VINO.
 *    Si el POST no trae los campos de un idioma (un formulario viejo, o uno
 *    fabricado a mano), ese idioma queda como estaba. Reconstruir el jsonb
 *    desde cero borraría en silencio traducciones que nadie tocó -- la misma
 *    trampa que `guardarPreciosDePlanesAction` con el catálogo.
 */
export function armarTraducciones(
  formData: FormData,
  pregunta: string,
  respuesta: string,
  existente: FilaFaqIdiomas | null
):
  | {
      question_i18n: Record<string, unknown>;
      answer_i18n: Record<string, unknown>;
      question_auto_i18n: Record<string, unknown>;
      answer_auto_i18n: Record<string, unknown>;
    }
  | { error: string } {
  const q: Record<string, unknown> = { ...(existente?.question_i18n ?? {}) };
  const a: Record<string, unknown> = { ...(existente?.answer_i18n ?? {}) };
  const qAuto: Record<string, unknown> = { ...(existente?.question_auto_i18n ?? {}) };
  const aAuto: Record<string, unknown> = { ...(existente?.answer_auto_i18n ?? {}) };

  q.es = pregunta;
  a.es = respuesta;

  for (const idioma of IDIOMAS_TRADUCIBLES) {
    const campoP = `pregunta_${idioma}`;
    const campoR = `respuesta_${idioma}`;
    if (!formData.has(campoP) && !formData.has(campoR)) continue;

    const p = String(formData.get(campoP) ?? "").trim();
    const r = String(formData.get(campoR) ?? "").trim();

    if (p === "" && r === "") {
      // Vacío = «no la traduzco yo». Si había automática, se queda; si había
      // una tuya, se borra y vuelve la automática (no hay) o el español.
      if (!tieneClave(qAuto, idioma)) delete q[idioma];
      if (!tieneClave(aAuto, idioma)) delete a[idioma];
      continue;
    }

    if (p === "" || r === "") {
      return {
        error: `En ${NOMBRE_IDIOMA[idioma]} falta ${p === "" ? "la pregunta" : "la respuesta"}. Completá las dos, o dejá las dos vacías para usar ${tieneClave(qAuto, idioma) ? "la traducción automática" : "el español"}.`,
      };
    }

    if (p.length > 300 || r.length > 4000) {
      return { error: `En ${NOMBRE_IDIOMA[idioma]} el texto es demasiado largo.` };
    }

    // La tuya gana: ocupa el lugar y deja de estar marcada como automática.
    q[idioma] = p;
    a[idioma] = r;
    delete qAuto[idioma];
    delete aAuto[idioma];
  }

  return { question_i18n: q, answer_i18n: a, question_auto_i18n: qAuto, answer_auto_i18n: aAuto };
}
