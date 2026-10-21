import { Cormorant_Garamond, Nunito } from "next/font/google";

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

/**
 * Titulos del sistema (h1 y h2 dentro de .sistema): Cormorant Garamond, pedida
 * por Brunela el 2026-10-14. Serif clasica de alto contraste, editorial, la de
 * los programas de ballet. Solo titulos: en cuerpo chico su x-height baja se lee
 * peor, asi que el texto sigue en Nunito. Pesos hasta 700 (no hay 800/900): los
 * titulos que pedian 900 caen al 700.
 */
export const fuenteTitulos = Cormorant_Garamond({
  subsets: ["latin"],
  variable: "--font-titulo",
  weight: ["500", "600", "700"],
  style: ["normal", "italic"],
  display: "swap",
});
