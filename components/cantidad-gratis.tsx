"use client";

import { useState } from "react";
import { Desplegable } from "@/components/desplegable";

/**
 * "¿Cuánto tiempo gratis?": 1, 2, 3, 6 o 12 meses, o días a mano.
 *
 * Manda DOS campos al formulario, `unidad` (meses | dias) y `cantidad`, que
 * son los que leen las actions de src/features/admin/acceso-gratis-actions.ts.
 * El desplegable va sin `name` a proposito: su valor ("3", "dias") no es
 * ninguno de los dos.
 */
const OPCIONES = [
  { value: "1", label: "1 mes" },
  { value: "2", label: "2 meses" },
  { value: "3", label: "3 meses" },
  { value: "6", label: "6 meses" },
  { value: "12", label: "12 meses" },
  { value: "dias", label: "Personalizado (en días)" },
];

export function CantidadGratis({ inicial = "1", etiqueta = "Tiempo gratis" }: { inicial?: string; etiqueta?: string }) {
  const [valor, setValor] = useState(inicial);
  const esDias = valor === "dias";
  return (
    <div className="cg">
      <style>{CSS}</style>
      <Desplegable value={valor} onChange={setValor} opciones={OPCIONES} etiqueta={etiqueta} />
      <input type="hidden" name="unidad" value={esDias ? "dias" : "meses"} />
      {esDias ? (
        <label className="cg-dias">
          <input className="pf-input" type="number" name="cantidad" min={1} max={730} defaultValue={15} required inputMode="numeric" aria-label="Cantidad de días" />
          <span>días</span>
        </label>
      ) : (
        <input type="hidden" name="cantidad" value={valor} />
      )}
    </div>
  );
}

const CSS = `
.cg { display: flex; flex-direction: column; gap: 8px; min-width: 0; }
.cg-dias { display: flex; align-items: center; gap: 10px; }
.cg-dias .pf-input { max-width: 120px; }
.cg-dias span { font-size: 13.5px; font-weight: 700; color: var(--muted); }
`;
