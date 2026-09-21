"use client";

import { useState } from "react";
import { SelectorMultiple } from "@/components/selector-multiple";
import {
  PLANES,
  planesCarosSinIncluir,
  textoDePlanesSinIncluir,
} from "@/src/features/studio/catalogo-clases";

/**
 * Qué planes pueden ver la clase, con aviso si falta uno más caro.
 *
 * POR QUE HACE FALTA EL AVISO
 *   La combinación libre de planes permite cualquier conjunto, y eso incluye
 *   conjuntos que casi siempre son un error de tilde: dejar la clase para Corps
 *   de Ballet y no para Principal. Quien paga el plan más caro espera ver todo
 *   lo que ven los de abajo.
 *
 *   El mismo descuido, hecho por SQL en vez de por el formulario, ya costó un
 *   arreglo: vaciar `planes_permitidos` ensanchaba el acceso en silencio
 *   (migración `20260921_2`). Acá se ataja del otro lado, donde lo comete una
 *   persona.
 *
 * 🔴 AVISA, NO BLOQUEA. Decidido el 2026-09-21.
 *    Puede haber una clase de bienvenida solo para quien recién empieza, y
 *    bloquearla dejaría a Brunela trabada sin forma de explicarle al sistema que
 *    esta vez es a propósito. Es la misma regla que `/admin/precios`.
 */

export function SelectorDePlanes({
  name,
  inicial,
  disabled = false,
}: {
  name: string;
  inicial: string[];
  disabled?: boolean;
}) {
  const [elegidos, setElegidos] = useState<string[]>(inicial);

  const faltantes = planesCarosSinIncluir(elegidos);
  const aviso = textoDePlanesSinIncluir(faltantes);

  return (
    <>
      <SelectorMultiple
        name={name}
        opciones={PLANES}
        inicial={inicial}
        disabled={disabled}
        requerido
        mensajeRequerido="Elegí al menos un plan: una clase que no ve nadie no sirve."
        onCambio={setElegidos}
      />

      {aviso && (
        <p
          role="status"
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 8,
            marginTop: 10,
            padding: "9px 12px",
            borderRadius: 10,
            // Ambar y no rojo: rojo se lee como "esto está mal y no podés
            // seguir", y acá se puede seguir perfectamente.
            background: "#fffbeb",
            border: "1px solid #fde68a",
            color: "#854d0e",
            fontSize: 11.5,
            lineHeight: 1.6,
          }}
        >
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden
            style={{ flexShrink: 0, marginTop: 1 }}>
            <path d="M8 2.2l6 11.6H2L8 2.2Z" stroke="currentColor" strokeWidth="1.3"
              strokeLinejoin="round" />
            <path d="M8 6.6v3.1M8 11.5v.5" stroke="currentColor" strokeWidth="1.5"
              strokeLinecap="round" />
          </svg>
          <span>
            <strong style={{ fontWeight: 700 }}>{aviso}</strong>{" "}
            Los planes más caros suelen ver todo lo de los más baratos. Si es a propósito,
            dejalo así.
          </span>
        </p>
      )}
    </>
  );
}
