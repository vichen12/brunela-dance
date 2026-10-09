"use client";

import { useState } from "react";
import { Loader2, ShoppingBag } from "lucide-react";

/**
 * Boton de compra de un pack. Manda SOLO el slug: el precio lo resuelve el
 * servidor contra la base (/api/stripe/checkout-pack), asi que no se puede
 * pagar un precio por otro.
 */
export function ComprarPack({ slug, etiqueta }: { slug: string; etiqueta: string }) {
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function comprar() {
    setError(null);
    setCargando(true);
    try {
      const res = await fetch("/api/stripe/checkout-pack", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pack: slug }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.url) throw new Error(data.error ?? "No pudimos iniciar el pago.");
      window.location.href = data.url;
    } catch (e) {
      setError(e instanceof Error && e.message !== "Failed to fetch" ? e.message : "No pudimos iniciar el pago. Probá de nuevo.");
      setCargando(false);
    }
  }

  return (
    <div className="cpk">
      <button type="button" className="cpk-btn" onClick={comprar} disabled={cargando}>
        {cargando ? <Loader2 size={18} className="cpk-gira" aria-hidden="true" /> : <ShoppingBag size={18} strokeWidth={2.2} aria-hidden="true" />}
        {cargando ? "Abriendo el pago…" : etiqueta}
      </button>
      {error && <p className="cpk-error" role="alert">{error}</p>}
    </div>
  );
}
