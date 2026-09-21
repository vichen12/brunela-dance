/**
 * El recuadro que separa los campos internos de los que ve la alumna.
 *
 * POR QUE EXISTE
 *   Los campos 1 a 9 del formulario (titulo, descripcion, tipo, categoria,
 *   nivel, duracion, materiales) terminan en la ficha de la clase. Los tres
 *   ultimos -- que planes la ven, si esta publicada y a que plan de trabajo
 *   pertenece -- son decisiones de Brunela que nadie mas tiene que leer.
 *
 *   Estan en el mismo formulario porque se deciden al mismo tiempo, pero
 *   mezclados en la misma grilla se leen como un dato mas de la clase. El
 *   recuadro dice de un vistazo cual es cual, sin obligar a recordarlo.
 *
 * No es control de acceso: es de un formulario que solo abre una admin. Lo que
 * impide que alguien mas escriba estos campos es `requireAdmin()` en la accion,
 * no este borde.
 */

export function BloqueSoloParaVos({ children }: { children: React.ReactNode }) {
  return (
    <section
      style={{
        marginTop: 18,
        borderRadius: 14,
        border: "1px solid #e7e5e4",
        background: "#fafaf9",
        padding: "16px 18px",
      }}
    >
      <header style={{ display: "flex", alignItems: "baseline", gap: 9, flexWrap: "wrap", marginBottom: 14 }}>
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.09em",
            textTransform: "uppercase",
            color: "#44403c",
          }}
        >
          Solo para vos
        </span>
        <span style={{ fontSize: 11, color: "#a8a29e", lineHeight: 1.6 }}>
          Nada de esto se muestra en la ficha de la clase.
        </span>
      </header>
      {children}
    </section>
  );
}
