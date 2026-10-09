"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, X } from "lucide-react";

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

  /*
   * POR QUE VA EN UN PORTAL
   *   El boton que lo abre vive dentro de una tarjeta que se levanta al pasar
   *   el mouse (transform). Un ancestro con transform convierte a
   *   `position: fixed` en relativo A ESA TARJETA: el velo quedaba del tamano
   *   de la tarjeta y un clic en el fondo no tocaba el velo, asi que no
   *   cerraba. Montado en la raiz `.sistema` (que no tiene transform) vuelve a
   *   cubrir la pantalla, y conserva las variables de color del sistema.
   */
  const destino = (document.querySelector(".sistema") as HTMLElement | null) ?? document.body;

  return createPortal(
    <>
      {/* Velo. Cerrar al hacer clic afuera es lo que espera cualquiera. */}
      <div className="adr-velo" onClick={onCerrar} />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        className="adr-panel"
      >
        <div className="adr-cab">
          <div style={{ minWidth: 0 }}>
            <p className="adr-eyebrow"><span aria-hidden="true" />Editando</p>
            <h2 className="adr-titulo">{titulo}</h2>
            {subtitulo && <p className="adr-sub">{subtitulo}</p>}
          </div>
          <button type="button" onClick={onCerrar} aria-label="Cerrar" className="adr-cerrar">
            <X size={18} strokeWidth={2.2} aria-hidden="true" />
          </button>
        </div>

        <div className="adr-cuerpo">
          {children}
        </div>
      </div>

      <style>{CSS_DRAWER}</style>
    </>,
    destino
  );
}

/*
 * Estilos compartidos de los formularios que viven dentro del panel (y del
 * formulario de subida). Son objetos, no componentes, para que clase, plan y
 * pack hablen el mismo idioma visual sin copiarlo tres veces. Solo los
 * importan componentes de cliente.
 */
export const campoSuave: React.CSSProperties = {
  width: "100%", borderRadius: 14, border: "1.5px solid #E9CFC5",
  background: "#fff", color: "#3B2A2C", padding: "11px 14px",
  fontSize: 14, outline: "none", fontFamily: "inherit",
  transition: "border-color .2s, box-shadow .2s",
};

export const etiquetaSuave: React.CSSProperties = {
  display: "block", fontSize: 12.5, fontWeight: 800, color: "#3B2A2C", marginBottom: 7,
};

export const botonPrincipal: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
  background: "var(--pink)", color: "#fff", border: "none", borderRadius: 99,
  padding: "12px 24px", fontSize: 14, fontWeight: 800, fontFamily: "inherit",
  cursor: "pointer", whiteSpace: "nowrap",
  boxShadow: "0 14px 26px -14px rgba(230,79,85,.85)",
};

export const botonBorrar: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
  background: "#fff", color: "var(--pink-deep)", border: "1.5px solid var(--pink-line)",
  borderRadius: 99, padding: "11px 22px", fontSize: 14, fontWeight: 800,
  fontFamily: "inherit", cursor: "pointer", whiteSpace: "nowrap",
};

const CSS_DRAWER = `
@keyframes adr-entra { from { transform: translateX(28px); opacity: 0; } to { transform: none; opacity: 1; } }
@keyframes adr-funde { from { opacity: 0; } to { opacity: 1; } }
.adr-velo {
  position: fixed; inset: 0; z-index: 60;
  background: rgba(90, 50, 45, 0.26); backdrop-filter: blur(5px);
  animation: adr-funde .3s ease both;
}
.adr-panel {
  position: fixed; top: 12px; right: 12px; bottom: 12px; z-index: 61;
  width: min(600px, calc(100vw - 24px));
  display: flex; flex-direction: column; overflow: hidden;
  background: #fff; border: 1px solid #F3E3DC; border-radius: 30px;
  box-shadow: 0 2px 4px rgba(150,80,70,.06), 0 40px 80px -30px rgba(176,70,70,.5);
  color: #3B2A2C;
  animation: adr-entra .45s cubic-bezier(.22,1,.36,1) both;
}
.adr-cab {
  position: relative; overflow: hidden; isolation: isolate; flex-shrink: 0;
  display: flex; align-items: flex-start; justify-content: space-between; gap: 16px;
  padding: 22px 22px 20px 26px;
  background: linear-gradient(120deg, #FFF1EC 0%, #FFF7F3 55%, #FFEFE6 100%);
  border-bottom: 1px solid #F3E3DC;
}
.adr-cab::before {
  content: ""; position: absolute; z-index: -1; width: 240px; height: 240px; right: -70px; top: -130px; border-radius: 50%;
  background: radial-gradient(circle, rgba(255,205,185,.8), transparent 68%);
}
.adr-eyebrow {
  display: inline-flex; align-items: center; gap: 7px; margin: 0 0 10px; padding: 5px 12px 5px 10px; border-radius: 99px;
  background: #fff; box-shadow: 0 8px 20px -14px rgba(176,90,80,.5);
  font-size: 12px; font-weight: 800; color: #B03A3E;
}
.adr-eyebrow span { width: 7px; height: 7px; border-radius: 50%; background: var(--pink); }
.adr-titulo { margin: 0; font-size: 24px; font-weight: 900; line-height: 1.15; letter-spacing: -0.02em; color: #3B2A2C; overflow-wrap: anywhere; }
.adr-sub { margin: 6px 0 0; font-size: 13px; font-weight: 700; color: #8A6F68; overflow-wrap: anywhere; }
.adr-cerrar {
  flex-shrink: 0; width: 42px; height: 42px; border-radius: 50%; border: 1.5px solid #E9CFC5; background: #fff;
  display: grid; place-items: center; color: #8A6F68; cursor: pointer;
  transition: background .2s, color .2s, transform .35s cubic-bezier(.22,1,.36,1);
}
.adr-cerrar:hover { background: #FFF2EE; color: #B03A3E; transform: rotate(90deg); }
.adr-cuerpo { flex: 1; overflow-y: auto; overscroll-behavior: contain; padding: 22px 26px 30px; scrollbar-width: thin; }
.adr-panel input:not([type=checkbox]):not([type=radio]):focus,
.adr-panel textarea:focus { border-color: var(--pink) !important; box-shadow: 0 0 0 4px rgba(230,79,85,.12); }
.adr-g2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
.adr-g3 { display: grid; grid-template-columns: 140px minmax(0, 1fr) minmax(0, 1fr); gap: 14px; align-items: start; }
.adr-caja { border-radius: 22px; border: 1px solid #F3E3DC; background: #FFFAF6; padding: 18px 20px; }
.adr-acciones { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
.adr-acciones button { transition: transform .25s cubic-bezier(.22,1,.36,1), background .2s; }
.adr-acciones button:hover:not(:disabled) { transform: translateY(-1px); }
.adr-avanzado { margin-top: 14px; border: 1px solid #F3E3DC; border-radius: 20px; background: #fff; transition: border-color .2s, background .2s; }
.adr-avanzado[open] { background: #FFFAF6; }
.adr-avanzado:hover { border-color: #E9CFC5; }
.adr-avanzado > summary { list-style: none; cursor: pointer; display: flex; align-items: center; gap: 10px; min-height: 52px; padding: 0 16px; }
.adr-avanzado > summary::-webkit-details-marker { display: none; }
.adr-avanzado-tit { flex: 1; font-size: 14px; font-weight: 800; color: #3B2A2C; }
.adr-avanzado-n { font-size: 12px; font-weight: 800; color: #C25E3A; background: #FFE2D3; padding: 3px 10px; border-radius: 99px; }
.adr-avanzado-flecha { color: #B39189; transition: transform .3s; }
.adr-avanzado[open] .adr-avanzado-flecha { transform: rotate(180deg); }
.adr-avanzado-cuerpo { padding: 2px 16px 16px; display: grid; gap: 12px; }
@media (max-width: 560px) {
  .adr-panel { top: 8px; right: 0; bottom: 0; width: 100vw; border-radius: 28px 28px 0 0; }
  .adr-cab { padding: 18px 16px 16px 18px; }
  .adr-cuerpo { padding: 18px 16px 28px; }
  .adr-g2, .adr-g3 { grid-template-columns: minmax(0, 1fr); }
}
@media (prefers-reduced-motion: reduce) {
  .adr-panel, .adr-velo { animation: none !important; }
  .adr-cerrar:hover { transform: none; }
}
`;

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
    <details className="adr-avanzado">
      <summary>
        <span className="adr-avanzado-tit">{titulo}</span>
        <span className="adr-avanzado-n">{cantidad} {cantidad === 1 ? "campo" : "campos"}</span>
        <ChevronDown size={17} strokeWidth={2} className="adr-avanzado-flecha" aria-hidden="true" />
      </summary>
      <div className="adr-avanzado-cuerpo">{children}</div>
    </details>
  );
}
