"use client";

import Link from "next/link";
import { useId } from "react";
import { motion, MotionConfig, type Variants } from "motion/react";

/*
 * Piezas animadas de la biblioteca (/dashboard/library).
 *
 * La pagina es de servidor y sigue leyendo todo con RLS; esto solo pone el
 * movimiento. Por la frontera viajan cadenas, numeros y JSX ya renderizado,
 * nunca funciones (trampa 6 de CLAUDE.md).
 *
 * Con "reducir movimiento" activado, MotionConfig apaga las transiciones.
 */

const SUAVE = [0.16, 1, 0.3, 1] as const;

export function Movimiento({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}

/** Una linea de titular que sube desde abajo de una mascara. */
export function Revelar({ children, retraso = 0 }: { children: React.ReactNode; retraso?: number }) {
  return (
    <span style={{ display: "block", overflow: "hidden", paddingBottom: "0.08em" }}>
      <motion.span
        style={{ display: "block" }}
        initial={{ y: "105%" }}
        animate={{ y: 0 }}
        transition={{ duration: 0.9, delay: retraso, ease: SUAVE }}
      >
        {children}
      </motion.span>
    </span>
  );
}

/** Aparece subiendo, con retraso opcional. */
export function Aparecer({ children, retraso = 0, className }: { children: React.ReactNode; retraso?: number; className?: string }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, delay: retraso, ease: SUAVE }}
    >
      {children}
    </motion.div>
  );
}

const grilla: Variants = {
  oculto: {},
  visible: { transition: { staggerChildren: 0.05, delayChildren: 0.15 } },
};

const tarjeta: Variants = {
  oculto: { opacity: 0, y: 26, scale: 0.98 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.7, ease: SUAVE } },
};

/** La grilla: sus hijos `Item` entran escalonados. */
export function Grilla({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div className={className} variants={grilla} initial="oculto" animate="visible">
      {children}
    </motion.div>
  );
}

export function Item({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div className={className} variants={tarjeta}>
      {children}
    </motion.div>
  );
}

/**
 * Pildoras con un fondo que se DESLIZA hasta la activa (layoutId). Sirve para
 * las categorias y para el conmutador "Mis clases / Explorar todo".
 */
export function Pildoras({
  items, variante = "chip", etiqueta,
}: {
  items: { href: string; label: string; activa: boolean; ayuda?: string }[];
  variante?: "chip" | "segmento";
  etiqueta: string;
}) {
  const id = useId();
  return (
    <nav aria-label={etiqueta} className={variante === "segmento" ? "bib-seg" : "bib-pildoras"}>
      {items.map((it) => (
        <Link
          key={it.href + it.label}
          href={it.href as never}
          title={it.ayuda}
          aria-current={it.activa ? "page" : undefined}
          className={(variante === "segmento" ? "bib-seg-op" : "bib-pildora") + (it.activa ? " es-activa" : "")}
        >
          {it.activa && (
            <motion.span
              layoutId={"fondo-" + id}
              className={variante === "segmento" ? "bib-seg-fondo" : "bib-pildora-fondo"}
              transition={{ type: "spring", stiffness: 420, damping: 34 }}
            />
          )}
          <span className="bib-pildora-txt">{it.label}</span>
        </Link>
      ))}
    </nav>
  );
}

/**
 * Desplegable que aplica el filtro al cambiarlo. El formulario sigue siendo
 * GET: sin JavaScript se aplica con el boton que la pagina deja en <noscript>.
 */
export function SelectAuto({
  name, defaultValue, opciones, etiqueta,
}: {
  name: string;
  defaultValue: string;
  opciones: { key: string; label: string }[];
  etiqueta: string;
}) {
  return (
    <label className={"bib-select" + (defaultValue ? " es-activo" : "")}>
      <span className="bib-select-etq">{etiqueta}</span>
      <select
        name={name}
        defaultValue={defaultValue}
        aria-label={etiqueta}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
      >
        {opciones.map((o) => (
          <option key={o.key} value={o.key}>{o.label}</option>
        ))}
      </select>
      <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
        <path d="M2 3.5l3 3 3-3" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </label>
  );
}
