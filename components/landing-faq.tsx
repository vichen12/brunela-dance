"use client";

import { T } from "@/components/language-provider";
import type { PreguntaFrecuente } from "@/src/lib/portada";

/**
 * El FAQ de la portada.
 *
 * 🔴 SI NO HAY PREGUNTAS, LA SECCIÓN NO EXISTE.
 *
 *    Devuelve null en vez de renderizar un acordeón vacío o un "próximamente".
 *    Es el único bloque de la portada que nace sin contenido de respaldo -- los
 *    demás textos vienen del diccionario compilado -- así que es el único que
 *    puede quedar en cero. Una landing sin FAQ sigue vendiendo; una con un
 *    acordeón vacío parece rota, y la ve gente que todavía no es clienta.
 *
 * POR QUE <details> Y NO UN ACORDEÓN PROPIO
 *    Es un acordeón nativo: abre y cierra sin una línea de JavaScript, el
 *    teclado ya lo maneja, los lectores de pantalla ya lo anuncian como
 *    desplegable, y el buscador del navegador (Ctrl+F) encuentra el texto de
 *    adentro aunque esté cerrado. Un acordeón hecho a mano pierde las cuatro
 *    cosas y hay que devolverlas con `aria-expanded`, `aria-controls` y manejo
 *    de foco.
 *
 * ⚠️ EL TEXTO VIENE EN ESPAÑOL EN LOS CUATRO IDIOMAS, Y ES DELIBERADO.
 *    Brunela lo carga una vez. La alternativa era pedirle cuatro versiones de
 *    cada pregunta, y entonces no carga ninguna: un FAQ vacío en cuatro idiomas
 *    es peor que uno en español en tres de ellos.
 *
 *    El título y la bajada SÍ se traducen, porque esos los escribimos nosotros
 *    una sola vez. Y por eso este componente es de CLIENTE: el idioma se
 *    resuelve en el navegador (localStorage + navigator.language), así que el
 *    servidor no sabe en cuál está la visitante y no puede mandar el texto ya
 *    elegido. Las preguntas sí llegan como props, desde la base.
 */
export function LandingFaq({ preguntas }: { preguntas: PreguntaFrecuente[] }) {
  if (preguntas.length === 0) return null;

  return (
    <section id="faq" className="landing-section faq-section" aria-labelledby="faq-titulo">
      <div className="faq-shell">
        <header className="faq-head">
          <h2 className="faq-title" id="faq-titulo">
            <T id="faq.title" />
          </h2>
          <p className="faq-lead">
            <T id="faq.lead" />
          </p>
        </header>

        <div className="faq-lista">
          {preguntas.map((p) => (
            <details className="faq-item" key={p.id}>
              <summary className="faq-pregunta">
                <span>{p.pregunta}</span>
                {/*
                  El signo es decorativo: lo que anuncia abierto/cerrado es el
                  propio <details>. Con aria-hidden un lector de pantalla no lee
                  "más" ni "menos" encima de lo que ya dijo.
                */}
                <span className="faq-signo" aria-hidden />
              </summary>
              <div className="faq-respuesta">
                {/*
                  Los saltos de línea se respetan por CSS (white-space: pre-line)
                  y no partiendo el texto en <p>. El contenido viene de un
                  textarea: si alguien escribe tres párrafos, se ven tres
                  párrafos, y nada de lo que escriba puede inyectar marcado.
                */}
                {p.respuesta}
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
