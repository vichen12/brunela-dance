"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Clock } from "lucide-react";
import { CSS_POPOVER, PopoverFlotante } from "@/components/popover-flotante";
import { CSS_CAMPO } from "@/components/campo-fecha";

/**
 * Elegir una HORA con la cara del estudio, en vez de las columnas azules de
 * Chrome (pedido 2026-11-09). Dos grillas: la hora y los minutos de 5 en 5.
 *
 * Con `name` manda "HH:MM" en un <input> invisible (respeta `required`); sin
 * `name` lo lee quien lo usa con `onCambio`.
 */

const HORAS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTOS = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, "0"));
const esHora = (v: string) => /^\d{2}:\d{2}$/.test(v);

export function CampoHora({
  name, defaultValue = "", required, etiqueta = "Hora", onCambio, placeholder = "Elegí la hora",
}: {
  name?: string;
  /** "HH:MM" */
  defaultValue?: string;
  required?: boolean;
  etiqueta?: string;
  onCambio?: (valor: string) => void;
  placeholder?: string;
}) {
  const [valor, setValor] = useState(esHora(defaultValue) ? defaultValue : "");
  const [abierto, setAbierto] = useState(false);
  const caja = useRef<HTMLDivElement>(null);
  const boton = useRef<HTMLButtonElement>(null);
  const cerrar = useCallback(() => setAbierto(false), []);
  const [hh, mm] = valor ? valor.split(":") : ["", ""];

  useEffect(() => { if (esHora(defaultValue)) setValor(defaultValue); }, [defaultValue]);

  useEffect(() => {
    const form = caja.current?.closest("form");
    if (!form) return;
    const reset = () => { const v = esHora(defaultValue) ? defaultValue : ""; setValor(v); onCambio?.(v); };
    form.addEventListener("reset", reset);
    return () => form.removeEventListener("reset", reset);
  }, [defaultValue, onCambio]);

  function poner(h: string, m: string, cerrarDespues: boolean) {
    const v = `${h}:${m}`;
    setValor(v);
    onCambio?.(v);
    if (cerrarDespues) { setAbierto(false); boton.current?.focus(); }
  }

  return (
    <div className="ch" ref={caja}>
      <style>{CSS + CSS_POPOVER}</style>
      <button
        ref={boton}
        type="button"
        className={"cf-campo" + (abierto ? " esta-abierto" : "") + (valor ? "" : " vacio")}
        aria-haspopup="dialog"
        aria-expanded={abierto}
        aria-label={`${etiqueta}: ${valor || "sin elegir"}`}
        onClick={() => setAbierto((a) => !a)}
      >
        <Clock size={17} strokeWidth={2.2} aria-hidden="true" className="cf-ico" />
        <span>{valor || placeholder}</span>
      </button>
      {name && (
        <input
          className="cf-valor"
          name={name}
          value={valor}
          required={required}
          onChange={() => {}}
          tabIndex={-1}
          aria-hidden="true"
          onFocus={() => { boton.current?.focus(); setAbierto(true); }}
        />
      )}

      <PopoverFlotante ancla={boton} abierto={abierto} onCerrar={cerrar} ancho={300} etiqueta={`Elegí la ${etiqueta.toLowerCase()}`}>
        <p className="ch-etq">Hora</p>
        <div className="ch-grilla ch-grilla--horas">
          {HORAS.map((h) => (
            <button key={h} type="button" className={"ch-op" + (h === hh ? " es-elegida" : "")} aria-pressed={h === hh}
              onClick={() => poner(h, mm || "00", false)}>{h}</button>
          ))}
        </div>
        <p className="ch-etq">Minutos</p>
        <div className="ch-grilla">
          {MINUTOS.map((m) => (
            <button key={m} type="button" className={"ch-op" + (m === mm ? " es-elegida" : "")} aria-pressed={m === mm}
              onClick={() => poner(hh || "19", m, true)}>:{m}</button>
          ))}
        </div>
      </PopoverFlotante>
    </div>
  );
}

const CSS = CSS_CAMPO + `
.ch { position: relative; min-width: 0; }
.ch-etq { margin: 2px 0 6px; font-size: 11.5px; font-weight: 800; letter-spacing: .04em; text-transform: uppercase; color: var(--muted, #8A6F68); }
.ch-etq + .ch-grilla + .ch-etq { margin-top: 12px; }
.ch-grilla { display: grid; grid-template-columns: repeat(6, 1fr); gap: 4px; }
.ch-op { min-height: 36px; border: 0; border-radius: 10px; background: var(--crema, #FFFAF6); font: inherit; font-size: 13.5px; font-weight: 700; color: var(--ink, #3B2A2C); cursor: pointer; transition: background .15s, color .15s; }
.ch-op:hover { background: var(--rubor, #FFF2EE); color: var(--pink-deep, #B03A3E); }
.ch-op.es-elegida { background: var(--pink, #E64F55); color: #fff; }
`;
