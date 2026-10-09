"use client";

import { useEffect } from "react";
import { motion, MotionConfig } from "motion/react";
import { ArrowRight, RotateCcw } from "lucide-react";

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
    <MotionConfig reducedMotion="user">
      <style>{CSS_ERROR}</style>
      <main className="perr">
        <div className="perr-cuerpo">
          {/* Un arco que se dibuja solo: el trazo de un port de bras, no un
              icono de alerta. La pantalla tiene que bajar la tension, no subirla. */}
          <svg className="perr-arco" viewBox="0 0 220 120" aria-hidden="true">
            <motion.path
              d="M10 110 C 40 20, 180 20, 210 110"
              fill="none" stroke="var(--pink)" strokeWidth="1.5" strokeLinecap="round"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 1.6, ease: SUAVE }}
            />
            <motion.circle
              cx="110" cy="43" r="4" fill="var(--pink)"
              initial={{ scale: 0 }} animate={{ scale: 1 }}
              transition={{ delay: 1.1, type: "spring", stiffness: 300, damping: 14 }}
            />
          </svg>

          <motion.p
            className="perr-eyebrow"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2, duration: 0.6 }}
          >
            <span className="perr-raya" />
            {vieja ? "Versión desactualizada" : "Algo se rompió"}
          </motion.p>

          <h1 className="perr-titulo" aria-label={vieja ? "Recargá la página" : "No pudimos cargar esto"}>
            <span className="perr-linea">
              <motion.span
                className="perr-linea-in"
                initial={{ y: "105%" }} animate={{ y: 0 }}
                transition={{ delay: 0.25, duration: 0.9, ease: SUAVE }}
              >
                {vieja ? <>Recargá la <em>página.</em></> : <>No pudimos <em>cargar esto.</em></>}
              </motion.span>
            </span>
          </h1>

          <motion.div
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.7, ease: SUAVE }}
          >
            <p className="perr-texto">
              {vieja ? (
                <>
                  Se publicó una versión nueva mientras tenías esta pestaña abierta,
                  así que lo que estabas viendo ya no coincide con el servidor.{" "}
                  <strong>No se perdió nada y no hay nada roto</strong>: recargando
                  se soluciona.
                </>
              ) : (
                <>
                  Fue un error nuestro, no algo que hayas hecho mal. Probá de nuevo;
                  si vuelve a pasar, avisale a Vincenzo con el detalle de abajo.
                </>
              )}
            </p>

            <div className="perr-acciones">
              <button
                type="button"
                className="perr-btn perr-btn--lleno"
                onClick={() => (vieja ? window.location.reload() : reset())}
              >
                <RotateCcw size={15} strokeWidth={2.2} aria-hidden="true" />
                {vieja ? "Recargar" : "Reintentar"}
              </button>
              <a href={volverA} className="perr-btn">
                {ambito === "panel" ? "Ir al panel" : "Ir al estudio"}
                <ArrowRight size={15} strokeWidth={2.2} aria-hidden="true" />
              </a>
            </div>

            {/* El detalle tecnico, plegado. Es lo que hay que copiarle a
                Vincenzo, y en produccion `digest` es lo unico que permite
                encontrar el error en los registros del servidor. */}
            {!vieja && (
              <details className="perr-detalle">
                <summary>Detalle técnico</summary>
                <pre>
                  {error.name}: {error.message}
                  {error.digest ? `\ndigest: ${error.digest}` : ""}
                </pre>
              </details>
            )}
          </motion.div>
        </div>
      </main>
    </MotionConfig>
  );
}

const SUAVE = [0.16, 1, 0.3, 1] as const;

const CSS_ERROR = `
.perr {
  min-height: 100vh; display: flex; align-items: center; justify-content: center;
  padding: 48px clamp(16px, 4vw, 48px); background: #fff;
}
.perr-cuerpo { width: 100%; max-width: 640px; text-align: center; }
.perr-arco { width: 180px; height: auto; margin: 0 auto 22px; display: block; overflow: visible; }
.perr-eyebrow {
  display: inline-flex; align-items: center; gap: 12px; margin-bottom: 16px;
  font-size: 11px; font-weight: 700; letter-spacing: 0.2em; text-transform: uppercase; color: var(--pink-deep);
}
.perr-raya { display: inline-block; width: 28px; height: 1.5px; background: var(--pink); }
.perr-titulo {
  font-family: var(--font-display), sans-serif; font-weight: 800;
  font-size: clamp(32px, 4.4vw, 54px); line-height: 1.05; letter-spacing: -0.04em; color: var(--ink);
}
.perr-titulo em { font-style: normal; color: var(--pink-mid); }
.perr-linea { display: block; overflow: hidden; padding-bottom: 0.1em; }
.perr-linea-in { display: block; }
.perr-texto { margin: 18px auto 0; max-width: 46ch; font-size: 15px; line-height: 1.7; color: #57534e; }
.perr-acciones { display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; margin-top: 28px; }
.perr-btn {
  display: inline-flex; align-items: center; gap: 8px; height: 46px; padding: 0 22px;
  border-radius: 99px; border: 1.5px solid #d6d3d1; background: #fff; color: var(--ink);
  font: inherit; font-size: 13.5px; font-weight: 700; text-decoration: none; cursor: pointer;
  transition: border-color .2s, background .2s, transform .2s;
}
.perr-btn:hover { border-color: var(--ink); transform: translateY(-1px); }
.perr-btn--lleno { background: var(--pink); border-color: var(--pink); color: #fff; box-shadow: 0 8px 22px -10px rgba(230,79,85,0.7); }
.perr-btn--lleno:hover { background: var(--pink-mid); border-color: var(--pink-mid); }
.perr-btn:focus-visible { outline: 2px solid var(--pink); outline-offset: 3px; }
.perr-detalle { margin-top: 30px; text-align: left; border-top: 1px solid #f0eeec; padding-top: 14px; }
.perr-detalle summary {
  cursor: pointer; text-align: center; list-style: none;
  font-size: 11px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: #a8a29e;
}
.perr-detalle summary::-webkit-details-marker { display: none; }
.perr-detalle summary:hover { color: var(--pink-deep); }
.perr-detalle pre {
  margin-top: 12px; padding: 12px 14px; border-radius: 12px; background: #fafaf9; border: 1px solid #f0eeec;
  font-size: 11.5px; line-height: 1.5; color: #57534e; white-space: pre-wrap; word-break: break-word;
}
`;
