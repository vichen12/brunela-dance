"use client";

import { useEffect } from "react";

/**
 * El movimiento de la portada: entradas al hacer scroll y un parallax liviano.
 *
 * POR QUE ESTO Y NO framer-motion
 *   La portada es de servidor y casi todo su contenido tambien. Envolver cada
 *   bloque en un <motion.div> obligaria a convertir secciones enteras en
 *   componentes de cliente. Aca alcanza con marcar el HTML con atributos y que
 *   un unico componente invisible los observe: cero JSX que cruce la frontera
 *   (trampa 6) y unos cientos de bytes en vez de una libreria.
 *
 *   - `data-lp-revelar`: aparece con un fundido que sube cuando entra en
 *     pantalla. Opcional `data-lp-retraso="120"` (ms).
 *   - `data-lp-parallax="0.08"`: se desplaza esa fraccion de lo que se movio la
 *     pagina, relativo al centro de la pantalla. Usa la propiedad `translate`,
 *     no `transform`, para no pisar el zoom del hover.
 *
 * ⚠️ EL CONTENIDO SE OCULTA SOLO SI ESTE SCRIPT CORRE.
 *    El CSS esconde los bloques unicamente bajo `html.lp-js`, clase que pone
 *    este componente al montarse. Sin JavaScript, o si algo falla antes, todo
 *    queda visible. Una animacion que "revela" contenido no puede ser la
 *    condicion para que el contenido exista.
 *
 * Con prefers-reduced-motion no hay parallax y las entradas son instantaneas
 * (ver landing.css).
 */
export function LandingMovimiento() {
  useEffect(() => {
    const raiz = document.documentElement;
    raiz.classList.add("lp-js");

    const quieto = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // ── Entradas ────────────────────────────────────────────────────────
    const bloques = Array.from(document.querySelectorAll<HTMLElement>("[data-lp-revelar]"));
    let obs: IntersectionObserver | null = null;

    if (quieto || typeof IntersectionObserver === "undefined") {
      bloques.forEach((b) => b.setAttribute("data-lp-visto", ""));
    } else {
      obs = new IntersectionObserver(
        (entradas) => {
          for (const e of entradas) {
            if (!e.isIntersecting) continue;
            const el = e.target as HTMLElement;
            const retraso = Number(el.dataset.lpRetraso ?? 0);
            if (retraso) el.style.transitionDelay = `${retraso}ms`;
            el.setAttribute("data-lp-visto", "");
            obs?.unobserve(el);
          }
        },
        { rootMargin: "0px 0px -8% 0px", threshold: 0.08 }
      );
      bloques.forEach((b) => obs?.observe(b));
    }

    // ── Parallax ────────────────────────────────────────────────────────
    const capas = quieto ? [] : Array.from(document.querySelectorAll<HTMLElement>("[data-lp-parallax]"));
    let cuadro = 0;

    function mover() {
      cuadro = 0;
      const alto = window.innerHeight;
      for (const c of capas) {
        const r = c.getBoundingClientRect();
        // Fuera de pantalla no se toca: ahorra trabajo de composicion.
        if (r.bottom < -200 || r.top > alto + 200) continue;
        const factor = Number(c.dataset.lpParallax ?? 0.06);
        const desvio = (r.top + r.height / 2 - alto / 2) * -factor;
        c.style.translate = `0 ${desvio.toFixed(1)}px`;
      }
    }

    function alDesplazar() {
      if (!cuadro) cuadro = requestAnimationFrame(mover);
    }

    if (capas.length) {
      mover();
      window.addEventListener("scroll", alDesplazar, { passive: true });
      window.addEventListener("resize", alDesplazar);
    }

    return () => {
      obs?.disconnect();
      window.removeEventListener("scroll", alDesplazar);
      window.removeEventListener("resize", alDesplazar);
      if (cuadro) cancelAnimationFrame(cuadro);
      raiz.classList.remove("lp-js");
    };
  }, []);

  return null;
}
