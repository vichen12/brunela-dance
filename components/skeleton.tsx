/**
 * Piezas para los esqueletos de carga.
 *
 * No llevan "use client": se renderizan en el servidor mientras la pagina de
 * verdad se arma, que es exactamente para lo que existe loading.tsx.
 *
 * LA REGLA AL USARLAS
 *   El esqueleto tiene que tener la FORMA de la pantalla que viene. Si la
 *   pagina real muestra cuatro tarjetas y una lista, el esqueleto muestra
 *   cuatro bloques y una lista -- no tres, no un spinner. Cuando la forma no
 *   coincide, el contenido "salta" al llegar y se siente peor que no haber
 *   puesto nada.
 *
 * La clase `.sk` y su animacion viven en globals.css.
 */

/** Una barra. `w` acepta numero (px) o cadena ("60%"). */
export function Sk({
  h = 12, w = "100%", r, style,
}: {
  h?: number; w?: number | string; r?: number; style?: React.CSSProperties;
}) {
  return <div className="sk" style={{ height: h, width: w, borderRadius: r, ...style }} />;
}

/** La tarjeta blanca con borde que usa todo el sistema. */
export function SkTarjeta({
  children, style,
}: {
  children?: React.ReactNode; style?: React.CSSProperties;
}) {
  return (
    <div style={{
      background: "#fff", border: "1.5px solid #f0eeec", borderRadius: 20,
      padding: "22px 24px", ...style,
    }}>{children}</div>
  );
}

/** La cabecera `hero-stage`: volanta, titulo grande y bajada. */
export function SkHero({ conBoton = false }: { conBoton?: boolean }) {
  return (
    <header className="hero-stage">
      <div style={{ display: "flex", justifyContent: "space-between", gap: 24, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 280, display: "flex", flexDirection: "column", gap: 12 }}>
          <Sk h={10} w={140} />
          <Sk h={44} w={300} r={14} />
          <Sk h={14} w={420} style={{ maxWidth: "100%" }} />
        </div>
        {conBoton && <Sk h={46} w={190} r={999} style={{ alignSelf: "flex-start" }} />}
      </div>
    </header>
  );
}

/** Fila de numeros grandes. */
export function SkMetricas({ n = 4 }: { n?: number }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fit, minmax(200px, 1fr))`, gap: 14 }}>
      {Array.from({ length: n }, (_, i) => (
        <SkTarjeta key={i}>
          <Sk h={34} w={70} r={10} />
          <Sk h={12} w={110} style={{ marginTop: 12 }} />
          <Sk h={10} w={150} style={{ marginTop: 8 }} />
        </SkTarjeta>
      ))}
    </div>
  );
}

/** Listado de filas, como los de /admin. */
export function SkFilas({ n = 6, alto = 62 }: { n?: number; alto?: number }) {
  return (
    <div style={{ background: "#fff", border: "1.5px solid #f0eeec", borderRadius: 18, overflow: "hidden" }}>
      {Array.from({ length: n }, (_, i) => (
        <div key={i} style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          gap: 16, padding: "0 20px", height: alto,
          borderBottom: i === n - 1 ? "none" : "1px solid #f9f7f6",
        }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 7, flex: 1 }}>
            <Sk h={13} w={`${45 + ((i * 13) % 30)}%`} />
            <Sk h={10} w={`${25 + ((i * 7) % 20)}%`} />
          </div>
          <Sk h={22} w={78} r={99} />
        </div>
      ))}
    </div>
  );
}

/** Rejilla de tarjetas con miniatura. */
export function SkGrid({ n = 6, ratio = "4/3" }: { n?: number; ratio?: string }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 14 }}>
      {Array.from({ length: n }, (_, i) => (
        <div key={i} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Sk style={{ aspectRatio: ratio }} r={18} />
          <Sk h={13} w="70%" />
          <Sk h={10} w="45%" />
        </div>
      ))}
    </div>
  );
}

/** El armazon de una pantalla de chat: barra lateral, mensajes y caja de texto. */
export function SkChat({ conBarra = true }: { conBarra?: boolean }) {
  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
      {conBarra && (
        <div style={{
          width: 240, flexShrink: 0, borderRight: "1px solid var(--pink-soft)",
          padding: 16, display: "flex", flexDirection: "column", gap: 10,
        }}>
          <Sk h={10} w={130} />
          {Array.from({ length: 7 }, (_, i) => (
            <div key={i} style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 4 }}>
              <Sk h={34} w={34} r={10} />
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 5 }}>
                <Sk h={11} w="70%" />
                <Sk h={9} w="40%" />
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <div style={{ padding: "16px 24px", borderBottom: "1px solid var(--pink-soft)", display: "flex", gap: 14, alignItems: "center" }}>
          <Sk h={40} w={40} r={12} />
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <Sk h={13} w={150} />
            <Sk h={10} w={90} />
          </div>
        </div>

        {/* Mensajes alternados, para que se lea como conversacion y no como lista */}
        <div style={{ flex: 1, padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} style={{ display: "flex", justifyContent: i % 2 ? "flex-end" : "flex-start" }}>
              <Sk h={i % 3 === 0 ? 52 : 34} w={`${38 + ((i * 11) % 26)}%`} r={16} />
            </div>
          ))}
        </div>

        <div style={{ padding: "12px 20px", borderTop: "1px solid var(--pink-soft)", display: "flex", gap: 10 }}>
          <Sk h={44} w="100%" r={999} />
          <Sk h={44} w={96} r={999} />
        </div>
      </div>
    </div>
  );
}

/** Formularios de ajustes: bloques con etiquetas y campos. */
export function SkFormulario({ campos = 4 }: { campos?: number }) {
  return (
    <SkTarjeta style={{ display: "grid", gap: 18 }}>
      {Array.from({ length: campos }, (_, i) => (
        <div key={i} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <Sk h={10} w={110} />
          <Sk h={42} w="100%" r={10} />
        </div>
      ))}
      <Sk h={46} w={170} r={999} />
    </SkTarjeta>
  );
}
