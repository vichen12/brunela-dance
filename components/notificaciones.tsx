"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, CalendarHeart, Check, Megaphone, X } from "lucide-react";
import type { Notificacion } from "@/src/features/studio/notificaciones";

/**
 * Campanita de notificaciones del area de alumna, arriba a la derecha.
 *
 * "Leidas" se guarda en el navegador (localStorage): es una comodidad por
 * persona y por dispositivo, no un registro que alguien mas tenga que ver.
 * Si el navegador no deja guardar, todas cuentan como nuevas y nada se rompe.
 */
const CLAVE = "brunela-notif-vistas";

function leerVistas(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(CLAVE) ?? "[]")); } catch { return new Set(); }
}

function haceCuanto(iso: string, tipo: Notificacion["tipo"]) {
  const d = new Date(iso);
  if (tipo === "invitacion") {
    return new Intl.DateTimeFormat("es-ES", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Madrid" }).format(d);
  }
  const dias = Math.floor((Date.now() - d.getTime()) / 86400000);
  return dias <= 0 ? "Hoy" : dias === 1 ? "Ayer" : `Hace ${dias} días`;
}

export function Notificaciones({ items }: { items: Notificacion[] }) {
  const [abierto, setAbierto] = useState(false);
  const [vistas, setVistas] = useState<Set<string>>(new Set());
  const [listo, setListo] = useState(false);
  const caja = useRef<HTMLDivElement>(null);

  useEffect(() => { setVistas(leerVistas()); setListo(true); }, []);

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
    try { localStorage.setItem(CLAVE, JSON.stringify([...s].slice(-200))); } catch { /* sin almacenamiento: no pasa nada */ }
  }

  return (
    <div className="nt" ref={caja}>
      <button
        type="button"
        className={"nt-campana" + (abierto ? " es-abierta" : "")}
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        aria-label={nuevas ? `Notificaciones: ${nuevas} nuevas` : "Notificaciones"}
      >
        <Bell size={19} strokeWidth={2.2} aria-hidden="true" />
        {nuevas > 0 && <span className="nt-cuenta">{nuevas > 9 ? "9+" : nuevas}</span>}
      </button>

      {abierto && (
        <div className="nt-panel" role="dialog" aria-label="Notificaciones">
          <div className="nt-cab">
            <p className="nt-titulo">Notificaciones</p>
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
              <p>Estás al día. Acá vas a ver las novedades del estudio y las invitaciones de Brunela.</p>
            </div>
          ) : (
            <ul className="nt-lista">
              {items.map((n) => {
                const nueva = !vistas.has(n.id);
                const cuerpo = (
                  <>
                    <span className={"nt-ico nt-ico--" + n.tipo} aria-hidden="true">
                      {n.tipo === "invitacion" ? <CalendarHeart size={17} strokeWidth={2.2} /> : <Megaphone size={17} strokeWidth={2.2} />}
                    </span>
                    <span className="nt-txt">
                      <span className="nt-item-titulo">{n.titulo}</span>
                      <span className="nt-item-texto">{n.texto}</span>
                      <span className="nt-item-cuando">{haceCuanto(n.cuando, n.tipo)}</span>
                    </span>
                    {nueva && <span className="nt-punto" aria-label="Nueva" />}
                  </>
                );
                return (
                  <li key={n.id}>
                    {n.href ? (
                      <Link href={n.href as never} className={"nt-item" + (nueva ? " es-nueva" : "")} onClick={() => setAbierto(false)}>{cuerpo}</Link>
                    ) : (
                      <div className={"nt-item" + (nueva ? " es-nueva" : "")}>{cuerpo}</div>
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
