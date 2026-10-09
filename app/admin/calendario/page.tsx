import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight, Plus, User, Users, Video } from "lucide-react";
import { requireAdmin } from "@/src/features/auth/guards";
import { AdminBoton, AdminCabecera } from "@/components/admin-ui";
import { cargarCalendarioAdmin } from "@/src/features/admin/calendario-datos";
import {
  AVISO_SIN_SESIONES_PRIVADAS, agruparPorDia, celdasDelMes, claveDia, horaMadrid, mesDeParametro,
  mesVecino, nombreDia, nombreMes, rangoConsultaMes, recortarCelda, textoMas, type EventoCalendario,
} from "@/src/features/admin/calendario";

export const dynamic = "force-dynamic";

/**
 * Calendario de la admin: TODO lo que Brunela tiene agendado, en un solo lugar.
 *
 * Dos clases de evento:
 *   - clases en vivo grupales (live_sessions), en coral;
 *   - sesiones privadas 1 a 1 (sesiones_privadas), en melocoton con el icono
 *     de una persona.
 *
 * Dos vistas, del mismo HTML:
 *   - grilla del mes (por defecto en escritorio);
 *   - agenda por dia (en el telefono, por CSS debajo de 700 px, o con
 *     ?vista=agenda). La grilla de 7 columnas en un telefono deja celdas de
 *     40 px donde no entra ni una hora.
 *
 * Todo server-rendered: el mes y la vista viajan en la URL (?mes=2026-10).
 * Horarios de Madrid, que es la zona del estudio.
 */
export default async function AdminCalendarioPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const params = (await searchParams) ?? {};
  const txt = (k: string) => (typeof params[k] === "string" ? (params[k] as string).trim() : "");

  const hoy = claveDia(Date.now());
  const mesHoy = hoy.slice(0, 7);
  const mes = mesDeParametro(txt("mes"), hoy);
  const vistaAgenda = txt("vista") === "agenda";

  const { desde, hasta } = rangoConsultaMes(mes);
  const { eventos, faltaMigracionPrivadas } = await cargarCalendarioAdmin(desde, hasta);
  const porDia = agruparPorDia(eventos, (k) => k.startsWith(mes));
  const celdas = celdasDelMes(mes);

  const url = (m: string, agenda = vistaAgenda, dia?: string) => {
    const u = new URLSearchParams();
    if (m !== mesHoy) u.set("mes", m);
    if (agenda) u.set("vista", "agenda");
    const t = u.toString();
    return "/admin/calendario" + (t ? "?" + t : "") + (dia ? "#d-" + dia : "");
  };

  const totalVivo = eventos.filter((e) => e.tipo === "vivo" && claveDia(e.inicio).startsWith(mes)).length;
  const totalPrivadas = eventos.filter((e) => e.tipo === "privada" && claveDia(e.inicio).startsWith(mes)).length;

  return (
    <main className="cl">
      <style>{CSS}</style>

      <AdminCabecera
        eyebrow="Estudio"
        titulo="Calendario"
        lede="Tus clases en vivo y tus sesiones privadas, todo junto. Tocá cualquiera para ver el detalle."
        acciones={
          <div className="cl-acciones">
            <AdminBoton href="/admin/sesiones-privadas"><User size={15} strokeWidth={2.3} aria-hidden="true" /> Agendar sesión privada</AdminBoton>
            <AdminBoton href="/admin/live?nueva=1#nueva" lleno><Plus size={15} strokeWidth={2.6} aria-hidden="true" /> Nueva clase en vivo</AdminBoton>
          </div>
        }
      />

      <section className={"cl-cal" + (vistaAgenda ? " es-agenda" : "")} aria-label={`Calendario de ${nombreMes(mes)}`}>
        <header className="cl-cab">
          <span className="cl-ico" aria-hidden="true"><CalendarDays size={18} strokeWidth={2} /></span>
          <div className="cl-cab-txt">
            <h2 className="cl-titulo">{nombreMes(mes)}</h2>
            <p className="cl-resumen">
              {totalVivo} {totalVivo === 1 ? "clase en vivo" : "clases en vivo"}
              {!faltaMigracionPrivadas && <> · {totalPrivadas} {totalPrivadas === 1 ? "sesión privada" : "sesiones privadas"}</>}
            </p>
          </div>
          <nav className="cl-vistas" aria-label="Vista">
            <Link href={url(mes, false) as never} className={"cl-vista" + (!vistaAgenda ? " es-activa" : "")} aria-current={!vistaAgenda ? "page" : undefined}>Mes</Link>
            <Link href={url(mes, true) as never} className={"cl-vista" + (vistaAgenda ? " es-activa" : "")} aria-current={vistaAgenda ? "page" : undefined}>Agenda</Link>
          </nav>
          <div className="cl-nav">
            <Link href={url(mesVecino(mes, -1)) as never} className="cl-flecha" aria-label="Mes anterior"><ChevronLeft size={18} strokeWidth={2.2} /></Link>
            {mes !== mesHoy && <Link href={url(mesHoy) as never} className="cl-hoy-btn">Hoy</Link>}
            <Link href={url(mesVecino(mes, 1)) as never} className="cl-flecha" aria-label="Mes siguiente"><ChevronRight size={18} strokeWidth={2.2} /></Link>
          </div>
        </header>

        <div className="cl-leyenda">
          <span><i className="cl-pt cl-pt--vivo" aria-hidden="true" /> Clase en vivo</span>
          <span><i className="cl-pt cl-pt--privada" aria-hidden="true" /> Sesión privada</span>
          <span><i className="cl-pt cl-pt--borrador" aria-hidden="true" /> Borrador</span>
        </div>

        {faltaMigracionPrivadas && <p className="cl-aviso">{AVISO_SIN_SESIONES_PRIVADAS}</p>}

        {/* ── Grilla del mes ── */}
        <div className="cl-mes-vista">
          <div className="cl-grilla" role="grid">
            {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((d) => <span key={d} className="cl-sem" role="columnheader">{d}</span>)}
            {celdas.map((k, i) => {
              if (!k) return <span key={"v" + i} className="cl-celda es-vacia" aria-hidden="true" />;
              const delDia = porDia.get(k) ?? [];
              const { visibles, resto } = recortarCelda(delDia, 3);
              const clases = "cl-celda" + (k === hoy ? " es-hoy" : "") + (k < hoy ? " es-pasado" : "") + (delDia.length ? " con-eventos" : "");
              return (
                <div key={k} className={clases} role="gridcell" aria-label={`${nombreDia(k)}: ${delDia.length ? delDia.length + (delDia.length === 1 ? " evento" : " eventos") : "libre"}`}>
                  {delDia.length ? (
                    <Link href={url(mes, true, k) as never} className="cl-num" title="Ver el día en la agenda">{Number(k.slice(8))}</Link>
                  ) : (
                    <span className="cl-num">{Number(k.slice(8))}</span>
                  )}
                  <span className="cl-eventos">
                    {visibles.map((e) => <EventoCelda key={e.tipo + e.id} e={e} />)}
                    {resto > 0 && <Link href={url(mes, true, k) as never} className="cl-mas">{textoMas(resto)}</Link>}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Agenda por dia ── */}
        <div className="cl-agenda">
          {porDia.size === 0 ? (
            <div className="cl-vacio">
              <span className="cl-vacio-ico" aria-hidden="true"><CalendarDays size={22} strokeWidth={2.2} /></span>
              <p className="cl-vacio-titulo">Nada agendado en {nombreMes(mes).toLowerCase()}.</p>
              <p className="cl-vacio-txt">Programá una clase en vivo o agendá una sesión privada con los botones de arriba.</p>
            </div>
          ) : (
            [...porDia.entries()].map(([k, lista]) => (
              <section key={k} id={"d-" + k} className={"cl-dia" + (k === hoy ? " es-hoy" : "") + (k < hoy ? " es-pasado" : "")}>
                <h3 className="cl-dia-titulo">
                  {nombreDia(k)}
                  {k === hoy && <span className="cl-dia-hoy">Hoy</span>}
                </h3>
                <ul className="cl-dia-lista">
                  {lista.map((e) => <EventoFila key={e.tipo + e.id} e={e} />)}
                </ul>
              </section>
            ))
          )}
        </div>

        <p className="cl-pie">Horarios de Madrid. Tocá un número de día para verlo en la agenda.</p>
      </section>
    </main>
  );
}

const ESTADO_TEXTO: Record<string, string> = { borrador: "Borrador", cancelada: "Cancelada", hecha: "Hecha" };

function claseEvento(e: EventoCalendario) {
  return "cl-ev--" + e.tipo + (e.estado ? " es-" + e.estado : "");
}

function EventoCelda({ e }: { e: EventoCalendario }) {
  const hora = horaMadrid(e.inicio);
  const titulo = [hora, e.titulo, e.planes, e.detalle, e.estado ? ESTADO_TEXTO[e.estado] : null].filter(Boolean).join(" · ");
  return (
    <Link href={e.href as never} title={titulo} className={"cl-ev " + claseEvento(e)}>
      {e.tipo === "privada" && <User size={11} strokeWidth={2.6} aria-hidden="true" className="cl-ev-ico" />}
      <b>{hora}</b> <span className="cl-ev-txt">{e.tipo === "privada" ? e.titulo.replace(/^Sesión privada · /, "") : e.titulo}</span>
    </Link>
  );
}

function EventoFila({ e }: { e: EventoCalendario }) {
  return (
    <li>
      <Link href={e.href as never} className={"cl-fila " + claseEvento(e)}>
        <span className="cl-fila-hora">{horaMadrid(e.inicio)}</span>
        <span className="cl-fila-ico" aria-hidden="true">
          {e.tipo === "privada" ? <User size={16} strokeWidth={2.3} /> : <Video size={16} strokeWidth={2.3} />}
        </span>
        <span className="cl-fila-cuerpo">
          <span className="cl-fila-titulo">{e.titulo}</span>
          <span className="cl-fila-meta">
            {e.planes && <span>{e.planes}</span>}
            <span className={e.alerta ? "es-alerta" : undefined}>
              {e.tipo === "vivo" && <Users size={12} strokeWidth={2.4} aria-hidden="true" />} {e.detalle}
            </span>
          </span>
        </span>
        {e.estado && <span className={"cl-chip es-" + e.estado}>{ESTADO_TEXTO[e.estado]}</span>}
      </Link>
    </li>
  );
}

const CSS = `
.cl { display: flex; flex-direction: column; }
.cl-acciones { display: flex; flex-wrap: wrap; gap: 8px; }
.cl-acciones .ad-btn { display: inline-flex; align-items: center; gap: 7px; }

.cl-cal { border: 1px solid var(--linea); border-radius: 30px; background: linear-gradient(160deg, #FFF7F3, #fff 45%); box-shadow: var(--sombra); padding: 22px 22px 16px; }
.cl-cab { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 12px; }
.cl-ico { width: 40px; height: 40px; border-radius: 14px; display: grid; place-items: center; background: var(--rubor); color: var(--pink-deep); flex-shrink: 0; }
.cl-cab-txt { min-width: 0; }
.cl-titulo { margin: 0; font-size: 22px; font-weight: 900; letter-spacing: -0.02em; color: var(--ink); }
.cl-resumen { margin: 2px 0 0; font-size: 12.5px; font-weight: 700; color: var(--muted); }
.cl-vistas { margin-left: auto; display: inline-flex; padding: 4px; border-radius: 99px; background: var(--rubor); }
.cl-vista { height: 32px; padding: 0 14px; border-radius: 99px; display: inline-flex; align-items: center; font-size: 13px; font-weight: 800; color: var(--pink-deep); text-decoration: none; transition: background .2s; }
.cl-vista:hover { background: #fff; }
.cl-vista.es-activa { background: #fff; color: var(--ink); box-shadow: 0 4px 10px -6px rgba(176, 90, 80, .45); }
.cl-nav { display: flex; align-items: center; gap: 6px; }
.cl-flecha { width: 40px; height: 40px; border-radius: 50%; display: grid; place-items: center; background: #fff; border: 1.5px solid var(--linea-fuerte); color: var(--ink); transition: background .2s, border-color .2s, transform .3s var(--curva); }
.cl-flecha:hover { background: var(--rubor); border-color: var(--pink-line); transform: scale(1.06); }
.cl-hoy-btn { height: 40px; padding: 0 16px; border-radius: 99px; display: inline-flex; align-items: center; font-size: 13px; font-weight: 800; color: var(--pink-deep); background: var(--rubor); text-decoration: none; }

.cl-leyenda { display: flex; flex-wrap: wrap; gap: 6px 16px; margin: 0 2px 14px; font-size: 12px; font-weight: 700; color: var(--muted); }
.cl-leyenda span { display: inline-flex; align-items: center; gap: 6px; }
.cl-pt { width: 10px; height: 10px; border-radius: 4px; display: inline-block; }
.cl-pt--vivo { background: var(--pink); }
.cl-pt--privada { background: var(--melocoton); border: 1.5px solid var(--melocoton-deep); }
.cl-pt--borrador { background: #fff; border: 1.5px dashed var(--pink); }
.cl-aviso { margin: 0 0 14px; padding: 10px 14px; border-radius: 14px; background: var(--crema); border: 1px dashed var(--linea-fuerte); font-size: 12.5px; font-weight: 600; color: var(--muted); }

/* Grilla */
.cl-grilla { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 6px; }
.cl-sem { text-align: center; font-size: 12px; font-weight: 800; color: var(--muted); padding: 4px 0 6px; }
.cl-celda { position: relative; min-height: 112px; border-radius: 18px; padding: 8px; background: #fff; border: 1px solid #F6EAE4; display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.cl-celda.es-vacia { background: transparent; border-color: transparent; }
.cl-celda.es-pasado { background: #FFFCFA; }
.cl-celda.es-pasado .cl-num { color: #CDB3AB; }
.cl-celda.es-pasado .cl-ev { opacity: .7; }
.cl-celda.con-eventos { border-color: var(--linea); }
.cl-celda.es-hoy { border-color: var(--pink); box-shadow: 0 0 0 3px rgba(230,79,85,.12); }
.cl-num { align-self: flex-start; font-size: 13px; font-weight: 900; color: var(--ink); width: 26px; height: 26px; border-radius: 50%; display: grid; place-items: center; text-decoration: none; }
a.cl-num:hover, a.cl-num:focus-visible { background: var(--rubor); color: var(--pink-deep); }
.cl-celda.es-hoy .cl-num { background: var(--pink); color: #fff; }
.cl-eventos { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.cl-ev { display: flex; align-items: center; gap: 4px; padding: 3px 7px; border-radius: 8px; font-size: 11px; font-weight: 700; line-height: 1.35; white-space: nowrap; overflow: hidden; border-left: 3px solid transparent; text-decoration: none; transition: filter .2s, transform .2s var(--curva); }
.cl-ev:hover { filter: brightness(.96); transform: translateX(1px); }
.cl-ev:focus-visible { outline: 0; box-shadow: 0 0 0 2px #fff, 0 0 0 4px var(--pink); }
.cl-ev b { font-weight: 900; flex-shrink: 0; }
.cl-ev-txt { overflow: hidden; text-overflow: ellipsis; min-width: 0; }
.cl-ev-ico { flex-shrink: 0; }
.cl-ev--vivo { background: var(--pink-wash); color: var(--pink-deep); border-left-color: var(--pink); }
.cl-ev--privada { background: var(--melocoton); color: var(--ink); border-left-color: var(--melocoton-deep); }
.cl-ev--privada .cl-ev-ico { color: var(--melocoton-deep); }
.cl-ev.es-borrador { background: #fff; border: 1px dashed var(--pink-line); border-left: 3px dashed var(--pink); }
.cl-ev.es-cancelada { background: #fff; color: var(--muted); border-left-color: var(--linea-fuerte); text-decoration: line-through; }
.cl-ev.es-hecha { opacity: .65; }
.cl-mas { align-self: flex-start; padding: 1px 7px; border-radius: 99px; font-size: 11px; font-weight: 800; color: var(--pink-deep); text-decoration: none; }
.cl-mas:hover { background: var(--rubor); text-decoration: underline; }

/* Agenda */
.cl-agenda { display: none; flex-direction: column; gap: 16px; }
.cl-cal.es-agenda .cl-mes-vista { display: none; }
.cl-cal.es-agenda .cl-agenda { display: flex; }
.cl-dia { scroll-margin-top: 24px; }
.cl-dia-titulo { display: flex; align-items: center; gap: 8px; margin: 0 0 8px; font-size: 15px; font-weight: 900; letter-spacing: -0.01em; color: var(--ink); }
.cl-dia.es-pasado .cl-dia-titulo { color: var(--muted); }
.cl-dia-hoy { padding: 2px 10px; border-radius: 99px; background: var(--pink); color: #fff; font-size: 11.5px; font-weight: 800; }
.cl-dia:target .cl-dia-titulo { color: var(--pink-deep); }
.cl-dia-lista { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.cl-fila { display: flex; align-items: center; gap: 12px; padding: 12px 14px; border-radius: 18px; background: #fff; border: 1px solid var(--linea); border-left: 4px solid transparent; text-decoration: none; color: var(--ink); transition: border-color .2s, box-shadow .3s, transform .3s var(--curva); }
.cl-fila:hover { box-shadow: var(--sombra); transform: translateY(-1px); }
.cl-fila.cl-ev--vivo { border-left-color: var(--pink); }
.cl-fila.cl-ev--privada { border-left-color: var(--melocoton-deep); background: linear-gradient(120deg, #FFF4EC, #fff 60%); }
.cl-fila.es-borrador { border-left-style: dashed; }
.cl-fila.es-cancelada .cl-fila-titulo { text-decoration: line-through; color: var(--muted); }
.cl-fila.es-hecha { opacity: .7; }
.cl-dia.es-pasado .cl-fila { opacity: .75; }
.cl-fila-hora { width: 48px; flex-shrink: 0; font-size: 14px; font-weight: 900; font-variant-numeric: tabular-nums; }
.cl-fila-ico { width: 34px; height: 34px; border-radius: 12px; flex-shrink: 0; display: grid; place-items: center; }
.cl-ev--vivo .cl-fila-ico { background: var(--pink-wash); color: var(--pink-deep); }
.cl-ev--privada .cl-fila-ico { background: var(--melocoton); color: var(--melocoton-deep); }
.cl-fila-cuerpo { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.cl-fila-titulo { font-size: 14.5px; font-weight: 800; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cl-fila-meta { display: flex; flex-wrap: wrap; gap: 2px 12px; font-size: 12.5px; font-weight: 600; color: var(--muted); }
.cl-fila-meta span { display: inline-flex; align-items: center; gap: 4px; }
.cl-fila-meta .es-alerta { color: var(--pink-deep); font-weight: 800; }
.cl-chip { flex-shrink: 0; padding: 3px 10px; border-radius: 99px; font-size: 11.5px; font-weight: 800; background: var(--crema); color: var(--muted); border: 1px solid var(--linea); }
.cl-chip.es-borrador { background: #fff; color: var(--pink-deep); border: 1px dashed var(--pink); }

.cl-vacio { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 40px 20px; text-align: center; border-radius: 24px; background: var(--crema); border: 1.5px dashed var(--linea-fuerte); }
.cl-vacio-ico { width: 46px; height: 46px; border-radius: 16px; display: grid; place-items: center; background: #fff; color: var(--pink-deep); box-shadow: var(--sombra); }
.cl-vacio-titulo { margin: 0; font-size: 18px; font-weight: 900; color: var(--ink); }
.cl-vacio-txt { margin: 0; max-width: 42ch; font-size: 13.5px; line-height: 1.6; color: var(--muted); }
.cl-pie { margin: 14px 2px 0; font-size: 12px; font-weight: 600; color: var(--muted); }

/* Telefono: la grilla de 7 columnas no entra. Siempre agenda. */
@media (max-width: 699px) {
  .cl-cal { padding: 16px 14px 12px; border-radius: 24px; }
  .cl-mes-vista { display: none; }
  .cl-agenda { display: flex; }
  .cl-vistas { display: none; }
  .cl-nav { margin-left: auto; }
  .cl-pie { display: none; }
  .cl-fila { padding: 10px 12px; gap: 10px; }
  .cl-fila-ico { display: none; }
}
@media (prefers-reduced-motion: reduce) { .cl-ev, .cl-fila, .cl-flecha { transition: none; } }
`;
