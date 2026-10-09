import { Nunito } from "next/font/google";

/**
 * Tipografia del sistema (panel de alumna y de admin), redisenio "suave y
 * calido" del 2026-10-08.
 *
 * Nunito tiene las terminaciones redondeadas: en titulares gruesos se lee
 * amable, no tecnica, que es lo que pide el registro. Montserrat sigue siendo
 * la de la landing; por eso esta fuente NO se carga en app/layout.tsx sino en
 * los dos layouts del sistema, y se aplica redefiniendo --font-display y
 * --font-body dentro de .sistema (ver globals.css). La landing no se entera.
 */
export const fuenteSistema = Nunito({
  subsets: ["latin"],
  variable: "--font-suave",
  weight: ["400", "500", "600", "700", "800", "900"],
  display: "swap",
});
