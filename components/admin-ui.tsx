import Link from "next/link";
import { ChevronDown, Plus } from "lucide-react";

/*
 * Piezas compartidas de las pantallas de admin. Estilos en globals.css (.ad-*).
 *
 * Existen porque cada pantalla del panel tenia su cabecera, sus cifras y su
 * "Nuevo …" escritos a mano, cada uno un poco distinto. Son de servidor: no
 * llevan estado, asi que se pueden usar en paginas de servidor sin volverlas
 * de cliente.
 */

export function AdminCabecera({
  eyebrow, titulo, lede, acciones,
}: {
  eyebrow: string;
  titulo: string;
  lede?: React.ReactNode;
  acciones?: React.ReactNode;
}) {
  return (
    <header className="ad-mast">
      <div style={{ minWidth: 0 }}>
        <p className="ad-eyebrow"><span className="ad-raya" />{eyebrow}</p>
        <h1 className="ad-titulo">{titulo}<em>.</em></h1>
        {lede && <p className="ad-lede">{lede}</p>}
      </div>
      {acciones && <div className="ad-mast-acciones">{acciones}</div>}
    </header>
  );
}

/** Boton-enlace de la cabecera. `lleno` es el principal (coral). */
export function AdminBoton({ href, children, lleno }: { href: string; children: React.ReactNode; lleno?: boolean }) {
  return (
    <Link href={href as never} className={"ad-btn" + (lleno ? " ad-btn--lleno" : "")}>{children}</Link>
  );
}

export function AdminCifras({ items }: { items: { label: string; value: number | string; sub?: string }[] }) {
  return (
    <div className="ad-cifras" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
      {items.map((s) => (
        <div key={s.label} className="ad-cifra">
          <span className="ad-cifra-label">{s.label}</span>
          <span className="ad-cifra-num">{s.value}</span>
          {s.sub && <span className="ad-cifra-sub">{s.sub}</span>}
        </div>
      ))}
    </div>
  );
}

/**
 * El bloque plegado de "crear". `abierto` viene de la URL (?nueva=1): un
 * <details> no se abre con un ancla, asi que el boton de la cabecera lo pide
 * por query y el servidor lo pinta abierto.
 */
export function AdminNueva({
  id = "nueva", abierto, titulo, sub, children,
}: {
  id?: string;
  abierto?: boolean;
  titulo: string;
  sub?: string;
  children: React.ReactNode;
}) {
  return (
    <details className="ad-nueva" id={id} open={abierto}>
      <summary>
        <span className="ad-nueva-ico" aria-hidden="true"><Plus size={18} strokeWidth={2.2} /></span>
        <span className="ad-nueva-txt">
          <span className="ad-nueva-titulo">{titulo}</span>
          {sub && <span className="ad-nueva-sub">{sub}</span>}
        </span>
        <ChevronDown size={18} strokeWidth={2} className="ad-flecha" aria-hidden="true" />
      </summary>
      <div className="ad-nueva-cuerpo">{children}</div>
    </details>
  );
}

export function AdminVacio({ titulo, children }: { titulo: string; children?: React.ReactNode }) {
  return (
    <div className="ad-vacio">
      <p className="ad-vacio-titulo">{titulo}</p>
      {children}
    </div>
  );
}

export function AdminAviso({ mensaje, tono }: { mensaje: string | null; tono: "ok" | "error" }) {
  if (!mensaje) return null;
  return <div role="status" className={"ad-aviso ad-aviso--" + tono}>{mensaje}</div>;
}

/**
 * La guia de "todavia no hay nada": un ejemplo de como se ve (lo arma cada
 * pantalla) y los pasos para el primero. Reemplaza cifras en cero y una caja
 * vacia, que no le dicen nada a quien entra por primera vez.
 */
export function AdminGuia({
  rotuloEjemplo, ejemplo, eyebrow, titulo, pasos, cta,
}: {
  rotuloEjemplo: string;
  ejemplo: React.ReactNode;
  eyebrow: string;
  titulo: string;
  pasos: { icono: React.ReactNode; titulo: string; texto: string }[];
  cta: React.ReactNode;
}) {
  return (
    <section className="ad-guia" aria-label={titulo}>
      <div className="ad-guia-ejemplo" aria-hidden="true">
        <span className="ad-guia-rotulo">{rotuloEjemplo}</span>
        {ejemplo}
      </div>
      <div className="ad-guia-pasos">
        <p className="ad-guia-eyebrow">{eyebrow}</p>
        <h2 className="ad-guia-titulo">{titulo}</h2>
        <ol>
          {pasos.map((p) => (
            <li key={p.titulo}>
              <span className="ad-guia-ico" aria-hidden="true">{p.icono}</span>
              <div>
                <p className="ad-guia-paso">{p.titulo}</p>
                <p>{p.texto}</p>
              </div>
            </li>
          ))}
        </ol>
        {cta}
      </div>
    </section>
  );
}
