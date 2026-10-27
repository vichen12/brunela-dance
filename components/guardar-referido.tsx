"use client";

import { useEffect } from "react";
import { COOKIE_REFERIDO, DIAS_COOKIE_REFERIDO, normalizarCodigo } from "@/src/features/referidos/reglas";

/**
 * Quien llega con un enlace de invitacion (bruneladance.com/?ref=ana4821)
 * queda con el codigo guardado en una cookie por 30 dias. Al registrarse, el
 * onboarding la lee y la anota como referida (src/features/referidos/servidor.ts).
 *
 * Va en el layout raiz: el enlace puede apuntar a cualquier pagina publica.
 * No pisa un codigo anterior: cuenta la primera amiga que la invito.
 */
export function GuardarReferido() {
  useEffect(() => {
    try {
      const codigo = normalizarCodigo(new URLSearchParams(window.location.search).get("ref"));
      if (!codigo) return;
      if (document.cookie.split("; ").some((c) => c.startsWith(COOKIE_REFERIDO + "="))) return;
      document.cookie = `${COOKIE_REFERIDO}=${codigo}; Max-Age=${DIAS_COOKIE_REFERIDO * 86400}; Path=/; SameSite=Lax`;
    } catch {
      // Sin cookies (modo privado estricto): simplemente no cuenta.
    }
  }, []);
  return null;
}
