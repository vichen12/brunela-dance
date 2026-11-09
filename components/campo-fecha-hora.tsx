"use client";

import { useState } from "react";
import { CampoFecha } from "@/components/campo-fecha";
import { CampoHora } from "@/components/campo-hora";

/**
 * Dia + hora en un solo dato "AAAA-MM-DDTHH:MM", con el calendario y la hora de
 * la marca. Reemplaza a `<input type="datetime-local">` donde el campo es
 * OPCIONAL (apertura y cierre de reservas): vacio no manda nada.
 */
export function CampoFechaHora({ name, defaultValue = "", required = false }: { name: string; defaultValue?: string; required?: boolean }) {
  const [fecha, setFecha] = useState(defaultValue.slice(0, 10));
  const [hora, setHora] = useState(defaultValue.slice(11, 16));
  // Obligatorio: sin dia Y hora no manda nada, y `required` frena el envio.
  const valor = fecha && (hora || !required) ? `${fecha}T${hora || "00:00"}` : "";
  return (
    <div className="cfh">
      <style>{`.cfh { position: relative; display: grid; grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr); gap: 8px; } .cfh-valor { position: absolute; left: 14px; bottom: 0; width: 1px; height: 1px; opacity: 0; pointer-events: none; border: 0 !important; padding: 0 !important; }`}</style>
      <CampoFecha defaultValue={fecha} onCambio={setFecha} etiqueta="Día" />
      <CampoHora defaultValue={hora} onCambio={setHora} etiqueta="Hora" placeholder="Hora" />
      {/* Invisible y no hidden: un hidden no respeta `required`. */}
      <input className="cfh-valor" name={name} value={valor} required={required} onChange={() => {}} tabIndex={-1} aria-hidden="true" />
    </div>
  );
}
