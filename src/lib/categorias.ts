import { unstable_cache, revalidateTag } from "next/cache";
import { createSupabaseAdminClient } from "@/src/lib/supabase/admin";

/**
 * Lectura cacheada de `categories`. Fase E del plan de escalabilidad.
 *
 * POR QUE SE PUEDE CACHEAR
 *   Las categorias son las MISMAS para todo el mundo: no dependen de auth.uid()
 *   ni del plan de nadie. Cambian cuando Brunela crea o renombra una, o sea
 *   cada varios meses, y se leen en cada carga de /admin/chat y de las
 *   pantallas que las listan.
 *
 * ⚠️ LA REGLA QUE NO SE PUEDE ROMPER
 *   Aca solo entra lo que NO depende de la usuaria. Progreso, perfil, plan,
 *   suscripcion y DMs NUNCA: `unstable_cache` guarda UNA respuesta y se la
 *   sirve a todas. Cachear algo personalizado no es un problema de
 *   rendimiento, es una fuga de datos entre alumnas -- la primera que carga la
 *   pagina define lo que ven las demas.
 *
 *   Por eso esta funcion usa service_role y devuelve solo categorias ACTIVAS:
 *   no hay ninguna decision por usuaria que tomar, asi que no hay nada que se
 *   pueda filtrar de una a otra.
 *
 * INVALIDACION
 *   Toda escritura sobre `categories` tiene que llamar a invalidarCategorias().
 *   Hoy son las de src/features/admin/category-actions.ts. Un cache que no se
 *   invalida es peor que una consulta lenta: Brunela crea una categoria, no la
 *   ve, y la vuelve a crear.
 */

const TAG_CATEGORIAS = "categorias";

export type CategoriaPublica = {
  slug: string;
  name_i18n: Record<string, string>;
  sort_order: number;
};

export const leerCategorias = unstable_cache(
  async (): Promise<CategoriaPublica[]> => {
    const supabase = createSupabaseAdminClient();
    const { data } = await supabase
      .from("categories")
      .select("slug, name_i18n, sort_order")
      .eq("is_active", true)
      .order("sort_order");
    return (data ?? []) as CategoriaPublica[];
  },
  ["categorias-activas"],
  { tags: [TAG_CATEGORIAS], revalidate: 300 }
);

/** Llamar SIEMPRE despues de escribir en categories. */
export function invalidarCategorias() {
  revalidateTag(TAG_CATEGORIAS);
}
