"use client";

import { useState } from "react";
import { CampoFecha } from "@/components/campo-fecha";
import { CampoHora } from "@/components/campo-hora";

/**
 * Cuando es una sesion en vivo: DIA, hora de INICIO y hora de FIN.
 *
 * POR QUE ASI (2026-11-09)
 *   Antes eran dos campos de fecha y hora completos (inicio y fin), con el
 *   selector azul de Chrome, y habia que cargar el mismo dia dos veces. Una
 *   clase es en un dia: se elige una vez y las dos horas.
 *
 * Manda lo MISMO que antes, "AAAA-MM-DDTHH:MM", en `startsAt` y `endsAt`, asi la
 * accion no cambia (la interpreta en hora de Madrid). Si el fin queda antes del
 * inicio (una clase de 23:30 a 00:30), el fin es al dia siguiente.
 */
function sumarDia(fecha: string): string {
  const [a, m, d] = fecha.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d + 1)).toISOString().slice(0, 10);
}

export function HorarioSesion({ inicio = "", fin = "" }: { inicio?: string; fin?: string }) {
  const [fecha, setFecha] = useState(inicio.slice(0, 10));
  const [desde, setDesde] = useState(inicio.slice(11, 16));
  const [hasta, setHasta] = useState(fin.slice(11, 16));
  // Al elegir el inicio, el fin se propone una hora despues si estaba vacio.
  const elegirDesde = (v: string) => {
    setDesde(v);
    if (!hasta && v) setHasta(`${String((Number(v.slice(0, 2)) + 1) % 24).padStart(2, "0")}:${v.slice(3)}`);
  };

  const listo = fecha && desde && hasta;
  const startsAt = listo ? `${fecha}T${desde}` : "";
  const endsAt = listo ? `${hasta < desde ? sumarDia(fecha) : fecha}T${hasta}` : "";

  return (
    <div className="hs">
      <style>{CSS}</style>
      <div className="hs-campo hs-campo--dia">
        <span className="hs-etq">Día</span>
        <CampoFecha defaultValue={fecha} onCambio={setFecha} etiqueta="Día" />
      </div>
      <div className="hs-campo">
        <span className="hs-etq">Empieza <small>(hora de España)</small></span>
        <CampoHora defaultValue={desde} onCambio={elegirDesde} etiqueta="Hora de inicio" />
      </div>
      <div className="hs-campo">
        <span className="hs-etq">Termina</span>
        <CampoHora defaultValue={hasta} onCambio={setHasta} etiqueta="Hora de fin" />
      </div>
      {/* Lo que viaja: invisibles pero no hidden, para que `required` frene el envio. */}
      <input className="hs-valor" name="startsAt" value={startsAt} required onChange={() => {}} tabIndex={-1} aria-hidden="true" />
      <input className="hs-valor" name="endsAt" value={endsAt} required onChange={() => {}} tabIndex={-1} aria-hidden="true" />
      {listo && hasta < desde && <p className="hs-nota">Termina al día siguiente.</p>}
    </div>
  );
}

const CSS = `
.hs { position: relative; grid-column: 1 / -1; display: grid; gap: 14px 16px; grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr) minmax(0, 1fr); }
.hs-campo { display: flex; flex-direction: column; gap: 7px; min-width: 0; }
.hs-etq { font-size: 12.5px; font-weight: 800; color: var(--ink, #3B2A2C); }
.hs-etq small { font-weight: 600; color: var(--muted, #8A6F68); }
.hs-valor { position: absolute; left: 14px; bottom: 0; width: 1px; height: 1px; opacity: 0; pointer-events: none; border: 0 !important; padding: 0 !important; }
.hs-nota { grid-column: 1 / -1; margin: -4px 0 0; font-size: 12.5px; font-weight: 700; color: var(--pink-deep, #B03A3E); }
@media (max-width: 640px) { .hs { grid-template-columns: 1fr 1fr; } .hs-campo--dia { grid-column: 1 / -1; } }
`;
