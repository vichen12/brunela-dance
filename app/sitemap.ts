import type { MetadataRoute } from "next";
import { leerPacksEnVenta } from "@/src/features/studio/packs-en-venta";

/**
 * El mapa del sitio para Google (bruneladance.com/sitemap.xml), 2026-11-09.
 *
 * Solo lo PUBLICO: la portada, la tienda de packs y cada pack a la venta, el
 * portfolio y lo legal. El estudio, el panel y el ingreso quedan afuera (y
 * robots.ts le pide a los buscadores que no los recorran).
 *
 * Los packs salen de la base: uno nuevo aparece solo, sin tocar nada.
 */
export const revalidate = 3600;

const SITIO = "https://bruneladance.com";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const ahora = new Date();
  const fijas: MetadataRoute.Sitemap = [
    { url: `${SITIO}/`, lastModified: ahora, changeFrequency: "weekly", priority: 1 },
    { url: `${SITIO}/packs`, lastModified: ahora, changeFrequency: "weekly", priority: 0.9 },
    { url: `${SITIO}/portfolio`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITIO}/legal/aviso-legal`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITIO}/legal/privacidad`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITIO}/legal/condiciones`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITIO}/legal/cookies`, changeFrequency: "yearly", priority: 0.2 },
  ];
  const packs = (await leerPacksEnVenta()).map((p) => ({
    url: `${SITIO}/packs/${p.slug}`,
    lastModified: ahora,
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));
  return [...fijas, ...packs];
}
