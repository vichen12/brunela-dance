"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { CSS_POPOVER, PopoverFlotante } from "@/components/popover-flotante";

/**
 * Elegir un DIA con un calendario de la marca, en vez del de Chrome.
 *
 * POR QUE (2026-11-09)
 *   El calendario nativo de `<input type="date">` no se puede estilizar: sale
 *   gris y azul, con flechas sueltas, en medio de un panel coral. Esto es el
 *   mismo dato con la cara del estudio.
 *
 * COMO VIAJA EL VALOR
 *   Con `name`: un <input> comun (no hidden: un hidden no respeta `required`) e
 *   invisible, con "AAAA-MM-DD". La accion lo recibe exactamente igual que antes.
 *   Sin `name`, lo lee quien lo usa con `onCambio` (HorarioSesion, CampoFechaHora).
 *
 * "Hoy" es el de Madrid, que es donde esta el estudio y en la hora que se
 * agenda: a la medianoche de Argentina ya es otro dia alla.
 */

const ZONA = "Europe/Madrid";
const SEMANA = ["L", "M", "X", "J", "V", "S", "D"];
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

export function hoyEnMadrid(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: ZONA, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function clave(anio: number, mes0: number, dia: number) {
  return `${anio}-${String(mes0 + 1).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

/** "Lunes, 9 de noviembre" */
export function fechaLegible(valor: string) {
  const [a, m, d] = valor.split("-").map(Number);
  const t = new Intl.DateTimeFormat("es-ES", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(a, m - 1, d, 12)));
  return t.charAt(0).toUpperCase() + t.slice(1);
}

const esFecha = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);

export function CampoFecha({
  name, defaultValue = "", required, desdeHoy = false, etiqueta = "Día", onCambio,
}: {
  name?: string;
  /** "AAAA-MM-DD" */
  defaultValue?: string;
  required?: boolean;
  /** Los dias anteriores a hoy no se pueden elegir (agendar algo que ya paso). */
  desdeHoy?: boolean;
  etiqueta?: string;
  onCambio?: (valor: string) => void;
}) {
  const hoy = hoyEnMadrid();
  const [valor, setValor] = useState(esFecha(defaultValue) ? defaultValue : "");
  const [vista, setVista] = useState(() => { const b = valor || hoy; return { anio: Number(b.slice(0, 4)), mes0: Number(b.slice(5, 7)) - 1 }; });
  const [abierto, setAbierto] = useState(false);
  const caja = useRef<HTMLDivElement>(null);
  const boton = useRef<HTMLButtonElement>(null);
  const cerrar = useCallback(() => setAbierto(false), []);

  // form.reset() (tras guardar) tiene que vaciar tambien el estado de React.
  useEffect(() => {
    const form = caja.current?.closest("form");
    if (!form) return;
    const reset = () => { const v = esFecha(defaultValue) ? defaultValue : ""; setValor(v); onCambio?.(v); };
    form.addEventListener("reset", reset);
    return () => form.removeEventListener("reset", reset);
  }, [defaultValue, onCambio]);

  const primerDia = (new Date(Date.UTC(vista.anio, vista.mes0, 1)).getUTCDay() + 6) % 7; // lunes = 0
  const diasDelMes = new Date(Date.UTC(vista.anio, vista.mes0 + 1, 0)).getUTCDate();
  const celdas: (number | null)[] = [...Array.from({ length: primerDia }, () => null), ...Array.from({ length: diasDelMes }, (_, i) => i + 1)];
  while (celdas.length % 7) celdas.push(null);
  const mover = (d: number) => setVista((v) => { const x = new Date(Date.UTC(v.anio, v.mes0 + d, 1)); return { anio: x.getUTCFullYear(), mes0: x.getUTCMonth() }; });
  const esMesDeHoy = vista.anio === Number(hoy.slice(0, 4)) && vista.mes0 === Number(hoy.slice(5, 7)) - 1;

  function elegir(k: string) {
    setValor(k);
    onCambio?.(k);
    setAbierto(false);
    boton.current?.focus();
  }

  return (
    <div className="cf" ref={caja}>
      <style>{CSS + CSS_POPOVER}</style>
      <button
        ref={boton}
        type="button"
        className={"cf-campo" + (abierto ? " esta-abierto" : "") + (valor ? "" : " vacio")}
        aria-haspopup="dialog"
        aria-expanded={abierto}
        aria-label={`${etiqueta}: ${valor ? fechaLegible(valor) : "sin elegir"}`}
        onClick={() => {
          if (!abierto) { const b = valor || hoy; setVista({ anio: Number(b.slice(0, 4)), mes0: Number(b.slice(5, 7)) - 1 }); }
          setAbierto((a) => !a);
        }}
      >
        <CalendarDays size={17} strokeWidth={2.2} aria-hidden="true" className="cf-ico" />
        <span>{valor ? fechaLegible(valor) : "Elegí el día"}</span>
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

      <PopoverFlotante ancla={boton} abierto={abierto} onCerrar={cerrar} etiqueta={`Elegí el ${etiqueta.toLowerCase()}`}>
        <div className="cf-cab">
          <button type="button" className="cf-flecha" onClick={() => mover(-1)} aria-label="Mes anterior" disabled={desdeHoy && esMesDeHoy}>
            <ChevronLeft size={18} strokeWidth={2.4} />
          </button>
          <span className="cf-mes">{MESES[vista.mes0].charAt(0).toUpperCase() + MESES[vista.mes0].slice(1)} {vista.anio}</span>
          <button type="button" className="cf-flecha" onClick={() => mover(1)} aria-label="Mes siguiente">
            <ChevronRight size={18} strokeWidth={2.4} />
          </button>
        </div>
        <div className="cf-grilla" role="grid">
          {SEMANA.map((d) => <span key={d} className="cf-sem" role="columnheader">{d}</span>)}
          {celdas.map((d, i) => {
            if (!d) return <span key={"v" + i} aria-hidden="true" />;
            const k = clave(vista.anio, vista.mes0, d);
            const pasado = k < hoy;
            return (
              <button
                key={k}
                type="button"
                role="gridcell"
                className={"cf-dia" + (k === valor ? " es-elegido" : "") + (k === hoy ? " es-hoy" : "") + (pasado ? " es-pasado" : "")}
                disabled={desdeHoy && pasado}
                aria-pressed={k === valor}
                aria-label={fechaLegible(k)}
                onClick={() => elegir(k)}
              >
                {d}
              </button>
            );
          })}
        </div>
        <div className="cf-pie">
          <button type="button" className="cf-hoy" onClick={() => elegir(hoy)}>Hoy</button>
          {valor && !required && <button type="button" className="cf-borrar" onClick={() => elegir("")}>Borrar</button>}
        </div>
      </PopoverFlotante>
    </div>
  );
}

/** El boton-campo lo comparten el dia y la hora. */
export const CSS_CAMPO = `
.cf-campo { display: flex; align-items: center; gap: 10px; width: 100%; min-height: 46px; padding: 0 14px; border-radius: 16px; border: 1.5px solid var(--linea-fuerte, #E9CFC5); background: #fff; font: inherit; font-size: 15px; font-weight: 700; color: var(--ink); text-align: left; cursor: pointer; transition: border-color .2s, box-shadow .2s; }
.cf-campo.vacio { color: #B39189; font-weight: 600; }
.cf-campo:hover { border-color: var(--pink-line, #F2C6C6); }
.cf-campo.esta-abierto, .cf-campo:focus-visible { outline: 0; border-color: var(--pink, #E64F55); box-shadow: 0 0 0 4px rgba(230,79,85,.12); }
.cf-ico { flex-shrink: 0; color: var(--pink-deep, #B03A3E); }
.cf-valor { position: absolute; left: 14px; bottom: 0; width: 1px; height: 1px; opacity: 0; pointer-events: none; border: 0 !important; padding: 0 !important; }
`;

const CSS = CSS_CAMPO + `
.cf { position: relative; min-width: 0; }
.cf-cab { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 10px; }
.cf-mes { font-size: 15.5px; font-weight: 900; color: var(--ink, #3B2A2C); letter-spacing: -0.01em; }
.cf-flecha { width: 36px; height: 36px; border-radius: 50%; border: 0; display: grid; place-items: center; cursor: pointer; background: var(--rubor, #FFF2EE); color: var(--pink-deep, #B03A3E); transition: background .2s; }
.cf-flecha:hover { background: #FFE4DC; }
.cf-flecha:disabled { opacity: .35; cursor: default; }
.cf-grilla { display: grid; grid-template-columns: repeat(7, 1fr); gap: 3px; }
.cf-sem { text-align: center; font-size: 11.5px; font-weight: 800; color: var(--muted, #8A6F68); padding: 4px 0 6px; }
.cf-dia { aspect-ratio: 1; min-height: 36px; border: 0; border-radius: 12px; background: transparent; font: inherit; font-size: 14px; font-weight: 700; color: var(--ink, #3B2A2C); cursor: pointer; transition: background .15s, color .15s; }
.cf-dia:hover { background: var(--rubor, #FFF2EE); color: var(--pink-deep, #B03A3E); }
.cf-dia.es-pasado { color: #C9B3AD; }
.cf-dia:disabled { cursor: default; background: transparent; color: #DDCCC7; }
.cf-dia.es-hoy { box-shadow: inset 0 0 0 1.5px var(--pink-line, #F2C6C6); color: var(--pink-deep, #B03A3E); }
.cf-dia.es-elegido { background: var(--pink, #E64F55); color: #fff; box-shadow: 0 8px 16px -10px rgba(230,79,85,.9); }
.cf-pie { display: flex; justify-content: space-between; margin-top: 10px; padding-top: 10px; border-top: 1px dashed var(--linea-fuerte, #E9CFC5); }
.cf-hoy, .cf-borrar { min-height: 36px; padding: 0 14px; border-radius: 99px; border: 0; cursor: pointer; font: inherit; font-size: 13.5px; font-weight: 800; background: var(--rubor, #FFF2EE); color: var(--pink-deep, #B03A3E); }
.cf-borrar { background: transparent; color: var(--muted, #8A6F68); }
`;
