/**
 * El precio de un pack: un solo lugar que lo interpreta.
 *
 * ⚠️ POR QUE ESTE ARCHIVO EXISTE
 *   Desde el 2026-08-06 el precio y los identificadores de Stripe se pueden
 *   cargar desde DOS pantallas: el panel del pack (donde se crea) y /admin/precios
 *   (donde se revisan todos juntos). Dos formularios que escriben las mismas tres
 *   columnas es exactamente como terminan mostrando numeros distintos.
 *
 *   Aca vive la unica interpretacion. Las dos acciones la usan.
 *
 * ⚠️ NO LLEVA "use server": es un modulo comun. Un archivo con esa directiva
 *    solo puede exportar funciones async, y esto es una funcion pura.
 */

/**
 * Solo el importe. Los codigos de Stripe ya no se escriben a mano desde el
 * 2026-10-27: los pone asegurarPrecioDePack() despues de guardar.
 */
export type CamposDePrecio = {
  price_cents: number;
};

/** Devuelve los campos listos para la base, o un motivo legible. */
export function leerCamposDePrecio(fd: FormData): CamposDePrecio | { fallo: string } {
  // Se acepta la coma decimal: es como se escribe un precio en castellano y
  // Brunela no tiene por que saber que el punto es lo que espera el programa.
  const crudo = ((fd.get("precio") as string) ?? "").trim().replace(",", ".");
  const euros = Number(crudo);

  if (!crudo || !Number.isFinite(euros)) {
    return { fallo: "El precio tiene que ser un número, por ejemplo 24,90." };
  }
  if (euros <= 0) {
    return { fallo: "El precio tiene que ser mayor que cero." };
  }

  return {
    // En centimos, como Stripe. Guardar euros en coma flotante es como se
    // pierden centimos: 0.1 + 0.2 no da 0.3.
    price_cents: Math.round(euros * 100),
  };
}
