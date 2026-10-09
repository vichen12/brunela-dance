"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal, flushSync } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { Check, ChevronDown } from "lucide-react";

/**
 * El desplegable del sistema. Reemplaza a TODOS los <select> nativos.
 *
 * POR QUE NO EL <select> DEL NAVEGADOR
 *   La lista que abre la dibuja el sistema operativo, no la pagina: en Windows
 *   es una caja gris con la opcion marcada en azul, y no hay CSS que la toque.
 *   En un producto que se vende por como se ve, era lo unico de la interfaz que
 *   parecia de otro programa.
 *
 * COMO SIGUE FUNCIONANDO CON LOS FORMULARIOS
 *   El valor viaja en un <input> con el mismo `name` que tenia el select. Las
 *   server actions leen `formData.get(name)` igual que antes: no cambia nada
 *   del lado del servidor.
 *
 *   ⚠️ Ese input NO es type="hidden" ni readOnly, y es a proposito: los dos
 *      quedan fuera de la validacion del navegador, y un `required` dejaria de
 *      frenar el envio. Es un input comun, invisible, encima del boton: si
 *      falta elegir, el aviso del navegador aparece justo ahi.
 *
 * SIN `name` NO MANDA NADA. Hay lugares (clase-en-planes) que lo usan sin
 * name a proposito, para que el valor no se cuele en otro formulario.
 *
 * TECLADO: es un "combobox de solo seleccion" (patron de ARIA). El foco se
 * queda en el boton y la opcion activa se anuncia con aria-activedescendant.
 * Flechas, Inicio/Fin, Enter/Espacio, Esc, Tab y escribir para saltar.
 *
 * LA LISTA VA EN UN PORTAL con posicion fija: dentro de los paneles laterales
 * (overflow: auto) una lista absoluta quedaria recortada. Si no entra abajo,
 * se abre hacia arriba.
 */

export type OpcionDesplegable = { value: string; label: string; disabled?: boolean };

type Props = {
  opciones: OpcionDesplegable[];
  name?: string;
  defaultValue?: string;
  /** Controlado. Si viene, manda sobre el estado interno. */
  value?: string;
  onChange?: (valor: string) => void;
  /** Texto cuando el valor no coincide con ninguna opcion (p. ej. ""). */
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  /** Envia el formulario al elegir (filtros GET). */
  autoEnviar?: boolean;
  /** Nombre accesible cuando no hay <label> alrededor. */
  etiqueta?: string;
  /** "campo" para formularios; "pildora" para barras de filtros. */
  variante?: "campo" | "pildora";
  /** En la pildora, el rotulo chico de la izquierda ("Nivel"). */
  prefijo?: string;
  className?: string;
  style?: React.CSSProperties;
  id?: string;
};

const SUAVE = [0.16, 1, 0.3, 1] as const;

export function Desplegable({
  opciones, name, defaultValue, value, onChange, placeholder = "Elegí una opción",
  required, disabled, autoEnviar, etiqueta, variante = "campo", prefijo, className, style, id,
}: Props) {
  const idBase = useId();
  const idLista = idBase + "-lista";
  const [interno, setInterno] = useState(defaultValue ?? "");
  const valor = value !== undefined ? value : interno;

  const [abierto, setAbierto] = useState(false);
  const [activo, setActivo] = useState(-1);
  const [pos, setPos] = useState<{ left: number; top: number; width: number; arriba: boolean; alto: number } | null>(null);
  const [montado, setMontado] = useState(false);

  const botonRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listaRef = useRef<HTMLUListElement>(null);
  const tecleado = useRef({ texto: "", t: 0 });

  useEffect(() => setMontado(true), []);

  // form.reset() devuelve un <select> a su valor inicial solo, porque vive en
  // el DOM. Este guarda el valor en estado de React: sin escuchar el reset, el
  // formulario de subida quedaba mostrando la categoria de la clase anterior.
  useEffect(() => {
    const form = botonRef.current?.closest("form");
    if (!form) return;
    const alResetear = () => setInterno(defaultValue ?? "");
    form.addEventListener("reset", alResetear);
    return () => form.removeEventListener("reset", alResetear);
  }, [defaultValue]);

  const elegida = opciones.find((o) => o.value === valor);
  const habilitadas = opciones.map((o, i) => (o.disabled ? -1 : i)).filter((i) => i >= 0);

  const ubicar = useCallback(() => {
    const b = botonRef.current?.getBoundingClientRect();
    if (!b) return;
    const altoMax = 300;
    const abajo = window.innerHeight - b.bottom - 12;
    const arriba = abajo < Math.min(altoMax, opciones.length * 42 + 12) && b.top > abajo;
    setPos({
      left: Math.max(8, Math.min(b.left, window.innerWidth - Math.max(b.width, 200) - 8)),
      top: arriba ? b.top - 6 : b.bottom + 6,
      width: Math.max(b.width, 200),
      arriba,
      alto: Math.min(altoMax, arriba ? b.top - 12 : abajo),
    });
  }, [opciones.length]);

  useLayoutEffect(() => {
    if (!abierto) return;
    ubicar();
    const cerrarSiAfuera = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!botonRef.current?.contains(t) && !listaRef.current?.contains(t)) setAbierto(false);
    };
    window.addEventListener("resize", ubicar);
    window.addEventListener("scroll", ubicar, true);
    document.addEventListener("mousedown", cerrarSiAfuera);
    return () => {
      window.removeEventListener("resize", ubicar);
      window.removeEventListener("scroll", ubicar, true);
      document.removeEventListener("mousedown", cerrarSiAfuera);
    };
  }, [abierto, ubicar]);

  // La opcion activa siempre a la vista dentro de la lista.
  useEffect(() => {
    if (!abierto || activo < 0) return;
    listaRef.current?.querySelector<HTMLElement>(`[data-i="${activo}"]`)?.scrollIntoView({ block: "nearest" });
  }, [abierto, activo]);

  function abrir() {
    if (disabled) return;
    const i = opciones.findIndex((o) => o.value === valor && !o.disabled);
    setActivo(i >= 0 ? i : habilitadas[0] ?? -1);
    setAbierto(true);
  }

  function elegir(i: number) {
    const o = opciones[i];
    if (!o || o.disabled) return;
    setAbierto(false);
    botonRef.current?.focus();
    if (o.value === valor) return;
    // flushSync: el input tiene que tener el valor nuevo ANTES de enviar.
    flushSync(() => {
      if (value === undefined) setInterno(o.value);
    });
    onChange?.(o.value);
    if (autoEnviar) inputRef.current?.form?.requestSubmit();
  }

  function mover(delta: number) {
    if (habilitadas.length === 0) return;
    const pos = habilitadas.indexOf(activo);
    const sig = pos < 0 ? 0 : Math.max(0, Math.min(habilitadas.length - 1, pos + delta));
    setActivo(habilitadas[sig]);
  }

  function teclear(e: React.KeyboardEvent<HTMLButtonElement>) {
    if (disabled) return;
    const k = e.key;
    if (!abierto) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(k)) {
        e.preventDefault();
        abrir();
      }
      return;
    }
    if (k === "ArrowDown") { e.preventDefault(); mover(1); }
    else if (k === "ArrowUp") { e.preventDefault(); mover(-1); }
    else if (k === "Home") { e.preventDefault(); setActivo(habilitadas[0] ?? -1); }
    else if (k === "End") { e.preventDefault(); setActivo(habilitadas[habilitadas.length - 1] ?? -1); }
    else if (k === "Enter" || k === " ") { e.preventDefault(); elegir(activo); }
    else if (k === "Escape") { e.preventDefault(); setAbierto(false); }
    else if (k === "Tab") { setAbierto(false); }
    else if (k.length === 1 && /\S/.test(k)) {
      // Escribir para saltar: "s" va a Solista, "so" sigue sumando letras.
      const ahora = Date.now();
      const t = tecleado.current;
      t.texto = (ahora - t.t < 700 ? t.texto : "") + k.toLowerCase();
      t.t = ahora;
      const i = habilitadas.find((j) => opciones[j].label.toLowerCase().startsWith(t.texto));
      if (i !== undefined) setActivo(i);
    }
  }

  const texto = elegida?.label ?? placeholder;
  const vacio = !elegida || elegida.value === "";

  return (
    <span className={"dsp" + (variante === "pildora" ? " dsp--pildora" : "") + (valor && variante === "pildora" ? " es-activo" : "")}>
      <button
        ref={botonRef}
        id={id}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={abierto}
        // Solo mientras esta abierta: la lista no existe cerrada, y un id
        // generado en el HTML del servidor puede no coincidir con el del
        // navegador (aviso de hidratacion en /admin/users).
        aria-controls={abierto ? idLista : undefined}
        aria-activedescendant={abierto && activo >= 0 ? `${idBase}-op-${activo}` : undefined}
        aria-label={etiqueta}
        disabled={disabled}
        className={"dsp-boton" + (className ? " " + className : "") + (abierto ? " esta-abierto" : "")}
        // Con estilo propio (los paneles de admin pasan el de sus inputs) el
        // alto lo da ese relleno, no el minimo de la clase base.
        style={style ? { minHeight: 0, ...style } : undefined}
        onClick={() => (abierto ? setAbierto(false) : abrir())}
        onKeyDown={teclear}
      >
        {prefijo && <span className="dsp-prefijo">{prefijo}</span>}
        <span className={"dsp-texto" + (vacio && variante === "campo" ? " es-placeholder" : "")}>{texto}</span>
        <motion.span
          className="dsp-flecha"
          animate={{ rotate: abierto ? 180 : 0 }}
          transition={{ duration: 0.25, ease: SUAVE }}
          aria-hidden="true"
        >
          <ChevronDown size={15} strokeWidth={2} />
        </motion.span>
      </button>

      {name && (
        <input
          ref={inputRef}
          className="dsp-valor"
          name={name}
          value={valor}
          required={required}
          disabled={disabled}
          onChange={() => {}}
          tabIndex={-1}
          aria-hidden="true"
          onFocus={() => botonRef.current?.focus()}
        />
      )}

      {montado && createPortal(
        <AnimatePresence>
          {abierto && pos && (
            <motion.ul
              ref={listaRef}
              id={idLista}
              role="listbox"
              aria-label={etiqueta ?? prefijo}
              className="dsp-lista"
              style={{
                left: pos.left, width: pos.width, maxHeight: pos.alto,
                top: pos.arriba ? undefined : pos.top,
                bottom: pos.arriba ? window.innerHeight - pos.top : undefined,
                transformOrigin: pos.arriba ? "bottom center" : "top center",
              }}
              initial={{ opacity: 0, y: pos.arriba ? 6 : -6, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: pos.arriba ? 4 : -4, scale: 0.98, transition: { duration: 0.12 } }}
              transition={{ duration: 0.22, ease: SUAVE }}
            >
              {opciones.map((o, i) => {
                const sel = o.value === valor;
                return (
                  <li
                    key={o.value + i}
                    id={`${idBase}-op-${i}`}
                    data-i={i}
                    role="option"
                    aria-selected={sel}
                    aria-disabled={o.disabled || undefined}
                    className={"dsp-op" + (i === activo ? " es-activa" : "") + (sel ? " es-elegida" : "") + (o.disabled ? " es-deshabilitada" : "")}
                    onMouseEnter={() => !o.disabled && setActivo(i)}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => elegir(i)}
                  >
                    <span>{o.label}</span>
                    {sel && <Check size={15} strokeWidth={2.4} aria-hidden="true" />}
                  </li>
                );
              })}
            </motion.ul>
          )}
        </AnimatePresence>,
        document.body
      )}
    </span>
  );
}
