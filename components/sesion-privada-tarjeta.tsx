import Link from "next/link";
import { ArrowRight, Clock, Lock, StickyNote } from "lucide-react";
import { UnirsePrivada } from "@/components/unirse-privada";
import { ProveedorIcono } from "@/components/proveedor-icono";
import { NOMBRE_PROVEEDOR } from "@/src/features/studio/enlace-clase";
import {
  ZONA_ESTUDIO, fechaHoraCorta, isoAMadrid, proveedorDePrivada, type SesionPrivada,
} from "@/src/features/studio/sesiones-privadas-reglas";

/*
 * La sesion privada del lado de la alumna: la tarjeta grande (inicio y la
 * proxima en su pagina) y la fila (el resto de la lista).
 *
 * De servidor. El boton "Unirse" es un componente de cliente aparte, porque
 * se enciende solo 15 minutos antes; recibe solo cadenas y numeros.
 */

function partes(iso: string) {
  const d = new Date(iso);
  const f = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("es-ES", { ...o, timeZone: ZONA_ESTUDIO }).format(d).replace(".", "");
  const larga = f({ weekday: "long", day: "numeric", month: "long" }).replace(",", "");
  return { semana: f({ weekday: "short" }), dia: f({ day: "numeric" }), mes: f({ month: "short" }), larga: larga.charAt(0).toUpperCase() + larga.slice(1), hora: isoAMadrid(iso).hora };
}

export function TarjetaSesionPrivada({ s, verTodas, ahora }: { s: SesionPrivada; verTodas?: boolean; ahora: number }) {
  const p = partes(s.starts_at);
  const prov = proveedorDePrivada(s);
  return (
    <section className="spt" aria-label="Tu próxima sesión privada">
      <style>{CSS}</style>
      <span className="spt-mancha" aria-hidden="true" />
      <div className="spt-cab">
        <span className="spt-ico" aria-hidden="true"><Lock size={16} strokeWidth={2.4} /></span>
        <p className="spt-eyebrow">Tu sesión privada con Brunela</p>
        {verTodas && <Link href={"/dashboard/sesiones-privadas" as never} className="spt-todas">Ver todas <ArrowRight size={13} strokeWidth={2.4} aria-hidden="true" /></Link>}
      </div>
      <div className="spt-cuerpo">
        <div className="spt-fecha" aria-hidden="true">
          <span>{p.semana}</span><b>{p.dia}</b><span>{p.mes}</span>
        </div>
        <div className="spt-txt">
          <p className="spt-titulo">{p.larga}</p>
          <p className="spt-meta">
            <span><Clock size={13} strokeWidth={2.4} aria-hidden="true" /> {p.hora} · {s.duracion_minutos} min</span>
            {prov && <span><ProveedorIcono proveedor={prov} size={13} /> {NOMBRE_PROVEEDOR[prov]}</span>}
          </p>
          {s.nota && <p className="spt-nota"><StickyNote size={13} strokeWidth={2.2} aria-hidden="true" /> {s.nota}</p>}
        </div>
        <div className="spt-accion">
          <UnirsePrivada inicio={s.starts_at} duracion={s.duracion_minutos} enlace={s.enlace} proveedor={prov} ahoraServidor={ahora} fechaTexto={fechaHoraCorta(s.starts_at)} />
          <span className="spt-ayuda">{prov ? "El botón se activa 15 min antes." : "Brunela te pasa el enlace antes de empezar."}</span>
        </div>
      </div>
    </section>
  );
}

export function FilaSesionPrivada({ s, estado, ahora }: { s: SesionPrivada; estado: "agendada" | "cancelada" | "hecha"; ahora: number }) {
  const p = partes(s.starts_at);
  const prov = proveedorDePrivada(s);
  return (
    <li className={"spt-fila es-" + estado}>
      <div className="spt-fecha spt-fecha--chica" aria-hidden="true"><span>{p.semana}</span><b>{p.dia}</b><span>{p.mes}</span></div>
      <div className="spt-txt">
        <p className="spt-fila-titulo">{fechaHoraCorta(s.starts_at)}</p>
        <p className="spt-meta">
          <span>{s.duracion_minutos} min</span>
          {estado === "cancelada" && <span className="spt-chip">Cancelada</span>}
          {estado === "hecha" && <span className="spt-chip">Hecha</span>}
        </p>
        {s.nota && estado !== "cancelada" && <p className="spt-nota"><StickyNote size={12} strokeWidth={2.2} aria-hidden="true" /> {s.nota}</p>}
      </div>
      {estado === "agendada" && (
        <div className="spt-accion">
          <UnirsePrivada inicio={s.starts_at} duracion={s.duracion_minutos} enlace={s.enlace} proveedor={prov} ahoraServidor={ahora} fechaTexto={fechaHoraCorta(s.starts_at)} />
        </div>
      )}
    </li>
  );
}

export const CSS_SESION_PRIVADA = `
.spt { position: relative; overflow: hidden; padding: 20px 22px; border-radius: 28px; background: linear-gradient(120deg, #FFF4EA 0%, #FFF9F5 55%, #FFEFE6 100%); border: 1px solid #F6D9C4; box-shadow: var(--sombra); }
.spt-mancha { position: absolute; right: -90px; top: -120px; width: 280px; height: 280px; border-radius: 50%; background: radial-gradient(circle, rgba(255,200,165,.5), transparent 65%); pointer-events: none; }
.spt > :not(.spt-mancha) { position: relative; }
.spt-cab { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; }
.spt-ico { width: 34px; height: 34px; border-radius: 12px; display: grid; place-items: center; background: var(--melocoton); color: var(--melocoton-deep); flex-shrink: 0; }
.spt-eyebrow { flex: 1; font-size: 13px; font-weight: 900; letter-spacing: .02em; color: var(--melocoton-deep); }
.spt-todas { display: inline-flex; align-items: center; gap: 5px; padding: 6px 12px; border-radius: 99px; background: #fff; color: var(--pink-deep); font-size: 12.5px; font-weight: 800; text-decoration: none; }
.spt-todas:hover { background: var(--rubor); }
.spt-cuerpo { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
.spt-fecha { width: 62px; flex-shrink: 0; padding: 8px 0; border-radius: 18px; background: #fff; display: flex; flex-direction: column; align-items: center; line-height: 1.1; color: var(--melocoton-deep); box-shadow: 0 8px 18px -14px rgba(176,70,70,.6); }
.spt-fecha span { font-size: 11px; font-weight: 800; text-transform: capitalize; }
.spt-fecha b { font-size: 26px; font-weight: 900; color: var(--ink); }
.spt-fecha--chica { width: 52px; padding: 6px 0; border-radius: 15px; background: #FFF4E8; box-shadow: none; }
.spt-fecha--chica b { font-size: 20px; }
.spt-txt { flex: 1 1 200px; min-width: 0; }
.spt-titulo { font-size: 20px; font-weight: 900; letter-spacing: -0.02em; color: var(--ink); }
.spt-meta { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-top: 4px; font-size: 13px; color: var(--muted); }
.spt-meta > span { display: inline-flex; align-items: center; gap: 5px; }
.spt-nota { display: flex; gap: 6px; align-items: flex-start; margin-top: 8px; font-size: 13px; line-height: 1.5; color: var(--ink); white-space: pre-wrap; }
.spt-nota svg { margin-top: 3px; flex-shrink: 0; color: var(--melocoton-deep); }
.spt-accion { display: flex; flex-direction: column; align-items: flex-end; gap: 6px; flex-shrink: 0; }
.spt-ayuda { font-size: 11.5px; color: var(--muted); }
.spt-chip { padding: 2px 9px; border-radius: 99px; font-size: 11.5px; font-weight: 800; background: var(--crema); color: var(--muted); }
.spt-lista { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.spt-fila { display: flex; align-items: center; gap: 14px; padding: 12px 14px; border-radius: 20px; background: #fff; border: 1px solid var(--linea); }
.spt-fila.es-cancelada { opacity: .6; }
.spt-fila.es-cancelada .spt-fila-titulo { text-decoration: line-through; }
.spt-fila-titulo { font-size: 15px; font-weight: 900; color: var(--ink); text-transform: capitalize; }
.upv { display: inline-flex; align-items: center; justify-content: center; gap: 7px; height: 44px; padding: 0 18px; border-radius: 99px; font-size: 13.5px; font-weight: 800; white-space: nowrap; text-decoration: none; }
.upv--ya { background: var(--pink); color: #fff; box-shadow: 0 12px 22px -12px rgba(230,79,85,.9); transition: transform .25s var(--curva), background .2s; }
.upv--ya:hover { background: var(--pink-mid); transform: translateY(-1px); }
.upv--antes { background: #fff; color: var(--melocoton-deep); border: 1.5px solid #F6D9C4; }
.upv--fin { background: var(--crema); color: var(--muted); }
@media (max-width: 560px) {
  .spt { padding: 16px; border-radius: 24px; }
  .spt-accion { width: 100%; align-items: stretch; }
  .spt-fila { flex-wrap: wrap; }
  .spt-fila .spt-accion { width: 100%; }
}
`;

const CSS = CSS_SESION_PRIVADA;
