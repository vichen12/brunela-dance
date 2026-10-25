import { leerAjuste } from "@/src/lib/settings";
import { AJUSTE_MATERIALES, materialesDeAjuste, type AjusteMateriales } from "@/src/features/studio/catalogo-clases";

/** La lista de materiales que edita Brunela (cacheada con el resto de los ajustes). */
export async function leerMateriales(): Promise<AjusteMateriales> {
  return materialesDeAjuste(await leerAjuste<Partial<AjusteMateriales>>(AJUSTE_MATERIALES));
}
