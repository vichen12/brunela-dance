"use client";

/**
 * La ultima red: se usa cuando revienta el propio layout raiz y ni siquiera hay
 * envoltorio donde dibujar.
 *
 * ⚠️ TIENE QUE TRAER SUS PROPIOS <html> y <body>: reemplaza al layout raiz
 *    entero, asi que no hereda nada. Y por lo mismo NO puede usar las variables
 *    de color del sistema -- van los valores a mano.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="es">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#FDFAF9" }}>
        <main style={{
          minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
          padding: "40px 24px",
        }}>
          <div style={{
            maxWidth: 480, background: "#fff", border: "1.5px solid #F1E9E7",
            borderRadius: 24, padding: "32px 30px",
          }}>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: "#1c1917" }}>
              No pudimos cargar la página
            </h1>
            <p style={{ fontSize: 14.5, lineHeight: 1.65, color: "#57534e", marginTop: 12 }}>
              Probá recargar. Si vuelve a pasar, avisale a Vincenzo con el código
              de abajo: es lo que permite encontrarlo en los registros.
            </p>
            <button
              onClick={reset}
              style={{
                marginTop: 20, background: "#D93438", color: "#fff", border: "none",
                borderRadius: 99, padding: "11px 24px", fontSize: 11.5, fontWeight: 700,
                letterSpacing: "0.08em", cursor: "pointer", fontFamily: "inherit",
              }}
            >REINTENTAR</button>
            {error.digest && (
              <p style={{ marginTop: 16, fontSize: 12, color: "#a8a29e" }}>
                código: {error.digest}
              </p>
            )}
          </div>
        </main>
      </body>
    </html>
  );
}
