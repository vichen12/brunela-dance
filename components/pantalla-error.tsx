"use client";

import { useEffect } from "react";

/**
 * Lo que se ve cuando algo revienta en el cliente.
 *
 * POR QUE EXISTE
 *   Sin un error.tsx, Next muestra "Application error: a client-side exception
 *   has occurred" y nada mas. Ese texto no le sirve a nadie: no dice que paso,
 *   no dice si reintentar, y en produccion oculta el mensaje real a proposito.
 *   El 2026-08-06 costo dos rondas de diagnostico averiguar que era una version
 *   vieja de la pagina, algo que se arregla recargando.
 *
 * ⚠️ EL CASO QUE MAS VA A PASAR TIENE SU PROPIO TEXTO
 *   Despues de cada despliegue, una pestaña abierta de antes sigue mandando
 *   identificadores de acciones que el servidor nuevo ya no conoce. Next lo
 *   reporta como "Server Action ... was not found on the server". No es una
 *   falla del sistema y se arregla recargando, asi que se dice exactamente eso
 *   en vez de asustar.
 */

/** Reconoce el desfasaje entre una pestaña vieja y un despliegue nuevo. */
function esVersionVieja(error: Error): boolean {
  const t = `${error.name} ${error.message}`;
  return (
    /UnrecognizedActionError/i.test(t) ||
    /Server Action .* was not found/i.test(t) ||
    /Failed to fetch dynamically imported module/i.test(t) ||
    /ChunkLoadError|Loading chunk .* failed/i.test(t)
  );
}

export function PantallaError({
  error,
  reset,
  ambito,
}: {
  error: Error & { digest?: string };
  reset: () => void;
  /** "el panel" o "el estudio": cambia solo el texto de vuelta. */
  ambito: "panel" | "estudio";
}) {
  const vieja = esVersionVieja(error);

  useEffect(() => {
    // A la consola SIEMPRE, aunque en pantalla se muestre algo amable. En
    // produccion Next oculta el mensaje real del servidor, pero este error ya
    // llego al cliente: si no se registra, se pierde.
    console.error("[error]", error.name, error.message, error.digest ?? "");
  }, [error]);

  const volverA = ambito === "panel" ? "/admin" : "/dashboard";

  return (
    <main style={{
      minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center",
      padding: "40px 24px", fontFamily: "inherit",
    }}>
      <div style={{
        maxWidth: 520, width: "100%", background: "#fff",
        border: "1.5px solid var(--pink-line, #F1E9E7)", borderRadius: 24,
        padding: "32px 30px",
      }}>
        <p style={{
          fontSize: 10, fontWeight: 700, letterSpacing: "0.12em",
          color: "var(--muted, #78716c)", textTransform: "uppercase",
        }}>
          {vieja ? "Versión desactualizada" : "Algo se rompió"}
        </p>

        <h1 style={{ fontSize: 24, fontWeight: 800, color: "var(--ink, #1c1917)", marginTop: 8 }}>
          {vieja ? "Recargá la página" : "No pudimos cargar esto"}
        </h1>

        <p style={{ fontSize: 14.5, lineHeight: 1.65, color: "var(--ink-soft, #57534e)", marginTop: 12 }}>
          {vieja ? (
            <>
              Se publicó una versión nueva mientras tenías esta pestaña abierta,
              así que lo que estabas viendo ya no coincide con el servidor.{" "}
              <strong>No se perdió nada y no hay nada roto</strong>: recargando
              se soluciona.
            </>
          ) : (
            <>
              Fue un error nuestro, no algo que hayas hecho mal. Podés reintentar;
              si vuelve a pasar, avisale a Vincenzo con lo que dice abajo.
            </>
          )}
        </p>

        <div style={{ display: "flex", gap: 10, marginTop: 22, flexWrap: "wrap" }}>
          <button
            onClick={() => (vieja ? window.location.reload() : reset())}
            style={{
              background: "var(--pink-mid, #D93438)", color: "#fff", border: "none",
              borderRadius: 99, padding: "11px 24px", fontSize: 11.5, fontWeight: 700,
              letterSpacing: "0.08em", cursor: "pointer", fontFamily: "inherit",
            }}
          >
            {vieja ? "RECARGAR" : "REINTENTAR"}
          </button>
          <a
            href={volverA}
            style={{
              display: "inline-block", textDecoration: "none",
              border: "1px solid var(--pink-line, #F1E9E7)", color: "var(--ink, #1c1917)",
              borderRadius: 99, padding: "11px 22px", fontSize: 11.5, fontWeight: 700,
              letterSpacing: "0.08em",
            }}
          >
            {ambito === "panel" ? "IR AL PANEL" : "IR AL ESTUDIO"}
          </a>
        </div>

        {/* El detalle tecnico, plegado. Es lo que hay que copiarle a Vincenzo, y
            en produccion `digest` es lo unico que permite encontrar el error en
            los registros del servidor. */}
        {!vieja && (
          <details style={{ marginTop: 20 }}>
            <summary style={{
              cursor: "pointer", fontSize: 12, fontWeight: 700,
              color: "var(--muted, #78716c)",
            }}>
              Detalle técnico
            </summary>
            <pre style={{
              marginTop: 10, fontSize: 11.5, lineHeight: 1.5, whiteSpace: "pre-wrap",
              wordBreak: "break-word", background: "#fafaf9",
              border: "1px solid #f0eeec", borderRadius: 10, padding: "10px 12px",
              color: "#57534e",
            }}>
              {error.name}: {error.message}
              {error.digest ? `\ndigest: ${error.digest}` : ""}
            </pre>
          </details>
        )}
      </div>
    </main>
  );
}
