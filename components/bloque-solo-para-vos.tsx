import { Lock } from "lucide-react";

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
        marginTop: 20,
        borderRadius: 24,
        border: "1px solid #F3E3DC",
        background: "linear-gradient(150deg, #FFF4EE 0%, #FFFAF6 60%, #fff 100%)",
        padding: "18px 20px 20px",
      }}
    >
      <header style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <span
          aria-hidden="true"
          style={{
            width: 38, height: 38, borderRadius: 13, flexShrink: 0,
            display: "grid", placeItems: "center",
            background: "#FFE2D3", color: "#C25E3A",
          }}
        >
          <Lock size={17} strokeWidth={2.2} />
        </span>
        <span style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
          <span style={{ fontSize: 15, fontWeight: 900, color: "#3B2A2C", letterSpacing: "-0.01em" }}>
            Solo para vos
          </span>
          <span style={{ fontSize: 12.5, color: "#8A6F68", lineHeight: 1.5 }}>
            Nada de esto se muestra en la ficha de la clase.
          </span>
        </span>
      </header>
      {children}
    </section>
  );
}
