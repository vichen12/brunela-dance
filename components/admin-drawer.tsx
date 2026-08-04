"use client";

import { useEffect, useRef } from "react";

/**
 * Panel lateral de edicion del panel de admin.
 *
 * POR QUE UN DRAWER Y NO UNA RUTA APARTE
 *   Brunela sigue viendo la lista mientras edita, y volver es cerrar. No hay
 *   que resolver una ruta nueva por cada recurso, y no se pierde el lugar en
 *   el listado -- que con 19 clases y scroll ya importa.
 *
 * POR QUE NO ES UNA NAVEGACION
 *   El estado vive en el componente de lista, no en la URL. La lista ya trajo
 *   todos los campos de cada item, asi que abrir el panel es instantaneo: cero
 *   consultas, cero navegacion, cero esqueleto.
 *
 * LO QUE HACE FALTA PARA QUE UN PANEL ASI NO SEA UNA TRAMPA
 *   - Escape lo cierra. Sin esto hay que buscar la X con el mouse.
 *   - El foco entra al panel al abrirse y vuelve al disparador al cerrarse, o
 *     quien navega con teclado queda perdido detras del velo.
 *   - El fondo no scrollea. Si no, se scrollea la lista de atras y al cerrar
 *     el panel la pagina quedo en otro lado.
 */
export function AdminDrawer({
  abierto,
  titulo,
  subtitulo,
  onCerrar,
  children,
}: {
  abierto: boolean;
  titulo: string;
  subtitulo?: string;
  onCerrar: () => void;
  children: React.ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const disparadorRef = useRef<Element | null>(null);

  useEffect(() => {
    if (!abierto) return;

    disparadorRef.current = document.activeElement;
    const overflowPrevio = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCerrar();
    };
    document.addEventListener("keydown", onKey);

    // Al siguiente cuadro: antes el panel todavia no esta en el DOM.
    const id = window.requestAnimationFrame(() => {
      panelRef.current?.querySelector<HTMLElement>(
        "input:not([type=hidden]), select, textarea, button"
      )?.focus();
    });

    return () => {
      document.removeEventListener("keydown", onKey);
      window.cancelAnimationFrame(id);
      document.body.style.overflow = overflowPrevio;
      (disparadorRef.current as HTMLElement | null)?.focus?.();
    };
  }, [abierto, onCerrar]);

  if (!abierto) return null;

  return (
    <>
      {/* Velo. Cerrar al hacer clic afuera es lo que espera cualquiera. */}
      <div
        onClick={onCerrar}
        style={{
          position: "fixed", inset: 0, zIndex: 60,
          background: "rgba(28,25,23,0.42)",
          backdropFilter: "blur(2px)",
        }}
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        style={{
          position: "fixed", top: 0, right: 0, bottom: 0, zIndex: 61,
          width: "min(560px, 100vw)",
          background: "#fff",
          borderLeft: "1.5px solid var(--pink-soft)",
          boxShadow: "-24px 0 60px rgba(28,25,23,0.14)",
          display: "flex", flexDirection: "column",
          animation: "drawer-in 180ms ease",
        }}
      >
        <div style={{
          padding: "20px 24px", borderBottom: "1.5px solid #f0eeec",
          display: "flex", alignItems: "flex-start", justifyContent: "space-between",
          gap: 16, flexShrink: 0,
        }}>
          <div style={{ minWidth: 0 }}>
            <h2 className="display" style={{ fontSize: 22, margin: 0, color: "#1c1917", lineHeight: 1.25 }}>
              {titulo}
            </h2>
            {subtitulo && (
              <p style={{ fontSize: 11.5, color: "var(--muted)", margin: "4px 0 0" }}>{subtitulo}</p>
            )}
          </div>
          <button
            onClick={onCerrar}
            aria-label="Cerrar"
            style={{
              flexShrink: 0, width: 34, height: 34, borderRadius: 10,
              border: "1.5px solid #f0eeec", background: "#fff",
              color: "var(--muted)", cursor: "pointer", fontSize: 17, lineHeight: 1,
            }}
          >×</button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px 28px" }}>
          {children}
        </div>
      </div>

      <style>{`
        @keyframes drawer-in {
          from { transform: translateX(18px); opacity: 0.4; }
          to   { transform: translateX(0);    opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          [role="dialog"] { animation: none !important; }
        }
      `}</style>
    </>
  );
}

/**
 * Bloque plegable para los campos que casi nunca se tocan.
 *
 * PLEGADO NO ES ESCONDIDO: el titulo dice que hay adentro y cuantos campos son,
 * asi que se ve que existen. Esconderlos sin decirlo haria que Brunela crea que
 * la traduccion al ingles no se puede cargar.
 */
export function BloqueAvanzado({
  titulo, cantidad, children,
}: {
  titulo: string; cantidad: number; children: React.ReactNode;
}) {
  return (
    <details style={{
      border: "1.5px solid #f0eeec", borderRadius: 14,
      padding: "12px 16px", marginTop: 14,
    }}>
      <summary style={{
        listStyle: "none", cursor: "pointer", display: "flex",
        alignItems: "center", justifyContent: "space-between", gap: 10, minHeight: 28,
      }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: "#57534e" }}>{titulo}</span>
        <span style={{
          fontSize: 10, fontWeight: 700, color: "var(--muted)",
          background: "#fafaf9", padding: "3px 9px", borderRadius: 99,
        }}>{cantidad} campos</span>
      </summary>
      <div style={{ marginTop: 14, display: "grid", gap: 12 }}>{children}</div>
    </details>
  );
}
