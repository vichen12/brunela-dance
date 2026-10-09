"use client";

import { useState } from "react";

/**
 * Los certificados de «Sobre mí»: uno por línea, con la vista previa de las
 * etiquetas tal como salen en la portada. Viaja igual que antes (un textarea
 * con el mismo `name`), así que la acción no cambia.
 */
export function CertificadosDePortada({ name, valorActual }: { name: string; valorActual: string }) {
  const [texto, setTexto] = useState(valorActual);
  const etiquetas = texto.split("\n").map((t) => t.trim()).filter(Boolean);

  return (
    <div className="pt-cert">
      <textarea
        id="highlights"
        name={name}
        rows={6}
        className="pt-cert-texto"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder={"Ballet\nPilates\nPBT\nPCT\nRAD CPD Credits"}
      />
      <div className="pt-cert-vista" aria-label="Así se ven en la portada">
        <span className="pt-cert-rotulo">Así se ven</span>
        {etiquetas.length === 0 ? (
          <span className="pt-cert-vacio">Escribí uno por línea y aparecen acá.</span>
        ) : (
          <div className="pt-cert-chips">
            {etiquetas.map((t, i) => (
              <span key={t + i} className="pt-cert-chip" style={{ animationDelay: `${i * 0.04}s` }}>{t}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
