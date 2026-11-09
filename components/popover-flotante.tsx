"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Un desplegable que flota POR ENCIMA DE TODO, pegado a su boton.
 *
 * POR QUE UN PORTAL (2026-11-09)
 *   Dentro del panel, el calendario quedaba debajo de la seccion siguiente
 *   ("Próximas" se le montaba encima): los bloques de alrededor crean su propio
 *   contexto de apilado y ningun z-index lo saca de ahi. Dibujado en <body>, con
 *   posicion fija calculada desde el boton, no lo tapa nada.
 *
 * Se cierra al tocar afuera (del boton y del desplegable) o con Escape.
 */
export function PopoverFlotante({
  ancla, abierto, onCerrar, ancho = 320, children, etiqueta,
}: {
  ancla: React.RefObject<HTMLElement | null>;
  abierto: boolean;
  onCerrar: () => void;
  ancho?: number;
  children: React.ReactNode;
  etiqueta: string;
}) {
  const caja = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; arriba: boolean } | null>(null);

  useLayoutEffect(() => {
    if (!abierto) return;
    const ubicar = () => {
      const r = ancla.current?.getBoundingClientRect();
      if (!r) return;
      const alto = caja.current?.offsetHeight ?? 360;
      const w = Math.min(ancho, window.innerWidth - 32);
      const left = Math.max(16, Math.min(r.left, window.innerWidth - w - 16));
      // Abajo si entra; si no, arriba del boton.
      const arriba = r.bottom + 8 + alto > window.innerHeight && r.top - 8 - alto > 0;
      setPos({ top: arriba ? r.top - 8 - alto : r.bottom + 8, left, arriba });
    };
    ubicar();
    const raf = requestAnimationFrame(ubicar);
    window.addEventListener("scroll", ubicar, true);
    window.addEventListener("resize", ubicar);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("scroll", ubicar, true); window.removeEventListener("resize", ubicar); };
  }, [abierto, ancla, ancho]);

  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => {
      const t = e.target as Node;
      if (caja.current?.contains(t) || ancla.current?.contains(t)) return;
      onCerrar();
    };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") { onCerrar(); ancla.current?.focus(); } };
    document.addEventListener("mousedown", fuera);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", fuera); document.removeEventListener("keydown", esc); };
  }, [abierto, ancla, onCerrar]);

  if (!abierto || typeof document === "undefined") return null;
  return createPortal(
    <div
      ref={caja}
      role="dialog"
      aria-label={etiqueta}
      className="pf-pop sistema"
      style={{
        position: "fixed", zIndex: 1000, top: pos?.top ?? -9999, left: pos?.left ?? -9999,
        width: `min(${ancho}px, calc(100vw - 32px))`, visibility: pos ? "visible" : "hidden",
      }}
    >
      {children}
    </div>,
    document.body
  );
}

/** El aspecto del desplegable: lo comparten el calendario y la hora. */
export const CSS_POPOVER = `
.pf-pop { padding: 14px; border-radius: 22px; background: #fff; border: 1px solid var(--linea, #F6E7E1); box-shadow: 0 24px 48px -20px rgba(120,50,40,.45); font-family: inherit; }
`;
