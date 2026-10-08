"use client";

import { useEffect, useState } from "react";

function saludoPara(hora: number) {
  return hora < 12 ? "Buenos días" : hora < 20 ? "Buenas tardes" : "Buenas noches";
}

/**
 * "Buenos días / Buenas tardes / Buenas noches" con la hora DEL NAVEGADOR.
 *
 * En el servidor `getHours()` es la hora de Vercel (UTC): a las 9 de la mañana
 * en Madrid decía "Buenos días" y a las 13 decía "Buenos días" también. El
 * primer render usa la del servidor para no saltar en blanco, y el efecto la
 * corrige con la de la alumna.
 */
export function Saludo() {
  const [texto, setTexto] = useState(() => saludoPara(new Date().getHours()));
  useEffect(() => {
    setTexto(saludoPara(new Date().getHours()));
  }, []);
  return <span suppressHydrationWarning>{texto}</span>;
}
