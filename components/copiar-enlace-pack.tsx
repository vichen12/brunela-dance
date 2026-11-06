"use client";

import { useState } from "react";
import { Check, Link2 } from "lucide-react";

/** Copia el enlace publico del pack, el que se pega en una historia de Instagram. */
export function CopiarEnlacePack({ slug }: { slug: string }) {
  const [estado, setEstado] = useState<"" | "copiado" | "error">("");
  async function copiar() {
    const enlace = `${window.location.origin}/packs/${slug}`;
    try {
      await navigator.clipboard.writeText(enlace);
      setEstado("copiado");
      window.setTimeout(() => setEstado(""), 2200);
    } catch {
      setEstado("error");
    }
  }
  return (
    <>
      <button type="button" className="ad-btn" onClick={copiar}>
        {estado === "copiado"
          ? <><Check size={14} strokeWidth={2.6} aria-hidden="true" /> Enlace copiado</>
          : <><Link2 size={14} strokeWidth={2.2} aria-hidden="true" /> Copiar enlace</>}
      </button>
      {/* Sin permiso de portapapeles: que igual lo pueda copiar a mano. */}
      {estado === "error" && <small>bruneladance.com/packs/{slug}</small>}
    </>
  );
}
