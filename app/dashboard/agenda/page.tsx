import Link from "next/link";
import { CalendarDays, CalendarHeart, ChevronLeft, ChevronRight, ExternalLink, Lock, Mail, Sparkles, Video } from "lucide-react";
import { requireUser } from "@/src/features/auth/guards";
import { AdminCabecera } from "@/components/admin-ui";
import { cargarMiAgenda } from "@/src/features/studio/agenda";
import {
  agruparPorDia, celdasDelMes, claveDia, horaMadrid, mesDeParametro, mesVecino, nombreDia, nombreMes,
  rangoConsultaMes, recortarCelda, textoMas, type EventoCalendario, type TipoEvento,
} from "@/src/features/admin/calendario";

export const dynamic = "force-dynamic";

/**
 * Mi agenda: el calendario de la ALUMNA, con SOLO sus cosas.
 *
 *   · clases en vivo que reservo (o en lista de espera)       coral
 *   · clases en vivo a las que Brunela la invito              coral punteado
 *   · sus sesiones privadas 1 a 1, con "Unirse" si ya abrio  melocoton
 *   · fechas de su cuenta, de dia entero: fin del acceso
 *     gratis, fin de la prueba, renovacion o fin del plan    crema
 *   · opcional (?todas=1): las clases en vivo que su plan le
 *     deja reservar, aparte y apagadas                        contorno
 *
 * Mismo esqueleto que /admin/calendario y las MISMAS reglas puras
 * (src/features/admin/calendario.ts): dias en hora de Madrid, el mes en la URL
 * (?mes=2026-10), grilla en escritorio y agenda por dia en el telefono (o con
 * ?vista=agenda).
 *
 * Los datos salen de cargarMiAgenda, con el cliente DE ELLA: RLS decide. La
 * admin que entra por "Ver como alumna" ve SU agenda (normalmente vacia), sin
 * herramientas de gestion: eso vive en /admin/calendario.
 */
export default async function MiAgendaPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { user } = await requireUser();
  const params = (await searchParams) ?? {};
  const txt = (k: string) => (typeof params[k] === "string" ? (params[k] as string).trim() : "");

  const hoy = claveDia(Date.now());
  const mesHoy = hoy.slice(0, 7);
  const mes = mesDeParametro(txt("mes"), hoy);
  const vistaAgenda = txt("vista") === "agenda";
  const conDisponibles = txt("todas") === "1";

  const { desde, hasta } = rangoConsultaMes(mes);
  const { eventos } = await cargarMiAgenda(user.id, desde, hasta, { disponibles: conDisponibles });

  const delMes = (e: EventoCalendario) => claveDia(e.inicio).startsWith(mes);
  const mios = eventos.filter((e) => e.tipo !== "disponible");
  const disponibles = eventos.filter((e) => e.tipo === "disponible" && delMes(e)).sort((a, b) => Date.parse(a.inicio) - Date.parse(b.inicio));
  // En la grilla van juntas (apagadas las disponibles); en la agenda por dia,
  // solo las suyas: las disponibles tienen su propia seccion abajo.
  const porDiaGrilla = agruparPorDia(eventos, (k) => k.startsWith(mes));
  const porDia = agruparPorDia(mios, (k) => k.startsWith(mes));
  const celdas = celdasDelMes(mes);

  const url = (m: string, o: { agenda?: boolean; todas?: boolean; dia?: string } = {}) => {
    const agenda = o.agenda ?? vistaAgenda;
    const todas = o.todas ?? conDisponibles;
    const u = new URLSearchParams();
    if (m !== mesHoy) u.set("mes", m);
    if (agenda) u.set("vista", "agenda");
    if (todas) u.set("todas", "1");
    const t = u.toString();
    return "/dashboard/agenda" + (t ? "?" + t : "") + (o.dia ? "#d-" + o.dia : "");
  };

  const cuenta = (t: TipoEvento[]) => mios.filter((e) => t.includes(e.tipo) && delMes(e)).length;
  const nVivo = cuenta(["vivo", "invitacion"]);
  const nPrivadas = cuenta(["privada"]);
  const resumen = [
    `${nVivo} ${nVivo === 1 ? "clase en vivo" : "clases en vivo"}`,
    nPrivadas ? `${nPrivadas} ${nPrivadas === 1 ? "sesión privada" : "sesiones privadas"}` : null,
  ].filter(Boolean).join(" · ");

  return (
    <main className="ag">
      <style>{CSS}</style>

      <AdminCabecera
        eyebrow="Tu práctica"
        titulo="Mi agenda"
        lede="Tus clases en vivo, tus sesiones privadas y las fechas de tu cuenta, en un solo lugar. Horarios de Madrid."
      />

      <section className={"ag-cal" + (vistaAgenda ? " es-agenda" : "")} aria-label={`Mi agenda de ${nombreMes(mes)}`}>
        <header className="ag-cab">
          <span className="ag-ico" aria-hidden="true"><CalendarDays size={18} strokeWidth={2} /></span>
          <div className="ag-cab-txt">
            <h2 className="ag-titulo">{nombreMes(mes)}</h2>
            <p className="ag-resumen">{resumen}</p>
          </div>
          <nav className="ag-vistas" aria-label="Vista">
            <Link href={url(mes, { agenda: false }) as never} className={"ag-vista" + (!vistaAgenda ? " es-activa" : "")} aria-current={!vistaAgenda ? "page" : undefined}>Mes</Link>
            <Link href={url(mes, { agenda: true }) as never} className={"ag-vista" + (vistaAgenda ? " es-activa" : "")} aria-current={vistaAgenda ? "page" : undefined}>Agenda</Link>
          </nav>
          <div className="ag-nav">
            <Link href={url(mesVecino(mes, -1)) as never} className="ag-flecha" aria-label="Mes anterior"><ChevronLeft size={18} strokeWidth={2.2} /></Link>
            {mes !== mesHoy && <Link href={url(mesHoy) as never} className="ag-hoy-btn">Hoy</Link>}
            <Link href={url(mesVecino(mes, 1)) as never} className="ag-flecha" aria-label="Mes siguiente"><ChevronRight size={18} strokeWidth={2.2} /></Link>
          </div>
        </header>

        <div className="ag-barra">
          <div className="ag-leyenda">
            <span><i className="ag-pt ag-pt--vivo" aria-hidden="true" /> Clase en vivo</span>
            <span><i className="ag-pt ag-pt--invitacion" aria-hidden="true" /> Invitación</span>
            <span><i className="ag-pt ag-pt--privada" aria-hidden="true" /> Sesión privada</span>
            <span><i className="ag-pt ag-pt--cuenta" aria-hidden="true" /> Tu cuenta</span>
            {conDisponibles && <span><i className="ag-pt ag-pt--disponible" aria-hidden="true" /> Para reservar</span>}
          </div>
          <Link href={url(mes, { todas: !conDisponibles }) as never} className={"ag-toggle" + (conDisponibles ? " es-on" : "")} aria-pressed={conDisponibles}>
            <span className="ag-toggle-pista" aria-hidden="true"><span /></span>
            Clases que podés reservar
          </Link>
        </div>

        {/* ── Grilla del mes ── */}
        <div className="ag-mes-vista">
          <div className="ag-grilla" role="grid">
            {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((d) => <span key={d} className="ag-sem" role="columnheader">{d}</span>)}
            {celdas.map((k, i) => {
              if (!k) return <span key={"v" + i} className="ag-celda es-vacia" aria-hidden="true" />;
              const delDia = porDiaGrilla.get(k) ?? [];
              const { visibles, resto } = recortarCelda(delDia, 3);
              const clases = "ag-celda" + (k === hoy ? " es-hoy" : "") + (k < hoy ? " es-pasado" : "") + (delDia.length ? " con-eventos" : "");
              return (
                <div key={k} className={clases} role="gridcell" aria-label={`${nombreDia(k)}: ${delDia.length ? delDia.length + (delDia.length === 1 ? " cosa" : " cosas") : "libre"}`}>
                  {delDia.length ? (
                    <Link href={url(mes, { agenda: true, dia: k }) as never} className="ag-num" title="Ver el día en la agenda">{Number(k.slice(8))}</Link>
                  ) : (
                    <span className="ag-num">{Number(k.slice(8))}</span>
                  )}
                  <span className="ag-eventos">
                    {visibles.map((e) => <EventoCelda key={e.tipo + e.id} e={e} />)}
                    {resto > 0 && <Link href={url(mes, { agenda: true, dia: k }) as never} className="ag-mas">{textoMas(resto)}</Link>}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Agenda por dia (solo lo suyo) ── */}
        <div className="ag-agenda">
          {porDia.size === 0 ? (
            <div className="ag-vacio">
              <span className="ag-vacio-ico" aria-hidden="true"><CalendarHeart size={22} strokeWidth={2.2} /></span>
              <p className="ag-vacio-titulo">Nada agendado en {nombreMes(mes).toLowerCase()}.</p>
              <p className="ag-vacio-txt">Cuando reserves una clase en vivo o Brunela te agende una sesión, aparece acá.</p>
              <Link href={"/dashboard/live" as never} className="ag-vacio-btn">Ver clases en vivo</Link>
            </div>
          ) : (
            [...porDia.entries()].map(([k, lista]) => (
              <section key={k} id={"d-" + k} className={"ag-dia" + (k === hoy ? " es-hoy" : "") + (k < hoy ? " es-pasado" : "")}>
                <h3 className="ag-dia-titulo">
                  {nombreDia(k)}
                  {k === hoy && <span className="ag-dia-hoy">Hoy</span>}
                </h3>
                <ul className="ag-dia-lista">
                  {lista.map((e) => <EventoFila key={e.tipo + e.id} e={e} />)}
                </ul>
              </section>
            ))
          )}
        </div>

        <p className="ag-pie">Horarios de Madrid. Tocá un número de día para verlo en la agenda.</p>
      </section>

      {/* ── Las que puede reservar: aparte y distintas de las suyas ── */}
      {conDisponibles && (
        <section className="ag-disp" aria-labelledby="ag-disp-titulo">
          <h2 id="ag-disp-titulo" className="ag-disp-titulo">Clases en vivo que podés reservar</h2>
          <p className="ag-disp-sub">De tu plan, en {nombreMes(mes).toLowerCase()}. Todavía no son tuyas: reservá tu lugar desde la clase.</p>
          {disponibles.length === 0 ? (
            <p className="ag-disp-vacio">No hay otras clases en vivo para reservar este mes.</p>
          ) : (
            <ul className="ag-dia-lista">
              {disponibles.map((e) => <EventoFila key={"d" + e.id} e={e} conDia />)}
            </ul>
          )}
        </section>
      )}
    </main>
  );
}

const ESTADO_TEXTO: Record<string, string> = { borrador: "Borrador", cancelada: "Cancelada", hecha: "Hecha" };

function claseEvento(e: EventoCalendario) {
  return "ag-ev--" + e.tipo + (e.estado ? " es-" + e.estado : "");
}

function Icono({ tipo, size }: { tipo: TipoEvento; size: number }) {
  if (tipo === "privada") return <Lock size={size} strokeWidth={2.3} />;
  if (tipo === "invitacion") return <Mail size={size} strokeWidth={2.3} />;
  if (tipo === "cuenta") return <Sparkles size={size} strokeWidth={2.3} />;
  return <Video size={size} strokeWidth={2.3} />;
}

function EventoCelda({ e }: { e: EventoCalendario }) {
  const hora = e.todoElDia ? null : horaMadrid(e.inicio);
  const titulo = [hora ?? "Todo el día", e.titulo, e.detalle, e.estado ? ESTADO_TEXTO[e.estado] : null].filter(Boolean).join(" · ");
  return (
    <Link href={e.href as never} title={titulo} className={"ag-ev " + claseEvento(e)}>
      {hora ? <b>{hora}</b> : <span className="ag-ev-ico" aria-hidden="true"><Icono tipo={e.tipo} size={11} /></span>}
      <span className="ag-ev-txt">{e.titulo}</span>
    </Link>
  );
}

/**
 * Una fila de la agenda. El enlace principal y el boton "Unirse" van como
 * HERMANOS: un <a> dentro de otro <a> es HTML invalido y el navegador lo parte.
 */
function EventoFila({ e, conDia = false }: { e: EventoCalendario; conDia?: boolean }) {
  return (
    <li className={"ag-fila " + claseEvento(e)}>
      <Link href={e.href as never} className="ag-fila-link">
        <span className="ag-fila-hora">
          {conDia && <small>{nombreDia(claveDia(e.inicio)).split(" ").slice(0, 2).join(" ")}</small>}
          {e.todoElDia ? <span className="ag-fila-todo">Todo el día</span> : horaMadrid(e.inicio)}
        </span>
        <span className="ag-fila-ico" aria-hidden="true"><Icono tipo={e.tipo} size={16} /></span>
        <span className="ag-fila-cuerpo">
          <span className="ag-fila-titulo">{e.titulo}</span>
          <span className={"ag-fila-meta" + (e.alerta ? " es-alerta" : "")}>{e.detalle}</span>
        </span>
        {e.estado && <span className={"ag-chip es-" + e.estado}>{ESTADO_TEXTO[e.estado]}</span>}
      </Link>
      {e.accion && (
        <a href={e.accion.href} className="ag-unirse" {...(e.accion.externo ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
          {e.accion.texto} <ExternalLink size={13} strokeWidth={2.4} aria-hidden="true" />
        </a>
      )}
    </li>
  );
}

const CSS = `
.ag { max-width: 1320px; margin: 0 auto; padding: clamp(20px, 3vw, 40px) clamp(16px, 3.4vw, 48px) 80px; display: flex; flex-direction: column; gap: 20px; }

.ag-cal { border: 1px solid var(--linea); border-radius: 30px; background: linear-gradient(160deg, #FFF7F3, #fff 45%); box-shadow: var(--sombra); padding: 22px 22px 16px; }
.ag-cab { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 12px; }
.ag-ico { width: 40px; height: 40px; border-radius: 14px; display: grid; place-items: center; background: var(--rubor); color: var(--pink-deep); flex-shrink: 0; }
.ag-cab-txt { min-width: 0; }
.ag-titulo { margin: 0; font-size: 22px; font-weight: 900; letter-spacing: -0.02em; color: var(--ink); }
.ag-resumen { margin: 2px 0 0; font-size: 12.5px; font-weight: 700; color: var(--muted); }
.ag-vistas { margin-left: auto; display: inline-flex; padding: 4px; border-radius: 99px; background: var(--rubor); }
.ag-vista { height: 32px; padding: 0 14px; border-radius: 99px; display: inline-flex; align-items: center; font-size: 13px; font-weight: 800; color: var(--pink-deep); text-decoration: none; transition: background .2s; }
.ag-vista:hover { background: #fff; }
.ag-vista.es-activa { background: #fff; color: var(--ink); box-shadow: 0 4px 10px -6px rgba(176, 90, 80, .45); }
.ag-nav { display: flex; align-items: center; gap: 6px; }
.ag-flecha { width: 40px; height: 40px; border-radius: 50%; display: grid; place-items: center; background: #fff; border: 1.5px solid var(--linea-fuerte); color: var(--ink); transition: background .2s, border-color .2s, transform .3s var(--curva); }
.ag-flecha:hover { background: var(--rubor); border-color: var(--pink-line); transform: scale(1.06); }
.ag-hoy-btn { height: 40px; padding: 0 16px; border-radius: 99px; display: inline-flex; align-items: center; font-size: 13px; font-weight: 800; color: var(--pink-deep); background: var(--rubor); text-decoration: none; }

.ag-barra { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px 16px; margin: 0 2px 14px; }
.ag-leyenda { display: flex; flex-wrap: wrap; gap: 6px 16px; font-size: 12px; font-weight: 700; color: var(--muted); }
.ag-leyenda span { display: inline-flex; align-items: center; gap: 6px; }
.ag-pt { width: 10px; height: 10px; border-radius: 4px; display: inline-block; }
.ag-pt--vivo { background: var(--pink); }
.ag-pt--invitacion { background: #fff; border: 1.5px dashed var(--pink); }
.ag-pt--privada { background: var(--melocoton); border: 1.5px solid var(--melocoton-deep); }
.ag-pt--cuenta { background: var(--crema); border: 1.5px solid var(--pink-deep); border-radius: 50%; }
.ag-pt--disponible { background: #fff; border: 1.5px dashed var(--linea-fuerte); }
.ag-toggle { display: inline-flex; align-items: center; gap: 9px; height: 38px; padding: 0 14px 0 8px; border-radius: 99px; background: #fff; border: 1.5px solid var(--linea-fuerte); font-size: 13px; font-weight: 800; color: var(--ink); text-decoration: none; transition: border-color .2s, background .2s; }
.ag-toggle:hover { border-color: var(--pink-line); background: var(--crema); }
.ag-toggle-pista { width: 34px; height: 20px; border-radius: 99px; background: var(--linea-fuerte); position: relative; transition: background .2s; flex-shrink: 0; }
.ag-toggle-pista span { position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; border-radius: 50%; background: #fff; transition: transform .3s var(--curva); box-shadow: 0 1px 3px rgba(59,42,44,.25); }
.ag-toggle.es-on .ag-toggle-pista { background: var(--pink); }
.ag-toggle.es-on .ag-toggle-pista span { transform: translateX(14px); }

/* Grilla */
.ag-grilla { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 6px; }
.ag-sem { text-align: center; font-size: 12px; font-weight: 800; color: var(--muted); padding: 4px 0 6px; }
.ag-celda { position: relative; min-height: 108px; border-radius: 18px; padding: 8px; background: #fff; border: 1px solid #F6EAE4; display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.ag-celda.es-vacia { background: transparent; border-color: transparent; }
.ag-celda.es-pasado { background: #FFFCFA; }
.ag-celda.es-pasado .ag-num { color: #CDB3AB; }
.ag-celda.es-pasado .ag-ev { opacity: .7; }
.ag-celda.con-eventos { border-color: var(--linea); }
.ag-celda.es-hoy { border-color: var(--pink); box-shadow: 0 0 0 3px rgba(230,79,85,.12); }
.ag-num { align-self: flex-start; font-size: 13px; font-weight: 900; color: var(--ink); width: 26px; height: 26px; border-radius: 50%; display: grid; place-items: center; text-decoration: none; }
a.ag-num:hover, a.ag-num:focus-visible { background: var(--rubor); color: var(--pink-deep); }
.ag-celda.es-hoy .ag-num { background: var(--pink); color: #fff; }
.ag-eventos { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.ag-ev { display: flex; align-items: center; gap: 4px; padding: 3px 7px; border-radius: 8px; font-size: 11px; font-weight: 700; line-height: 1.35; white-space: nowrap; overflow: hidden; border-left: 3px solid transparent; text-decoration: none; transition: filter .2s, transform .2s var(--curva); }
.ag-ev:hover { filter: brightness(.96); transform: translateX(1px); }
.ag-ev:focus-visible { outline: 0; box-shadow: 0 0 0 2px #fff, 0 0 0 4px var(--pink); }
.ag-ev b { font-weight: 900; flex-shrink: 0; }
.ag-ev-ico { flex-shrink: 0; display: inline-flex; }
.ag-ev-txt { overflow: hidden; text-overflow: ellipsis; min-width: 0; }
.ag-ev--vivo { background: var(--pink-wash); color: var(--pink-deep); border-left-color: var(--pink); }
.ag-ev--invitacion { background: #fff; color: var(--pink-deep); border: 1px dashed var(--pink-line); border-left: 3px dashed var(--pink); }
.ag-ev--privada { background: var(--melocoton); color: var(--ink); border-left-color: var(--melocoton-deep); }
.ag-ev--cuenta { background: var(--crema); color: var(--pink-deep); border-left-color: var(--pink-deep); }
.ag-ev--disponible { background: #fff; color: var(--muted); border: 1px dashed var(--linea-fuerte); border-left: 3px dashed var(--linea-fuerte); }
.ag-ev.es-cancelada { background: #fff; color: var(--muted); border-left-color: var(--linea-fuerte); text-decoration: line-through; }
.ag-ev.es-hecha { opacity: .65; }
.ag-mas { align-self: flex-start; padding: 1px 7px; border-radius: 99px; font-size: 11px; font-weight: 800; color: var(--pink-deep); text-decoration: none; }
.ag-mas:hover { background: var(--rubor); text-decoration: underline; }

/* Agenda */
.ag-agenda { display: none; flex-direction: column; gap: 16px; }
.ag-cal.es-agenda .ag-mes-vista { display: none; }
.ag-cal.es-agenda .ag-agenda { display: flex; }
.ag-dia { scroll-margin-top: 24px; }
.ag-dia-titulo { display: flex; align-items: center; gap: 8px; margin: 0 0 8px; font-size: 15px; font-weight: 900; letter-spacing: -0.01em; color: var(--ink); }
.ag-dia.es-pasado .ag-dia-titulo { color: var(--muted); }
.ag-dia-hoy { padding: 2px 10px; border-radius: 99px; background: var(--pink); color: #fff; font-size: 11.5px; font-weight: 800; }
.ag-dia:target .ag-dia-titulo { color: var(--pink-deep); }
.ag-dia-lista { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.ag-fila { display: flex; align-items: center; gap: 8px; border-radius: 18px; background: #fff; border: 1px solid var(--linea); border-left: 4px solid transparent; padding-right: 10px; transition: box-shadow .3s, transform .3s var(--curva); }
.ag-fila:hover { box-shadow: var(--sombra); transform: translateY(-1px); }
.ag-fila-link { flex: 1; min-width: 0; display: flex; align-items: center; gap: 12px; padding: 12px 4px 12px 14px; text-decoration: none; color: var(--ink); border-radius: 16px; }
.ag-fila-link:focus-visible { outline: 3px solid rgba(230,79,85,.45); outline-offset: 2px; }
.ag-fila.ag-ev--vivo { border-left-color: var(--pink); }
.ag-fila.ag-ev--invitacion { border-left: 4px dashed var(--pink); }
.ag-fila.ag-ev--privada { border-left-color: var(--melocoton-deep); background: linear-gradient(120deg, #FFF4EC, #fff 60%); }
.ag-fila.ag-ev--cuenta { border-left-color: var(--pink-deep); background: linear-gradient(120deg, #FFF8F3, #fff 60%); }
.ag-fila.ag-ev--disponible { border: 1.5px dashed var(--linea-fuerte); background: #FFFCFA; }
.ag-fila.ag-ev--disponible .ag-fila-titulo { color: #5A4440; }
.ag-fila.es-cancelada .ag-fila-titulo { text-decoration: line-through; color: var(--muted); }
.ag-fila.es-hecha { opacity: .7; }
.ag-dia.es-pasado .ag-fila { opacity: .75; }
.ag-fila-hora { width: 56px; flex-shrink: 0; display: flex; flex-direction: column; font-size: 14px; font-weight: 900; font-variant-numeric: tabular-nums; }
.ag-fila-hora small { font-size: 11px; font-weight: 800; color: var(--muted); text-transform: capitalize; }
.ag-fila-todo { font-size: 11.5px; font-weight: 800; line-height: 1.2; color: var(--pink-deep); }
.ag-fila-ico { width: 34px; height: 34px; border-radius: 12px; flex-shrink: 0; display: grid; place-items: center; }
.ag-ev--vivo .ag-fila-ico, .ag-ev--invitacion .ag-fila-ico { background: var(--pink-wash); color: var(--pink-deep); }
.ag-ev--privada .ag-fila-ico { background: var(--melocoton); color: var(--melocoton-deep); }
.ag-ev--cuenta .ag-fila-ico { background: var(--crema); color: var(--pink-deep); border: 1px solid var(--linea); }
.ag-ev--disponible .ag-fila-ico { background: #fff; color: var(--muted); border: 1px dashed var(--linea-fuerte); }
.ag-fila-cuerpo { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.ag-fila-titulo { font-size: 14.5px; font-weight: 800; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ag-fila-meta { font-size: 12.5px; font-weight: 600; color: var(--muted); }
.ag-fila-meta.es-alerta { color: var(--pink-deep); font-weight: 800; }
.ag-chip { flex-shrink: 0; padding: 3px 10px; border-radius: 99px; font-size: 11.5px; font-weight: 800; background: var(--crema); color: var(--muted); border: 1px solid var(--linea); }
.ag-unirse { flex-shrink: 0; display: inline-flex; align-items: center; gap: 6px; height: 38px; padding: 0 16px; border-radius: 99px; background: var(--pink); color: #fff; font-size: 13.5px; font-weight: 800; text-decoration: none; box-shadow: 0 10px 20px -12px rgba(230,79,85,.9); transition: background .2s, transform .3s var(--curva); }
.ag-unirse:hover { background: var(--pink-mid); transform: translateY(-1px); }

.ag-vacio { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 40px 20px; text-align: center; border-radius: 24px; background: var(--crema); border: 1.5px dashed var(--linea-fuerte); }
.ag-vacio-ico { width: 46px; height: 46px; border-radius: 16px; display: grid; place-items: center; background: #fff; color: var(--pink-deep); box-shadow: var(--sombra); }
.ag-vacio-titulo { margin: 0; font-size: 18px; font-weight: 900; color: var(--ink); }
.ag-vacio-txt { margin: 0; max-width: 42ch; font-size: 13.5px; line-height: 1.6; color: var(--muted); }
.ag-vacio-btn { margin-top: 4px; display: inline-flex; align-items: center; height: 42px; padding: 0 18px; border-radius: 99px; background: #fff; border: 1.5px solid var(--linea-fuerte); color: var(--ink); font-size: 13.5px; font-weight: 800; text-decoration: none; }
.ag-vacio-btn:hover { background: var(--rubor); border-color: var(--pink-line); }
.ag-pie { margin: 14px 2px 0; font-size: 12px; font-weight: 600; color: var(--muted); }

/* Las que puede reservar: otra seccion, otro peso visual. */
.ag-disp { border-radius: 26px; padding: 20px 22px; background: #FFFCFA; border: 1.5px dashed var(--linea-fuerte); display: flex; flex-direction: column; gap: 10px; }
.ag-disp-titulo { margin: 0; font-size: 18px; font-weight: 900; letter-spacing: -0.01em; color: var(--ink); }
.ag-disp-sub { margin: 0; font-size: 13px; line-height: 1.55; color: var(--muted); }
.ag-disp-vacio { margin: 0; font-size: 13.5px; color: var(--muted); }

/* Telefono: la grilla de 7 columnas no entra. Siempre agenda. */
@media (max-width: 699px) {
  .ag-cal { padding: 16px 14px 12px; border-radius: 24px; }
  .ag-mes-vista { display: none; }
  .ag-agenda { display: flex; }
  .ag-vistas { display: none; }
  .ag-nav { margin-left: auto; }
  .ag-pie { display: none; }
  .ag-fila-link { padding: 10px 2px 10px 12px; gap: 10px; }
  .ag-fila-ico { display: none; }
  .ag-fila { flex-wrap: wrap; padding-right: 0; }
  .ag-unirse { margin: 0 12px 12px auto; }
  .ag-disp { padding: 16px 14px; }
}
@media (prefers-reduced-motion: reduce) { .ag-ev, .ag-fila, .ag-flecha, .ag-toggle-pista span, .ag-unirse { transition: none; } }
`;
