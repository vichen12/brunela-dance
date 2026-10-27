"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

/** El enlace de invitacion con su boton de copiar. */
export function CopiarEnlace({ enlace }: { enlace: string }) {
  const [copiado, setCopiado] = useState(false);
  async function copiar() {
    try {
      await navigator.clipboard.writeText(enlace);
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 2200);
    } catch {
      // Sin permiso de portapapeles: el enlace igual se puede seleccionar a mano.
    }
  }
  return (
    <div className="inv-enlace">
      <input readOnly value={enlace} aria-label="Tu enlace de invitación" onFocus={(e) => e.currentTarget.select()} />
      <button type="button" onClick={copiar} className={copiado ? "es-copiado" : ""}>
        {copiado ? <><Check size={16} strokeWidth={2.6} aria-hidden="true" /> Copiado</> : <><Copy size={16} strokeWidth={2.2} aria-hidden="true" /> Copiar</>}
      </button>
    </div>
  );
}
