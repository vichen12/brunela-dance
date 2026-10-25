"use client";

import Image, { type ImageProps } from "next/image";
import { Fragment, useEffect, useRef, useState } from "react";
import { usePublicI18n } from "@/components/language-provider";
import type { PublicMessageKey } from "@/src/i18n/public";

/**
 * Las piezas de cliente del portfolio. Todas reciben CADENAS desde la pagina
 * (claves de traduccion, valores): por la frontera servidor -> cliente no puede
 * viajar un icono ni una funcion (trampa 6 de CLAUDE.md). Los iconos se
 * renderizan del lado del servidor, en app/portfolio/page.tsx.
 */

function sinMovimiento() {
  return typeof window === "undefined" || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Texto traducido con partes en negrita. `T` solo devuelve texto plano, asi que
 * las negritas van marcadas en el diccionario como **asi** y se parten aca.
 * Cada idioma decide donde caen: el orden de las palabras no es el mismo.
 */
export function TRico({ id }: { id: PublicMessageKey }) {
  const { t } = usePublicI18n();
  const partes = t(id).split("**");
  return (
    <>
      {partes.map((p, i) => (i % 2 ? <strong key={i}>{p}</strong> : <Fragment key={i}>{p}</Fragment>))}
    </>
  );
}

/** next/image con el alt traducido. */
export function ImagenT({ altId, ...props }: Omit<ImageProps, "alt"> & { altId?: PublicMessageKey }) {
  const { t } = usePublicI18n();
  return <Image {...props} alt={altId ? t(altId) : ""} />;
}

/**
 * Cifra que cuenta al entrar en pantalla. El servidor pinta el valor final: sin
 * JavaScript, o con movimiento reducido, se ve el numero correcto y nada mas.
 * Solo anima la parte numerica inicial ("15+" cuenta hasta 15 y deja el "+");
 * lo que no empieza con un numero ("RAD") se muestra tal cual.
 */
export function Contador({ valor }: { valor: string }) {
  const [texto, setTexto] = useState(valor);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const m = /^(\d+)(.*)$/.exec(valor);
    if (!m || sinMovimiento() || typeof IntersectionObserver === "undefined") return;
    const final = Number(m[1]);
    const sufijo = m[2];
    // Un anio que cuenta desde 0 se lee raro: arranca unas decadas antes.
    const desde = final >= 1000 ? final - 24 : 0;
    setTexto(`${desde}${sufijo}`);

    let cuadro = 0;
    const obs = new IntersectionObserver(
      ([e]) => {
        if (!e?.isIntersecting) return;
        obs.disconnect();
        const inicio = performance.now();
        const dura = 1600;
        const paso = (ahora: number) => {
          const x = Math.min(1, (ahora - inicio) / dura);
          const suave = 1 - Math.pow(1 - x, 3);
          setTexto(`${Math.round(desde + (final - desde) * suave)}${sufijo}`);
          if (x < 1) cuadro = requestAnimationFrame(paso);
        };
        cuadro = requestAnimationFrame(paso);
      },
      { threshold: 0.4 }
    );
    if (ref.current) obs.observe(ref.current);
    return () => {
      obs.disconnect();
      if (cuadro) cancelAnimationFrame(cuadro);
    };
  }, [valor]);

  return <span ref={ref}>{texto}</span>;
}

/**
 * La linea vertical que une los capitulos de "Mi historia" y se va llenando
 * con el scroll. Se monta dentro del <ol> y mide a su padre.
 */
export function LineaDeTiempo() {
  const relleno = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = relleno.current;
    const lista = el?.parentElement?.parentElement;
    if (!el || !lista) return;
    if (sinMovimiento()) {
      el.style.transform = "scaleY(1)";
      return;
    }
    let cuadro = 0;
    const medir = () => {
      cuadro = 0;
      const r = lista.getBoundingClientRect();
      const punto = window.innerHeight * 0.62;
      const avance = Math.max(0, Math.min(1, (punto - r.top) / r.height));
      el.style.transform = `scaleY(${avance.toFixed(4)})`;
    };
    const pedir = () => {
      if (!cuadro) cuadro = requestAnimationFrame(medir);
    };
    medir();
    window.addEventListener("scroll", pedir, { passive: true });
    window.addEventListener("resize", pedir);
    return () => {
      window.removeEventListener("scroll", pedir);
      window.removeEventListener("resize", pedir);
      if (cuadro) cancelAnimationFrame(cuadro);
    };
  }, []);

  return (
    <span className="pf-linea" aria-hidden>
      <span ref={relleno} className="pf-linea-relleno" />
    </span>
  );
}
