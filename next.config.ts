import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typedRoutes: true,

  images: {
    /**
     * Las calidades que el proyecto usa de verdad, declaradas.
     *
     * POR QUE ESTA LISTA EXISTE
     *   Hasta Next 15 cualquier `quality` en un <Image> funcionaba y solo
     *   dejaba un aviso en consola. Desde Next 16 hay que declararlas: una
     *   calidad no declarada deja de servirse. O sea que esto es un aviso hoy y
     *   una foto rota despues de actualizar.
     *
     *   75 es el valor por defecto de Next y lo usa todo lo que no pide otra
     *   cosa. 82 es la foto del metodo, que es un AVIF grande donde la
     *   diferencia con 75 se nota en los degradados de la pared.
     *
     * ⚠️ Si alguien pone un `quality` nuevo en un <Image>, tiene que agregarlo
     *    aca tambien. No da error: simplemente deja de servirse esa variante.
     */
    qualities: [75, 82],
  },
};

export default nextConfig;
