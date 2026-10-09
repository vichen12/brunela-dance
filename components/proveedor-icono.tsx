import { Link2 } from "lucide-react";
import type { Proveedor } from "@/src/features/studio/enlace-clase";

/**
 * Icono del proveedor del enlace (Zoom, Meet u otro), en un solo color.
 *
 * Monocromo a proposito: los logos oficiales traen azul, verde y amarillo, y
 * el sistema es coral y crema. La FORMA ya alcanza para reconocerlos: la
 * camara con el triangulo de Zoom y la camara de esquina cortada de Meet.
 *
 * Sin "use client" y sin estado: se puede renderizar desde un server component
 * o desde uno de cliente. Lo que cruza la frontera es la CADENA del proveedor,
 * nunca este componente (trampa 6).
 */
export function ProveedorIcono({ proveedor, size = 18 }: { proveedor: Proveedor; size?: number }) {
  if (proveedor === "zoom") {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="2" y="6.5" width="13" height="11" rx="3" fill="currentColor" />
        <path d="M16.5 10.6 21 7.8v8.4l-4.5-2.8z" fill="currentColor" />
      </svg>
    );
  }
  if (proveedor === "meet") {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M6.5 6.5H14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H4.5a2 2 0 0 1-2-2v-5z" fill="currentColor" />
        <path d="M2.5 10.5h4v-4z" fill="currentColor" opacity=".45" />
        <path d="M17 10.3 21.5 7v10L17 13.7z" fill="currentColor" />
      </svg>
    );
  }
  return <Link2 size={size} strokeWidth={2.3} aria-hidden="true" />;
}
