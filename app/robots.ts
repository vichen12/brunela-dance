import type { MetadataRoute } from "next";

/**
 * bruneladance.com/robots.txt (2026-11-09): que los buscadores recorran lo
 * publico y no el estudio, el panel, el ingreso ni la API, y donde esta el mapa.
 *
 * ⚠️ Esto NO protege nada: es un pedido de cortesia a los buscadores. Lo privado
 *    lo protege la sesion y la base, como siempre.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/dashboard", "/admin", "/api/", "/auth/", "/sign-in", "/registro", "/proximamente", "/baja"],
    },
    sitemap: "https://bruneladance.com/sitemap.xml",
    host: "https://bruneladance.com",
  };
}
