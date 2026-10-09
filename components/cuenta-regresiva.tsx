"use client";

import { useEffect, useState } from "react";
import { usePublicI18n } from "@/components/language-provider";
import type { PublicLocale } from "@/src/i18n/public";

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
 * POR QUE SON CUATRO PASTILLAS BLANDAS
 *   Antes los numeros iban sueltos, separados por filetes finos, como una ficha
 *   de programa: era la linea editorial del sistema. El rediseño "suave y
 *   calido" (2026-10-08) la reemplazo: cada numero va en una pastilla
 *   redondeada en tonos pastel, con la etiqueta en oracion y no en mayusculas
 *   espaciadas. Los tonos alternan para que no sean cuatro cajas iguales.
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
  const { t } = usePublicI18n();
  const objetivo = new Date(objetivoISO).getTime();
  const [resto, setResto] = useState<Resto | null>(null);

  useEffect(() => {
    setResto(calcular(objetivo));
    const id = setInterval(() => setResto(calcular(objetivo)), 1000);
    return () => clearInterval(id);
  }, [objetivo]);

  const bloques: { valor: number | null; etiqueta: string }[] = [
    { valor: resto?.dias ?? null, etiqueta: t("puerta.days") },
    { valor: resto?.horas ?? null, etiqueta: t("puerta.hours") },
    { valor: resto?.minutos ?? null, etiqueta: t("puerta.min") },
    { valor: resto?.segundos ?? null, etiqueta: t("puerta.sec") },
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
      <div className="cr-fila" role="timer" aria-live="off" aria-label={t("puerta.countdown")}>
        {bloques.map((b, i) => (
          <div className="cr-b" key={i} data-primero={i === 0 ? "si" : undefined}>
            <span className="cr-n">
              {b.valor === null ? "––" : String(b.valor).padStart(2, "0")}
            </span>
            <span className="cr-l">{b.etiqueta}</span>
          </div>
        ))}
      </div>

      {llego && <p className="cr-llego">{t("puerta.arrived")}</p>}

      <style>{`
        .cr { margin-top: 1.9rem; }

        .cr-fila {
          display: flex;
          align-items: stretch;
          gap: clamp(0.5rem, 1.6vw, 0.8rem);
        }

        .cr-b {
          flex: 1 1 0;
          min-width: 0;
          max-width: 6.2rem;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.35rem;
          padding: 0.85rem 0.4rem 0.7rem;
          border-radius: 20px;
          background: linear-gradient(160deg, #FFE9DE 0%, #FFF6F1 100%);
          border: 1px solid rgba(233, 207, 197, 0.6);
        }
        .cr-b:nth-child(2) { background: linear-gradient(160deg, #FFE4E4 0%, #FFF4F3 100%); }
        .cr-b:nth-child(3) { background: linear-gradient(160deg, #F7EBFA 0%, #FCF7FD 100%); }
        .cr-b:nth-child(4) { background: linear-gradient(160deg, #E7F1E4 0%, #F5FAF3 100%); }

        .cr-n {
          font-family: var(--font-display), sans-serif;
          font-size: clamp(1.7rem, 4.4vw, 2.5rem);
          font-weight: 900;
          line-height: 1;
          letter-spacing: -0.03em;
          color: var(--ink, #3B2A2C);
          /* Tabular: sin esto los numeros cambian de ancho cada segundo y toda
             la fila tiembla. */
          font-variant-numeric: tabular-nums;
        }

        .cr-l {
          font-family: var(--font-body), sans-serif;
          font-size: 0.78rem;
          font-weight: 800;
          /* --pink-deep y no --pink: es texto chico, y --pink sobre blanco da
             3.78:1, por debajo del 4.5:1 que pide AA. Es la regla que ya esta
             escrita en CLAUDE.md. */
          color: var(--pink-deep, #B03A3E);
        }

        .cr-llego {
          margin: 1rem 0 0;
          display: inline-block;
          padding: 0.5rem 0.9rem;
          border-radius: 99px;
          background: #FFF2EE;
          font-size: 0.85rem;
          font-weight: 700;
          color: var(--pink-deep, #B03A3E);
        }

        @media (max-width: 380px) {
          .cr-b { border-radius: 16px; padding: 0.7rem 0.2rem 0.6rem; }
          .cr-l { font-size: 0.7rem; }
        }
      `}</style>
    </div>
  );
}

const FORMATO_FECHA: Record<PublicLocale, string> = {
  es: "es-ES",
  en: "en-GB",
  fr: "fr-FR",
  it: "it-IT",
};

/**
 * La fecha de apertura, en el idioma que eligio la visitante ("15 de
 * noviembre", "15 November", "15 novembre"...).
 *
 * Vive en un componente de cliente porque el idioma de la parte publica se
 * decide en el navegador (localStorage). El primer render sale en castellano,
 * igual que en el servidor, asi que no hay error de hidratacion.
 *
 * La zona horaria va fija en Madrid: la apertura es a medianoche de alli, y
 * formatear en la zona de la visitante podria mostrar el dia anterior.
 */
export function FechaDeApertura({ objetivoISO }: { objetivoISO: string }) {
  const { locale } = usePublicI18n();
  const texto = new Intl.DateTimeFormat(FORMATO_FECHA[locale], {
    day: "numeric",
    month: "long",
    timeZone: "Europe/Madrid",
  }).format(new Date(objetivoISO));
  return <>{texto}</>;
}
