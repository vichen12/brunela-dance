"use client";

import { useEffect } from "react";
import { aDireccion } from "@/src/lib/slug";

/**
 * Completa el campo "Dirección" a partir del nombre, mientras se escribe.
 *
 * ⚠️ 🔴 SOLO AL CREAR. NUNCA AL EDITAR.
 *   La dirección es el enlace permanente de una clase, un programa o un pack.
 *   Regenerarla porque alguien corrigió una tilde del título rompería todos los
 *   enlaces ya compartidos, y sin ningún error: el enlace viejo simplemente
 *   deja de encontrar nada. Por eso quien lo monta pasa `activo` sólo en el
 *   formulario de alta, y los de edición no lo montan.
 *
 * POR QUE ES UN CENTINELA QUE BUSCA POR DOM Y NO UN CAMPO CONTROLADO
 *   Los formularios de este panel son siete y están maquetados distinto: unos
 *   en grilla, otros dentro de bloques plegables, algunos en server components
 *   y otros en componentes de cliente. Un componente que envolviera los dos
 *   campos obligaría a rehacer las siete maquetas. Así se suelta dentro del
 *   <form> y se cablea solo, sin tocar el layout.
 *
 *   Es el mismo patrón que `CerrarAlGuardar` en los drawers.
 *
 * DEJA DE MANDAR EN CUANTO ELLA TOCA LA DIRECCION
 *   Si escribe la dirección a mano, se corta la sincronización para siempre.
 *   Seguir pisándosela sería pelearle al usuario, que es peor que no ayudar.
 */
export function AutoDireccion({
  desde,
  hacia = "slug",
  activo = true,
}: {
  /** `name` del input del que se saca el texto: nombreEs, titleEs, nameEs… */
  desde: string;
  /** `name` del input de la dirección. */
  hacia?: string;
  /** Sólo `true` en el formulario de ALTA. */
  activo?: boolean;
}) {
  useEffect(() => {
    if (!activo) return;

    // Se busca dentro del <form> propio y no en todo el documento: en /admin
    // conviven el formulario de alta y varios de edición con los mismos `name`,
    // y sin acotar se cablearía el que no es.
    const marca = document.querySelector<HTMLElement>(`[data-auto-direccion="${desde}"]`);
    const form = marca?.closest("form");
    if (!form) return;

    const origen = form.querySelector<HTMLInputElement>(`input[name="${desde}"]`);
    const destino = form.querySelector<HTMLInputElement>(`input[name="${hacia}"]`);
    if (!origen || !destino) return;

    // Si ya viene con algo, es una edición disfrazada o un valor recuperado por
    // el navegador: no se toca.
    let sincronizado = destino.value.trim() === "";

    const alEscribirNombre = () => {
      if (!sincronizado) return;
      destino.value = aDireccion(origen.value);
    };

    // `input` y no `change`: tiene que verse aparecer mientras escribe, para
    // que se entienda de dónde sale y que se puede corregir.
    const alTocarDireccion = () => {
      sincronizado = false;
    };

    origen.addEventListener("input", alEscribirNombre);
    destino.addEventListener("input", alTocarDireccion);
    return () => {
      origen.removeEventListener("input", alEscribirNombre);
      destino.removeEventListener("input", alTocarDireccion);
    };
  }, [desde, hacia, activo]);

  // El ancla que permite encontrar el <form> correcto.
  return <span data-auto-direccion={desde} style={{ display: "none" }} aria-hidden />;
}
