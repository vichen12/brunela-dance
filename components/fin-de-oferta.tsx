"use client";

import { useEffect, useState } from "react";

/**
 * "Termina en 2 d 04:12:33": la cuenta regresiva de una oferta.
 *
 * Arranca en null y se llena en el navegador: la hora del servidor y la del
 * celular no coinciden, y pintarla en el servidor daria un error de
 * hidratacion. Al llegar a cero dice "Terminó" (el cobro igual lo decide el
 * servidor con la fecha de la base).
 */
export function FinDeOferta({ hasta, className }: { hasta: string; className?: string }) {
  const [resta, setResta] = useState<number | null>(null);

  useEffect(() => {
    const fin = Date.parse(hasta);
    const tic = () => setResta(Math.max(0, fin - Date.now()));
    tic();
    const t = window.setInterval(tic, 1000);
    return () => window.clearInterval(t);
  }, [hasta]);

  if (resta === null) return <span className={className}>&nbsp;</span>;
  if (resta <= 0) return <span className={className}>Terminó</span>;
  const s = Math.floor(resta / 1000);
  const d = Math.floor(s / 86400);
  const hh = String(Math.floor((s % 86400) / 3600)).padStart(2, "0");
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return (
    <span className={className} aria-label="Tiempo que queda de la oferta">
      Termina en {d > 0 ? `${d} d ` : ""}{hh}:{mm}:{ss}
    </span>
  );
}
