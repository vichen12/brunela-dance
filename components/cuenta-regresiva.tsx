"use client";

import { useEffect, useState } from "react";

type Resto = { dias: number; horas: number; minutos: number; segundos: number };

function calcular(objetivo: number): Resto {
  const falta = Math.max(0, objetivo - Date.now());
  const s = Math.floor(falta / 1000);
  return {
    dias: Math.floor(s / 86400),
    horas: Math.floor((s % 86400) / 3600),
    minutos: Math.floor((s % 3600) / 60),
    segundos: s % 60,
  };
}

/**
 * La cuenta regresiva hasta la apertura.
 *
 * POR QUE NO SON CUATRO TARJETAS
 *   Lo eran, y ese es el patron por defecto: cuatro recuadros iguales con un
 *   numero y una etiqueta. Se ve en cualquier pagina de "proximamente" y no
 *   dice nada de la marca -- cuatro cajas con borde son cuatro cajas con borde.
 *
 *   Aca los numeros van sueltos y grandes, separados por filetes finos, como una
 *   ficha de programa. El peso lo lleva la tipografia, que es lo que la marca ya
 *   usa en la portada, y no un contenedor.
 *
 * ⚠️ EL PRIMER RENDER NO MUESTRA NUMEROS, Y ES A PROPOSITO.
 *
 *    El servidor y el navegador no comparten reloj: si el servidor pinta
 *    "58 dias 03:12:44" y el navegador calcula un segundo distinto, React tira
 *    un error de hidratacion y la pantalla parpadea. Por eso el estado arranca
 *    en null y los numeros aparecen recien en el efecto, ya del lado del
 *    cliente. Mientras tanto van guiones en las mismas cajas, asi que no hay
 *    salto de maquetado cuando entran.
 */
export function CuentaRegresiva({ objetivoISO }: { objetivoISO: string }) {
  const objetivo = new Date(objetivoISO).getTime();
  const [resto, setResto] = useState<Resto | null>(null);

  useEffect(() => {
    setResto(calcular(objetivo));
    const id = setInterval(() => setResto(calcular(objetivo)), 1000);
    return () => clearInterval(id);
  }, [objetivo]);

  const bloques: { valor: number | null; etiqueta: string }[] = [
    { valor: resto?.dias ?? null, etiqueta: "días" },
    { valor: resto?.horas ?? null, etiqueta: "horas" },
    { valor: resto?.minutos ?? null, etiqueta: "min" },
    { valor: resto?.segundos ?? null, etiqueta: "seg" },
  ];

  const llego =
    resto !== null &&
    resto.dias === 0 &&
    resto.horas === 0 &&
    resto.minutos === 0 &&
    resto.segundos === 0;

  return (
    <div className="cr">
      {/*
        role="timer" con aria-live="off": un lector de pantalla no tiene que
        anunciar cada segundo, seria insoportable. La fecha de apertura, que es
        el dato que importa, ya se lee en el titular de al lado.
      */}
      <div className="cr-fila" role="timer" aria-live="off">
        {bloques.map((b, i) => (
          <div className="cr-b" key={b.etiqueta} data-primero={i === 0 ? "si" : undefined}>
            <span className="cr-n">
              {b.valor === null ? "––" : String(b.valor).padStart(2, "0")}
            </span>
            <span className="cr-l">{b.etiqueta}</span>
          </div>
        ))}
      </div>

      {llego && <p className="cr-llego">Ya es el día. Estamos con los últimos detalles.</p>}

      <style>{`
        .cr { margin-top: 1.9rem; }

        .cr-fila {
          display: flex;
          align-items: flex-start;
          gap: clamp(0.85rem, 2.4vw, 1.6rem);
        }

        .cr-b {
          position: relative;
          display: flex;
          flex-direction: column;
          gap: 0.28rem;
          padding-left: clamp(0.85rem, 2.4vw, 1.6rem);
        }

        /* El filete separador va como borde del bloque, no como un elemento
           aparte: asi no hay nodos vacios en el arbol de accesibilidad. El
           primero no lleva, para que la fila arranque alineada con el texto de
           arriba y no desplazada. */
        .cr-b::before {
          content: "";
          position: absolute;
          left: 0;
          top: 0.32rem;
          bottom: 0.9rem;
          width: 1px;
          background: var(--pink-line, #F2C6C6);
        }

        .cr-b[data-primero="si"] { padding-left: 0; }
        .cr-b[data-primero="si"]::before { display: none; }

        .cr-n {
          font-family: var(--font-display), sans-serif;
          font-size: clamp(2.1rem, 5.2vw, 3.1rem);
          font-weight: 900;
          line-height: 0.92;
          letter-spacing: -0.045em;
          color: var(--ink, #1c1917);
          /* Tabular: sin esto los numeros cambian de ancho cada segundo y toda
             la fila tiembla. */
          font-variant-numeric: tabular-nums;
        }

        .cr-l {
          font-family: var(--font-body), sans-serif;
          font-size: 0.6rem;
          font-weight: 700;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          /* --pink-deep y no --pink: es texto chico, y --pink sobre blanco da
             3.78:1, por debajo del 4.5:1 que pide AA. Es la regla que ya esta
             escrita en CLAUDE.md. */
          color: var(--pink-deep, #B03A3E);
        }

        .cr-llego {
          margin: 1rem 0 0;
          font-size: 0.85rem;
          font-weight: 700;
          color: var(--pink-deep, #B03A3E);
        }

        @media (max-width: 380px) {
          .cr-fila { gap: 0.6rem; }
          .cr-b { padding-left: 0.6rem; }
          .cr-l { font-size: 0.55rem; letter-spacing: 0.1em; }
        }
      `}</style>
    </div>
  );
}
