"use client";

import { useEffect, useState } from "react";
import { ProveedorIcono } from "@/components/proveedor-icono";
import { textoUnirse, type Proveedor } from "@/src/features/studio/enlace-clase";
import { MINUTOS_ANTES_DE_UNIRSE, ventanaUnirse } from "@/src/features/studio/sesiones-privadas-reglas";

/**
 * Boton "Unirse" de una sesion privada. Se habilita 15 minutos antes y se
 * apaga cuando termina, SIN recargar: si ella abre la pagina 20 minutos antes
 * y espera, el boton se enciende solo.
 *
 * Props: solo cadenas y numeros (trampa 6). El icono se elige de este lado.
 *
 * ⚠️ El primer render usa la hora que le paso el servidor (`ahoraServidor`),
 *    no la del navegador: si no coinciden, React se queja al hidratar. El
 *    reloj propio entra en el useEffect.
 */
export function UnirsePrivada({
  inicio, duracion, enlace, proveedor, ahoraServidor, fechaTexto,
}: {
  inicio: string;
  duracion: number;
  enlace: string | null;
  proveedor: Proveedor | null;
  ahoraServidor: number;
  /** "jue 16 oct · 18:00": lo que se muestra antes de que abra. */
  fechaTexto: string;
}) {
  const [ahora, setAhora] = useState(ahoraServidor);
  useEffect(() => {
    setAhora(Date.now());
    const id = window.setInterval(() => setAhora(Date.now()), 20000);
    return () => window.clearInterval(id);
  }, []);

  const v = ventanaUnirse({ starts_at: inicio, duracion_minutos: duracion }, ahora);
  if (v === "terminada") return <span className="upv upv--fin">Terminó</span>;
  if (v === "antes") {
    return (
      <span className="upv upv--antes" title={`El botón para unirte se habilita ${MINUTOS_ANTES_DE_UNIRSE} minutos antes`}>
        {fechaTexto}
      </span>
    );
  }
  if (!enlace || !proveedor) return <span className="upv upv--antes">El enlace llega en un momento</span>;
  return (
    <a href={enlace} target="_blank" rel="noreferrer" className="upv upv--ya">
      <ProveedorIcono proveedor={proveedor} size={17} /> {textoUnirse(proveedor).replace("a la clase", "a la sesión")}
    </a>
  );
}
