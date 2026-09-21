import { unstable_cache, revalidateTag } from "next/cache";
import { createSupabaseAdminClient } from "@/src/lib/supabase/admin";

/**
 * Lo que la portada lee de la base: FAQ, tráiler y certificados.
 *
 * 🔴 ESTA CAPA NO PUEDE TIRAR LA LANDING. NUNCA.
 *
 *    La portada es pública y es lo primero que ve alguien que todavía no es
 *    clienta. Si Supabase no responde, si alguien borra una fila, si la
 *    migración no corrió: la landing se tiene que ver igual, sin el bloque que
 *    falta, y sin un solo error en pantalla.
 *
 *    Por eso TODAS las lecturas de acá devuelven vacío ante cualquier problema
 *    en vez de propagar el error. Es el mismo patrón que ya usan
 *    `preciosDeLaBase()` y `packsDeLaPortada()` en app/page.tsx.
 *
 * ⚠️ SE LEE POR LAS VISTAS, NO POR LAS TABLAS.
 *    `landing_faq_publico` filtra `is_published`, así que un borrador que
 *    Brunela está escribiendo no puede llegar a la portada ni por un `select *`
 *    distraído. La restricción la impone Postgres, no un comentario. Y
 *    `landing_textos_publicos` no expone `auto_i18n`, que es contabilidad del
 *    panel y duplicaría el payload de cada visitante.
 *
 * ⚠️ VAN CON `service_role` A PROPÓSITO.
 *    Las dos vistas tienen el `select` otorgado SOLO a `service_role`; `anon` no
 *    recibe nada (verificado: da 42501). La portada se renderiza en el servidor,
 *    así que no hace falta abrirle nada a la clave publicable que viaja en el
 *    HTML.
 */

const TAG = "landing-content";

/** Cinco minutos, igual que los ajustes. Esto cambia una vez cada varios meses. */
const VIGENCIA = 300;

export type PreguntaFrecuente = {
  id: string;
  pregunta: string;
  respuesta: string;
};

/**
 * El FAQ de la portada.
 *
 * 🔴 SALE EN ESPAÑOL EN LOS CUATRO IDIOMAS, Y ES UNA DECISIÓN, NO UNA DEUDA.
 *
 *    Brunela carga las preguntas una sola vez, en español, y se ven igual en
 *    ES/EN/FR/IT hasta que alguien las traduzca a mano. La alternativa era
 *    obligarla a escribir cada pregunta cuatro veces, y entonces no las carga
 *    ninguna vez: un FAQ vacío en los cuatro idiomas es peor que uno en español
 *    en tres de ellos.
 *
 *    Las columnas de la base SÍ son `jsonb` por idioma, así que el día que se
 *    traduzca no hay que migrar nada: se llenan las otras claves y esta función
 *    empieza a elegir. Hoy pide `es` y punto.
 */
export async function preguntasFrecuentes(): Promise<PreguntaFrecuente[]> {
  const cargar = unstable_cache(
    async () => {
      try {
        const supabase = createSupabaseAdminClient();
        const { data, error } = await supabase
          .from("landing_faq_publico")
          .select("id, display_order, question_i18n, answer_i18n")
          .order("display_order");

        if (error || !data) return [];

        return (data as RawFaq[])
          .map((f) => ({
            id: f.id,
            pregunta: (f.question_i18n?.es ?? "").trim(),
            respuesta: (f.answer_i18n?.es ?? "").trim(),
          }))
          /**
           * Una pregunta sin texto no se muestra aunque esté publicada.
           *
           * El check de la base ya impide publicar con el español vacío, así que
           * esto no debería filtrar nada nunca. Está igual porque el costo es
           * una línea y el fallo que evita -- un acordeón en blanco en la
           * portada pública -- lo ve gente que todavía no es clienta.
           */
          .filter((f) => f.pregunta !== "" && f.respuesta !== "");
      } catch {
        return [];
      }
    },
    ["landing-faq"],
    { tags: [TAG], revalidate: VIGENCIA }
  );

  return cargar();
}

type RawFaq = {
  id: string;
  display_order: number;
  question_i18n: Record<string, string> | null;
  answer_i18n: Record<string, string> | null;
};

/**
 * Los textos sueltos de la portada, por clave.
 *
 * Hoy son tres: la fuente del tráiler, su miniatura y la lista de certificados.
 * Se leen todos de una porque son tres filas: pedirlas por separado serían tres
 * viajes a Fráncfort (~30 ms cada uno) para traer menos de un kilobyte.
 */
export async function textosDePortada(): Promise<Record<string, unknown>> {
  const cargar = unstable_cache(
    async () => {
      try {
        const supabase = createSupabaseAdminClient();
        const { data, error } = await supabase
          .from("landing_textos_publicos")
          .select("key, value_i18n");

        if (error || !data) return {};

        const salida: Record<string, unknown> = {};
        for (const fila of data as { key: string; value_i18n: Record<string, unknown> | null }[]) {
          // Español y punto, por el mismo motivo que el FAQ.
          const v = fila.value_i18n?.es;
          if (v !== undefined && v !== null && v !== "") salida[fila.key] = v;
        }
        return salida;
      } catch {
        return {};
      }
    },
    ["landing-textos"],
    { tags: [TAG], revalidate: VIGENCIA }
  );

  return cargar();
}

/** Las claves que el código sabe leer. La lista editable vive en campos.ts. */
export const CLAVE_VIDEO_SRC = "video.src";
export const CLAVE_VIDEO_POSTER = "video.poster";
export const CLAVE_CERTIFICADOS = "about.highlights";

/**
 * Lee una cadena, o null.
 *
 * ⚠️ Comprueba el TIPO, no sólo que exista. `value_i18n` es jsonb: nada impide
 *    que una clave que debería ser texto tenga un array, y entonces React
 *    recibiría un objeto donde espera una URL. Un null se ignora solo; un array
 *    donde va un `src` rompe la sección.
 */
export function comoTexto(valor: unknown): string | null {
  return typeof valor === "string" && valor.trim() !== "" ? valor.trim() : null;
}

/** Lee una lista de cadenas, o null si no hay nada usable. */
export function comoLista(valor: unknown): string[] | null {
  if (!Array.isArray(valor)) return null;
  const limpia = valor.filter((x): x is string => typeof x === "string" && x.trim() !== "").map((x) => x.trim());
  return limpia.length > 0 ? limpia : null;
}

/**
 * Llamar SIEMPRE después de escribir cualquier cosa de la portada.
 *
 * ⚠️ Es un tag PROPIO, distinto del de `site_settings`. Si compartieran tag,
 *    editar una pregunta del FAQ tiraría también la caché de los precios, y al
 *    revés. Son cosas que cambian con frecuencias muy distintas.
 *
 * Sin esto Brunela guarda, ve el cartel verde, y la portada sigue mostrando lo
 * viejo hasta que la caché venza sola a los cinco minutos. Es el modo de fallo
 * que ya pasó con los precios y está documentado en src/lib/settings.ts.
 */
export function invalidarPortada() {
  revalidateTag(TAG);
}
