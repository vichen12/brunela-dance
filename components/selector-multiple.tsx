"use client";

import { useState } from "react";
import type { Opcion } from "@/src/features/studio/catalogo-clases";

/**
 * Seleccion multiple en fichas, no un <select multiple>.
 *
 * POR QUE NO `<select multiple>`
 *   Porque para elegir dos cosas hay que saber que se hace con Ctrl, y en el
 *   telefono directamente no se puede. Brunela carga clases desde donde este.
 *   Fichas tildables: se ve lo elegido sin desplegar nada y se toca con el dedo.
 *
 * COMO VIAJA AL SERVIDOR
 *   Un <input type="hidden"> por opcion elegida, todos con el MISMO `name`. Asi
 *   `formData.getAll(name)` devuelve la lista completa, sin separar por comas,
 *   que es lo que hacia que "Fit Ball, Mat" se guardara como un solo material.
 *
 * ⚠️ Los checkbox de verdad quedan afuera del formulario a proposito
 *    (`name` solo en los hidden). Un checkbox sin marcar no manda nada y uno
 *    marcado manda "on": mezclarlos daria una lista de "on".
 */

type Props = {
  name: string;
  opciones: readonly Opcion[];
  /** Lo que ya estaba guardado. */
  inicial?: string[];
  /** Tildar esta opcion destilda todas las demas, y viceversa. */
  excluyente?: string;
  disabled?: boolean;
  /** Bloquea el envio con un mensaje del navegador si no se eligio nada. */
  requerido?: boolean;
  mensajeRequerido?: string;
  /**
   * Se llama con la lista completa cada vez que cambia.
   *
   * Existe para que quien envuelve a este componente pueda mostrar un aviso sin
   * duplicar el estado -- que es donde las dos copias se desincronizan y el
   * aviso empieza a hablar de una seleccion que ya no es la que hay.
   */
  onCambio?: (elegidos: string[]) => void;
};

export function SelectorMultiple({
  name,
  opciones,
  inicial = [],
  excluyente,
  disabled = false,
  requerido = false,
  mensajeRequerido = "Elegí al menos una opción.",
  onCambio,
}: Props) {
  const [elegidos, setElegidos] = useState<string[]>(() =>
    inicial.filter((s) => opciones.some((o) => o.slug === s))
  );

  function alternar(slug: string) {
    // Se calcula el siguiente valor a mano en vez de con el updater funcional
    // porque `onCambio` tiene que recibirlo. Avisar desde dentro del updater
    // seria escribir estado de otro componente durante un render de este, que
    // React rechaza; y avisar despues de setElegidos con la variable vieja
    // mandaria siempre la seleccion anterior.
    const estaba = elegidos.includes(slug);
    const siguiente = estaba
      ? elegidos.filter((s) => s !== slug)
      : // "Sin material" y un material son contradictorios: el ultimo toque gana.
        excluyente && slug === excluyente
        ? [slug]
        : [...elegidos.filter((s) => s !== excluyente), slug];

    setElegidos(siguiente);
    onCambio?.(siguiente);
  }

  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
        {opciones.map((opcion) => {
          const activo = elegidos.includes(opcion.slug);
          return (
            <button
              key={opcion.slug}
              type="button"
              disabled={disabled}
              aria-pressed={activo}
              onClick={() => alternar(opcion.slug)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
                padding: "6px 12px",
                borderRadius: 99,
                cursor: disabled ? "default" : "pointer",
                fontFamily: "inherit",
                fontSize: 12,
                fontWeight: 600,
                lineHeight: 1.4,
                textAlign: "left",
                opacity: disabled ? 0.55 : 1,
                // --pink-mid y no --pink: aca hay texto que se lee, no una
                // superficie que se mira de reojo. Ver CLAUDE.md, decisiones.
                background: activo ? "var(--pink-mid)" : "#fff",
                color: activo ? "#fff" : "#57534e",
                border: `1px solid ${activo ? "var(--pink-mid)" : "#e7e5e4"}`,
                transition: "background 0.12s, border-color 0.12s",
              }}
            >
              <span
                aria-hidden
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 13,
                  height: 13,
                  borderRadius: 4,
                  flexShrink: 0,
                  background: activo ? "#fff" : "transparent",
                  border: `1px solid ${activo ? "#fff" : "#d6d3d1"}`,
                }}
              >
                {activo && (
                  <svg width="9" height="9" viewBox="0 0 10 10" fill="none">
                    <path
                      d="M1.5 5.2l2.4 2.4L8.5 3"
                      stroke="var(--pink-mid)"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </span>
              {opcion.label}
            </button>
          );
        })}
      </div>

      {elegidos.map((slug) => (
        <input key={slug} type="hidden" name={name} value={slug} />
      ))}

      {/*
        La validacion del navegador necesita un control VISIBLE y enfocable: un
        input oculto con `required` hace que el formulario se niegue a enviarse
        sin decir por que -- el navegador intenta enfocar algo que no se ve y
        abandona en silencio. Por eso este queda de 1px, transparente y encima
        de las fichas, para que el globito salga apuntando a ellas.
      */}
      {requerido && (
        <input
          tabIndex={-1}
          required={elegidos.length === 0}
          value={elegidos.join(",")}
          onChange={() => {}}
          onInvalid={(e) => e.currentTarget.setCustomValidity(mensajeRequerido)}
          onInput={(e) => e.currentTarget.setCustomValidity("")}
          style={{
            width: 1,
            height: 1,
            padding: 0,
            margin: "-1px 0 0",
            border: "none",
            opacity: 0,
            position: "relative",
            display: "block",
          }}
        />
      )}
    </div>
  );
}
