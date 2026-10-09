"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AlarmClock, Bell, CalendarCheck, CalendarHeart, Check, Link2Off, Megaphone, X } from "lucide-react";
import type { Notificacion } from "@/src/features/studio/notificaciones";

/**
 * Campanita de notificaciones del area de alumna, arriba a la derecha.
 *
 * "Leidas" se guarda en el navegador (localStorage): es una comodidad por
 * persona y por dispositivo, no un registro que alguien mas tenga que ver.
 * Si el navegador no deja guardar, todas cuentan como nuevas y nada se rompe.
 *
 * Tambien la usa la cabecera del admin (variante "cabecera") con los
 * recordatorios de src/features/admin/recordatorios.ts, con otra clave de
 * almacenamiento para que lo leido de un lado no apague el otro.
 *
 * Los iconos se eligen ACA a partir de `tipo`, que es una cadena: un icono no
 * puede llegar como prop desde el servidor (trampa 6).
 */
const CLAVE_ALUMNA = "brunela-notif-vistas";

function leerVistas(clave: string): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(clave) ?? "[]")); } catch { return new Set(); }
}

function Icono({ tipo }: { tipo: Notificacion["tipo"] }) {
  if (tipo === "recordatorio") return <AlarmClock size={17} strokeWidth={2.3} />;
  if (tipo === "invitacion") return <CalendarHeart size={17} strokeWidth={2.2} />;
  if (tipo === "pendiente") return <Link2Off size={17} strokeWidth={2.3} />;
  if (tipo === "completar") return <CalendarCheck size={17} strokeWidth={2.2} />;
  return <Megaphone size={17} strokeWidth={2.2} />;
}

/* Lo nuevo de esta pieza: el resto de .nt-* vive en globals.css. */
const CSS = `
.nt-ico--recordatorio { background: var(--pink-wash); color: var(--pink); box-shadow: inset 0 0 0 1.5px var(--pink-line); }
.nt-item.es-recordatorio { background: linear-gradient(120deg, #FFF1EC, #FFF8F4); }
.nt-item.es-recordatorio .nt-item-titulo { color: var(--pink-deep); }
.nt-ico--pendiente { background: var(--melocoton); color: var(--melocoton-deep); }
.nt-ico--completar { background: var(--rubor); color: var(--pink-deep); }
.nt-externo { display: inline-flex; align-self: flex-start; margin-top: 4px; padding: 3px 10px; border-radius: 99px; background: var(--pink); color: #fff; font-size: 11.5px; font-weight: 800; }
.nt--cabecera { margin-top: 0; }
.nt--cabecera .nt-campana { width: 38px; height: 38px; box-shadow: none; border: 1.5px solid var(--linea-fuerte); background: #fff; backdrop-filter: none; }
.nt--cabecera .nt-campana:hover, .nt--cabecera .nt-campana.es-abierta { background: var(--rubor); border-color: var(--pink-line); }
.nt--cabecera .nt-panel { top: 48px; }
@media (max-width: 560px) { .nt--cabecera .nt-panel { position: fixed; top: 64px; right: 16px; left: 16px; width: auto; } }
`;

function haceCuanto(iso: string | null, tipo: Notificacion["tipo"]) {
  if (!iso) return null;
  const d = new Date(iso);
  if (tipo === "invitacion" || tipo === "recordatorio") {
    return new Intl.DateTimeFormat("es-ES", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Madrid" }).format(d);
  }
  const dias = Math.floor((Date.now() - d.getTime()) / 86400000);
  return dias <= 0 ? "Hoy" : dias === 1 ? "Ayer" : `Hace ${dias} días`;
}

export function Notificaciones({
  items,
  variante = "flotante",
  titulo = "Notificaciones",
  vacio = "Estás al día. Acá vas a ver las novedades del estudio y las invitaciones de Brunela.",
  clave = CLAVE_ALUMNA,
}: {
  items: Notificacion[];
  /** "flotante": la campanita del area de alumna. "cabecera": dentro de la barra del admin. */
  variante?: "flotante" | "cabecera";
  titulo?: string;
  vacio?: string;
  clave?: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const [vistas, setVistas] = useState<Set<string>>(new Set());
  const [listo, setListo] = useState(false);
  const caja = useRef<HTMLDivElement>(null);

  useEffect(() => { setVistas(leerVistas(clave)); setListo(true); }, [clave]);

  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => { if (caja.current && !caja.current.contains(e.target as Node)) setAbierto(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setAbierto(false); };
    document.addEventListener("mousedown", fuera);
    window.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", fuera); window.removeEventListener("keydown", esc); };
  }, [abierto]);

  const nuevas = listo ? items.filter((i) => !vistas.has(i.id)).length : 0;

  function marcarTodas() {
    const s = new Set([...vistas, ...items.map((i) => i.id)]);
    setVistas(s);
    try { localStorage.setItem(clave, JSON.stringify([...s].slice(-200))); } catch { /* sin almacenamiento: no pasa nada */ }
  }

  return (
    <div className={"nt" + (variante === "cabecera" ? " nt--cabecera" : "")} ref={caja}>
      <style>{CSS}</style>
      <button
        type="button"
        className={"nt-campana" + (abierto ? " es-abierta" : "")}
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        aria-label={nuevas ? `${titulo}: ${nuevas} ${nuevas === 1 ? "nuevo" : "nuevos"}` : titulo}
      >
        <Bell size={19} strokeWidth={2.2} aria-hidden="true" />
        {nuevas > 0 && <span className="nt-cuenta">{nuevas > 9 ? "9+" : nuevas}</span>}
      </button>

      {abierto && (
        <div className="nt-panel" role="dialog" aria-label={titulo}>
          <div className="nt-cab">
            <p className="nt-titulo">{titulo}</p>
            {nuevas > 0 && (
              <button type="button" className="nt-leer" onClick={marcarTodas}>
                <Check size={13} strokeWidth={3} aria-hidden="true" /> Marcar como leídas
              </button>
            )}
            <button type="button" className="nt-cerrar" onClick={() => setAbierto(false)} aria-label="Cerrar">
              <X size={16} strokeWidth={2.4} />
            </button>
          </div>
          {items.length === 0 ? (
            <div className="nt-vacio">
              <span className="nt-vacio-ico" aria-hidden="true"><Bell size={22} strokeWidth={1.8} /></span>
              <p>{vacio}</p>
            </div>
          ) : (
            <ul className="nt-lista">
              {items.map((n) => {
                const nueva = !vistas.has(n.id);
                const cuando = haceCuanto(n.cuando, n.tipo);
                const clases = "nt-item" + (nueva ? " es-nueva" : "") + (n.tipo === "recordatorio" ? " es-recordatorio" : "");
                const cuerpo = (
                  <>
                    <span className={"nt-ico nt-ico--" + n.tipo} aria-hidden="true">
                      <Icono tipo={n.tipo} />
                    </span>
                    <span className="nt-txt">
                      <span className="nt-item-titulo">{n.titulo}</span>
                      <span className="nt-item-texto">{n.texto}</span>
                      {cuando && <span className="nt-item-cuando">{cuando}</span>}
                      {n.externo && <span className="nt-externo">Se abre en otra pestaña</span>}
                    </span>
                    {nueva && <span className="nt-punto" aria-label="Nueva" />}
                  </>
                );
                return (
                  <li key={n.id}>
                    {/* El enlace de Zoom/Meet va en un <a> comun, a otra pestaña:
                        Link de Next es para rutas propias. */}
                    {n.href && n.externo ? (
                      <a href={n.href} target="_blank" rel="noreferrer" className={clases} onClick={() => setAbierto(false)}>{cuerpo}</a>
                    ) : n.href ? (
                      <Link href={n.href as never} className={clases} onClick={() => setAbierto(false)}>{cuerpo}</Link>
                    ) : (
                      <div className={clases}>{cuerpo}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
