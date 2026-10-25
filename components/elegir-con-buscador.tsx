"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, Search, X } from "lucide-react";
import { filtrarOpciones } from "@/src/features/studio/dias-de-plan";

/**
 * Elegir UNA opcion de una lista larga, escribiendo para filtrar.
 *
 * POR QUE UN COMPONENTE APARTE Y NO UN MODO DE <Desplegable>
 *   Desplegable se usa en decenas de formularios y su contrato (foco en el
 *   boton, escribir para SALTAR) es otro. Un buscador necesita el foco en un
 *   campo de texto. Meterlo como opcion alli arriesgaba todos los demas usos
 *   por uno solo.
 *
 * COMO VIAJA EL VALOR
 *   Igual que Desplegable: un <input> comun (no hidden: un hidden no respeta
 *   `required`) con el `name`, invisible, que lleva el `value` elegido.
 *
 * TECLADO: combobox con lista (patron de ARIA). Flechas para moverse, Enter
 * elige, Esc cierra. La busqueda ignora tildes y mayusculas y acepta palabras
 * en cualquier orden.
 *
 * `fijas` son opciones que se muestran SIEMPRE arriba, filtre lo que filtre
 * (p. ej. «Descanso»).
 */

export type OpcionBuscable = { value: string; label: string; detalle?: string; icono?: React.ReactNode };

type Props = {
  opciones: OpcionBuscable[];
  fijas?: OpcionBuscable[];
  /** Sin name no manda nada en el formulario: el valor se lee con onChange. */
  name?: string;
  required?: boolean;
  /** Abre la lista con el foco puesto (al tocar "Cambiar" en un dia). */
  autoFocus?: boolean;
  placeholder?: string;
  etiqueta?: string;
  /** Valor inicial (p. ej. al editar un dia que ya tiene clase). */
  defaultValue?: string;
  onChange?: (valor: string) => void;
};

export function ElegirConBuscador({ opciones, fijas = [], name, required, placeholder = "Buscá por título…", etiqueta, defaultValue = "", onChange, autoFocus }: Props) {
  const id = useId();
  const inicial = [...fijas, ...opciones].find((o) => o.value === defaultValue);
  const [valor, setValor] = useState(inicial ? defaultValue : "");
  const [texto, setTexto] = useState(inicial?.label ?? "");
  const [abierto, setAbierto] = useState(false);
  const [activo, setActivo] = useState(0);
  const caja = useRef<HTMLDivElement>(null);
  const campo = useRef<HTMLInputElement>(null);
  const lista = useRef<HTMLUListElement>(null);

  const todas = useMemo(() => [...fijas, ...opciones], [fijas, opciones]);
  const elegida = todas.find((o) => o.value === valor);
  // Con algo elegido, el campo muestra su titulo: filtrar por ese texto
  // dejaria una lista de uno. Se filtra solo por lo que se esta escribiendo.
  const consulta = elegida && texto === elegida.label ? "" : texto;
  const visibles = useMemo(() => [...fijas, ...filtrarOpciones(opciones, consulta)], [fijas, opciones, consulta]);

  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => { if (!caja.current?.contains(e.target as Node)) setAbierto(false); };
    document.addEventListener("mousedown", fuera);
    return () => document.removeEventListener("mousedown", fuera);
  }, [abierto]);

  useEffect(() => {
    if (!abierto) return;
    lista.current?.querySelector<HTMLElement>(`[data-i="${activo}"]`)?.scrollIntoView({ block: "nearest" });
  }, [abierto, activo]);

  useEffect(() => {
    if (!autoFocus) return;
    campo.current?.focus();
  }, [autoFocus]);

  // form.reset() (tras guardar) tiene que vaciar tambien el estado de React.
  useEffect(() => {
    const form = caja.current?.closest("form");
    if (!form) return;
    const reset = () => {
      const o = [...fijas, ...opciones].find((x) => x.value === defaultValue);
      setValor(o ? defaultValue : "");
      setTexto(o?.label ?? "");
      onChange?.(o ? defaultValue : "");
    };
    form.addEventListener("reset", reset);
    return () => form.removeEventListener("reset", reset);
  }, [onChange, defaultValue, fijas, opciones]);

  function elegir(o: OpcionBuscable | undefined) {
    if (!o) return;
    setValor(o.value);
    setTexto(o.label);
    setAbierto(false);
    onChange?.(o.value);
  }

  function limpiar() {
    setValor("");
    setTexto("");
    onChange?.("");
    setAbierto(true);
    setActivo(0);
    campo.current?.focus();
  }

  function teclear(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") { e.preventDefault(); setAbierto(true); setActivo((a) => Math.min(visibles.length - 1, abierto ? a + 1 : 0)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActivo((a) => Math.max(0, a - 1)); }
    else if (e.key === "Enter") {
      if (abierto && visibles[activo]) { e.preventDefault(); elegir(visibles[activo]); }
      // Sin name (el editor de plan) el formulario de afuera es OTRO: un Enter
      // buscando no tiene que guardar el plan entero.
      else if (!name) e.preventDefault();
    }
    else if (e.key === "Escape") { if (abierto) { e.preventDefault(); setAbierto(false); } }
    else if (e.key === "Tab") setAbierto(false);
  }

  const idLista = id + "-lista";

  return (
    <div className="ecb" ref={caja}>
      <style>{CSS}</style>
      <div className={"ecb-campo" + (abierto ? " esta-abierto" : "")}>
        {elegida?.icono ? <span className="ecb-ico" aria-hidden="true">{elegida.icono}</span> : <Search className="ecb-ico" size={16} strokeWidth={2.2} aria-hidden="true" />}
        <input
          ref={campo}
          type="text"
          role="combobox"
          aria-label={etiqueta}
          aria-expanded={abierto}
          aria-controls={abierto ? idLista : undefined}
          aria-autocomplete="list"
          aria-activedescendant={abierto && visibles[activo] ? `${id}-op-${activo}` : undefined}
          autoComplete="off"
          enterKeyHint="search"
          placeholder={placeholder}
          value={texto}
          onChange={(e) => {
            setTexto(e.target.value);
            if (valor) { setValor(""); onChange?.(""); }
            setAbierto(true);
            setActivo(0);
          }}
          onFocus={() => setAbierto(true)}
          onClick={() => setAbierto(true)}
          onKeyDown={teclear}
        />
        {(texto || valor) && (
          <button type="button" className="ecb-limpiar" onClick={limpiar} aria-label="Borrar la búsqueda">
            <X size={14} strokeWidth={2.4} />
          </button>
        )}
      </div>

      {name && (
        <input
          className="ecb-valor"
          name={name}
          value={valor}
          required={required}
          onChange={() => {}}
          tabIndex={-1}
          aria-hidden="true"
          onFocus={() => campo.current?.focus()}
        />
      )}

      {abierto && (
        <ul ref={lista} id={idLista} role="listbox" aria-label={etiqueta} className="ecb-lista">
          {visibles.map((o, i) => {
            const sel = o.value === valor;
            const esFija = i < fijas.length;
            return (
              <li
                key={o.value}
                id={`${id}-op-${i}`}
                data-i={i}
                role="option"
                aria-selected={sel}
                className={"ecb-op" + (i === activo ? " es-activa" : "") + (esFija ? " es-fija" : "")}
                onMouseEnter={() => setActivo(i)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => elegir(o)}
              >
                {o.icono && <span className="ecb-op-ico" aria-hidden="true">{o.icono}</span>}
                <span className="ecb-op-txt">
                  <span>{o.label}</span>
                  {o.detalle && <small>{o.detalle}</small>}
                </span>
                {sel && <Check size={15} strokeWidth={2.4} aria-hidden="true" />}
              </li>
            );
          })}
          {visibles.length === fijas.length && (
            <li className="ecb-nada" role="presentation">
              {opciones.length === 0 ? "Todavía no hay clases." : <>Ninguna clase coincide con «{texto}».</>}
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

const CSS = `
.ecb { position: relative; }
.ecb-campo {
  display: flex; align-items: center; gap: 8px; min-height: 46px; padding: 0 8px 0 14px; border-radius: 16px;
  border: 1.5px solid var(--linea-fuerte, #E9CFC5); background: #fff; transition: border-color .2s, box-shadow .2s;
}
.ecb-campo:focus-within { border-color: var(--pink, #E64F55); box-shadow: 0 0 0 4px rgba(230,79,85,.12); }
.ecb-ico { flex-shrink: 0; color: var(--pink-deep, #B03A3E); display: inline-flex; }
.ecb-campo input { flex: 1; min-width: 0; border: 0; outline: 0; background: transparent; font: inherit; font-size: 16px; color: var(--ink); padding: 10px 0; }
.ecb-campo input::placeholder { color: #B39189; }
.ecb-limpiar { flex-shrink: 0; width: 30px; height: 30px; border-radius: 50%; border: 0; display: grid; place-items: center; cursor: pointer; background: var(--rubor, #FFF2EE); color: var(--pink-deep, #B03A3E); }
.ecb-valor { position: absolute; left: 14px; bottom: 0; width: 1px; height: 1px; opacity: 0; pointer-events: none; border: 0; padding: 0; }
.ecb-lista {
  list-style: none; margin: 6px 0 0; padding: 6px; max-height: 280px; overflow-y: auto; overscroll-behavior: contain;
  border-radius: 18px; border: 1px solid var(--linea, #F6E7E1); background: #fff; box-shadow: 0 18px 40px -22px rgba(120,50,40,.45);
}
.ecb-op { display: flex; align-items: center; gap: 10px; min-height: 44px; padding: 8px 12px; border-radius: 12px; cursor: pointer; color: var(--ink); font-size: 14.5px; font-weight: 700; }
.ecb-op.es-activa { background: var(--rubor, #FFF2EE); }
.ecb-op > svg { margin-left: auto; flex-shrink: 0; color: var(--pink-deep, #B03A3E); }
.ecb-op-ico { width: 30px; height: 30px; border-radius: 10px; flex-shrink: 0; display: grid; place-items: center; background: #FFF4E8; color: var(--melocoton-deep, #C25E3A); }
.ecb-op-txt { display: flex; flex-direction: column; min-width: 0; }
.ecb-op-txt small { font-size: 12px; font-weight: 600; color: var(--muted); }
.ecb-op.es-fija { border-bottom: 1px dashed var(--linea-fuerte, #E9CFC5); border-radius: 12px 12px 0 0; margin-bottom: 4px; }
.ecb-nada { padding: 12px; font-size: 13.5px; color: var(--muted); }
`;
