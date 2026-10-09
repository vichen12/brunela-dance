"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import {
  motion, MotionConfig, animate, useInView, useMotionValue, useReducedMotion, useTransform,
  type Variants,
} from "motion/react";
import {
  ArrowRight, ArrowUpRight, BadgeCheck, CalendarHeart, ListChecks, Lock, Megaphone, Plus, Play,
  PlayCircle, Upload, User, UserPlus, Users, Video,
} from "lucide-react";
import { Saludo } from "@/components/saludo";
import { HoraSesion } from "@/components/hora-sesion";
import { RecordatoriosAdmin } from "@/components/recordatorios-admin";
import type { RecordatoriosAdminDatos } from "@/src/features/admin/recordatorios";

/*
 * Panel del estudio: la portada del dashboard para una cuenta admin.
 *
 * DIRECCION
 *   Suave y calida, como el resto del sistema desde el rediseno de 2026-10:
 *   una tarjeta de bienvenida en rubor, cifras en tarjetas pastel, clases con
 *   portada redondeada y estados en pastillas (salvia publicada, melocoton
 *   borrador). Nada oscuro: la version editorial anterior tenia un boton negro
 *   y filetes de tinta que la duena pidio sacar.
 *
 * POR QUE ES DE CLIENTE
 *   Solo por las animaciones. Los datos se leen en el servidor y llegan como
 *   numeros y cadenas; los iconos se eligen de este lado, porque una funcion no
 *   puede cruzar la frontera servidor -> cliente como prop (trampa 6).
 *
 * Con "reducir movimiento" activado en el sistema, MotionConfig apaga las
 * transiciones y los contadores arrancan en el numero final.
 */

export type TierClave = "none" | "corps_de_ballet" | "solista" | "principal";

export type DatosPanel = {
  /** Nombre de pila real, o null si el perfil no tiene. Nunca el usuario del correo. */
  nombre: string | null;
  fecha: string;
  metricas: {
    alumnas: number;
    altasDelMes: number;
    conPlan: number;
    principal: number;
    sinPlan: number;
    reservas: number;
    sesiones: number;
    publicadas: number;
    borradores: number;
    totales: number;
    anuncios: number;
  };
  porPlan: { tier: TierClave; cantidad: number }[];
  /**
   * nombre null = el perfil no tiene nombre cargado. `correo` es opcional: si
   * llega, sin nombre se muestra su prefijo, igual que la lista de alumnas.
   */
  ultimas: { id: string; nombre: string | null; correo?: string | null; tier: TierClave; cuando: string }[];
  clases: { id: string; titulo: string; estado: string; portada: string | null; minutos: number | null }[];
  enVivo: { id: string; titulo: string; iso: string; zona: string; reservas: number }[];
  /** Enlaces sin cargar, la clase de hoy y las que faltan completar. */
  recordatorios?: RecordatoriosAdminDatos;
};

/** color: relleno de la barra y marcas. tinta: texto, con contraste sobre claro. chip: clase de la pastilla. */
const TIER: Record<TierClave, { label: string; color: string; tinta: string; chip: string }> = {
  principal:       { label: "Principal",       color: "#E64F55", tinta: "#B03A3E", chip: "pc-tier--principal" },
  solista:         { label: "Solista",         color: "#F59A8E", tinta: "#B03A3E", chip: "pc-tier--solista" },
  corps_de_ballet: { label: "Corps de Ballet", color: "#FFC9B0", tinta: "#B03A3E", chip: "pc-tier--corps" },
  none:            { label: "Sin plan",        color: "#EADFD9", tinta: "#8A6F68", chip: "pc-tier--none" },
};

const ESTADO: Record<string, { label: string; clase: string }> = {
  published: { label: "Publicada", clase: "pc-estado--pub" },
  draft:     { label: "Borrador",  clase: "pc-estado--borr" },
  scheduled: { label: "Programada", clase: "pc-estado--borr" },
  archived:  { label: "Archivada", clase: "pc-estado--arch" },
};

const SUAVE = [0.22, 1, 0.36, 1] as const;

const grupo: Variants = {
  oculto: {},
  visible: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
};

const sube: Variants = {
  oculto: { opacity: 0, y: 16, scale: 0.985 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.7, ease: SUAVE } },
};

/** Numero que cuenta desde 0 la primera vez que entra en pantalla. */
function Contador({ valor }: { valor: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const enVista = useInView(ref, { once: true });
  const reducir = useReducedMotion();
  const mv = useMotionValue(reducir ? valor : 0);
  const texto = useTransform(mv, (v) => Math.round(v).toLocaleString("es-ES"));

  useEffect(() => {
    if (!enVista) return;
    if (reducir) { mv.set(valor); return; }
    const control = animate(mv, valor, { duration: 1.4, ease: SUAVE });
    return () => control.stop();
  }, [enVista, valor, reducir, mv]);

  return <motion.span ref={ref}>{texto}</motion.span>;
}

/** Dia y mes en la zona DEL ESTUDIO: es la misma en servidor y cliente. */
function partesFecha(iso: string, zona: string) {
  try {
    const d = new Date(iso);
    return {
      dia: new Intl.DateTimeFormat("es-ES", { day: "numeric", timeZone: zona }).format(d),
      mes: new Intl.DateTimeFormat("es-ES", { month: "short", timeZone: zona }).format(d).replace(".", ""),
      semana: new Intl.DateTimeFormat("es-ES", { weekday: "long", timeZone: zona }).format(d),
    };
  } catch {
    return { dia: "—", mes: "", semana: "" };
  }
}

/** Lo que se muestra de una alta: su nombre o, si no tiene, el prefijo del correo. */
function nombreVisible(u: { nombre: string | null; correo?: string | null }): string | null {
  if (u.nombre) return u.nombre;
  const prefijo = u.correo?.split("@")[0]?.trim();
  return prefijo || null;
}

/**
 * `secundario`: el segundo boton de la cabecera. Desde /dashboard lleva a
 * /admin; dentro de /admin eso seria un enlace a si mismo, y ahi va otro.
 */
export function PanelControlAdmin({
  datos,
  secundario = { href: "/admin", label: "Panel completo" },
}: {
  datos: DatosPanel;
  secundario?: { href: string; label: string };
}) {
  const m = datos.metricas;
  const total = datos.porPlan.reduce((a, p) => a + p.cantidad, 0);
  const huecos = Math.max(0, 4 - datos.clases.length);

  const cifras = [
    { valor: m.alumnas,    label: "Alumnas",           sub: `+${m.altasDelMes} este mes`, href: "/admin/users", Icono: Users },
    { valor: m.conPlan,    label: "Con plan activo",   sub: `${m.principal} en Principal`, href: "/admin/users?plan=con-plan", Icono: BadgeCheck },
    { valor: m.publicadas, label: "Clases publicadas", sub: `${m.borradores} ${m.borradores === 1 ? "borrador" : "borradores"} · ${m.totales} en total`, href: "/admin/videos?estado=published", Icono: PlayCircle },
    { valor: m.reservas,   label: "Reservas en vivo",  sub: `${m.sesiones} ${m.sesiones === 1 ? "sesión" : "sesiones"} en agenda`, href: "/admin/live?estado=scheduled", Icono: CalendarHeart },
  ];

  const atajos = [
    { href: "/admin/videos?nueva=1#nueva", label: "Subir una clase",    sub: "Video, categoría y planes", Icono: Upload },
    { href: "/admin/live",                 label: "Programar en vivo",  sub: "Sesión por Zoom o Meet", Icono: Video },
    { href: "/admin/announcements",        label: "Publicar un anuncio", sub: `${m.anuncios} ${m.anuncios === 1 ? "activo" : "activos"} ahora`, Icono: Megaphone },
    { href: "/admin/programs",             label: "Armar un plan",      sub: "Planes de trabajo por día", Icono: ListChecks },
    // Crear una alumna solo estaba en un bloque plegado de /admin/users.
    { href: "/admin/users?nueva=1#nueva",  label: "Invitar alumna",     sub: "Le llega por mail", Icono: UserPlus },
    { href: "/admin/sesiones-privadas",    label: "Sesión privada",     sub: "Agendar uno a uno", Icono: Lock },
  ];

  return (
    <MotionConfig reducedMotion="user">
      <style>{CSS}</style>
      <div className="pc">

        {/* ── Bienvenida ── */}
        <motion.header
          className="pc-mast"
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: SUAVE }}
        >
          <div className="pc-mast-texto">
            <p className="pc-eyebrow"><span aria-hidden="true" />{datos.fecha.charAt(0).toUpperCase() + datos.fecha.slice(1)}</p>
            <h1 className="pc-titulo">
              <Saludo />{datos.nombre ? <>, <span className="pc-titulo-nombre">{datos.nombre}</span>.</> : "."}
            </h1>
            <p className="pc-lede">Así está tu estudio hoy. Todo lo importante, a un toque.</p>
          </div>
          <div className="pc-mast-acciones">
            <Link href="/admin/videos?nueva=1#nueva" className="pc-btn pc-btn--lleno">
              <Upload size={16} strokeWidth={2.2} aria-hidden="true" /> Subir clase
            </Link>
            <Link href={secundario.href as never} className="pc-btn">
              {secundario.label} <ArrowUpRight size={15} strokeWidth={2.2} aria-hidden="true" />
            </Link>
          </div>
        </motion.header>

        {/* ── Recordatorios: lo que hay que hacer ya con las clases en vivo ── */}
        {datos.recordatorios && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.1, ease: SUAVE }} className="pc-recordatorios">
            <RecordatoriosAdmin datos={datos.recordatorios} volverA="/admin/live" />
          </motion.div>
        )}

        {/* ── Cifras ── */}
        <motion.div className="pc-cifras" variants={grupo} initial="oculto" animate="visible">
          {cifras.map((c) => (
            <motion.div key={c.label} variants={sube}>
              <Link href={c.href as never} className="pc-cifra">
                <span className="pc-cifra-cab">
                  <span className="pc-cifra-ico" aria-hidden="true"><c.Icono size={18} strokeWidth={2} /></span>
                  <ArrowUpRight size={15} strokeWidth={2.2} className="pc-cifra-flecha" aria-hidden="true" />
                </span>
                <span className="pc-cifra-num"><Contador valor={c.valor} /></span>
                <span className="pc-cifra-label">{c.label}</span>
                <span className="pc-cifra-sub">{c.sub}</span>
              </Link>
            </motion.div>
          ))}
        </motion.div>

        <div className="pc-cuerpo">

          {/* ── Columna principal ── */}
          <motion.div className="pc-principal" variants={grupo} initial="oculto" animate="visible">

            <motion.section variants={sube} className="pc-bloque">
              <div className="pc-cab">
                <h2 className="pc-h2"><span className="pc-h2-ico" aria-hidden="true"><Play size={15} strokeWidth={2.4} /></span>Clases recientes</h2>
                <Link href="/admin/videos" className="pc-mas">Ver todas <ArrowRight size={14} strokeWidth={2.2} aria-hidden="true" /></Link>
              </div>
              <div className="pc-clases">
                {datos.clases.map((c) => {
                  const e = ESTADO[c.estado] ?? { label: c.estado, clase: "pc-estado--borr" };
                  return (
                    <motion.div key={c.id} whileHover="hover" initial="reposo">
                      <Link href={`/admin/videos?q=${encodeURIComponent(c.titulo)}` as never} className="pc-clase">
                        <div className="pc-clase-img">
                          {c.portada ? (
                            <motion.img
                              src={c.portada} alt=""
                              variants={{ reposo: { scale: 1 }, hover: { scale: 1.06 } }}
                              transition={{ duration: 0.8, ease: SUAVE }}
                            />
                          ) : (
                            <div className="pc-clase-sinimg">
                              <motion.span
                                className="pc-clase-play"
                                variants={{ reposo: { scale: 1 }, hover: { scale: 1.1 } }}
                                transition={{ type: "spring", stiffness: 300, damping: 16 }}
                              >
                                <Play size={18} strokeWidth={2} fill="currentColor" aria-hidden="true" />
                              </motion.span>
                            </div>
                          )}
                          <span className={"pc-estado " + e.clase}><span className="pc-punto" aria-hidden="true" />{e.label}</span>
                        </div>
                        <p className="pc-clase-titulo">{c.titulo}</p>
                        <p className="pc-clase-meta">{c.minutos ? `${c.minutos} min` : "Sin duración"}</p>
                      </Link>
                    </motion.div>
                  );
                })}
                {Array.from({ length: huecos }).map((_, i) => (
                  <Link key={"hueco" + i} href="/admin/videos?nueva=1#nueva" className={"pc-hueco" + (i > 0 ? " pc-hueco--extra" : "")}>
                    <motion.span
                      className="pc-hueco-ico"
                      whileHover={{ rotate: 90, scale: 1.1 }}
                      transition={{ type: "spring", stiffness: 300, damping: 14 }}
                    >
                      <Plus size={20} strokeWidth={2.2} aria-hidden="true" />
                    </motion.span>
                    {i === 0 && <span className="pc-hueco-txt">Subir una clase</span>}
                  </Link>
                ))}
              </div>
            </motion.section>

            <motion.section variants={sube} className="pc-bloque">
              <div className="pc-cab">
                <h2 className="pc-h2"><span className="pc-h2-ico" aria-hidden="true"><Video size={15} strokeWidth={2.2} /></span>Próximas en vivo</h2>
                <Link href="/admin/live" className="pc-mas">Agenda <ArrowRight size={14} strokeWidth={2.2} aria-hidden="true" /></Link>
              </div>
              {datos.enVivo.length === 0 ? (
                <Link href="/admin/live" className="pc-vivo-vacio">
                  <span className="pc-vivo-vacio-ico" aria-hidden="true"><CalendarHeart size={20} strokeWidth={2} /></span>
                  <span className="pc-vivo-vacio-txt">
                    <strong>No hay ninguna sesión en agenda.</strong>
                    <span>Cuando programes una, aparece acá con sus reservas.</span>
                  </span>
                  <span className="pc-vivo-vacio-cta">Programar una <ArrowRight size={14} strokeWidth={2.2} aria-hidden="true" /></span>
                </Link>
              ) : (
                <ul className="pc-vivo">
                  {datos.enVivo.map((s) => {
                    const f = partesFecha(s.iso, s.zona);
                    return (
                      <motion.li key={s.id} whileHover={{ x: 4 }} transition={{ type: "spring", stiffness: 300, damping: 24 }}>
                        <Link href={`/admin/live?q=${encodeURIComponent(s.titulo)}` as never} className="pc-vivo-fila">
                          <span className="pc-vivo-fecha">
                            <span className="pc-vivo-dia">{f.dia}</span>
                            <span className="pc-vivo-mes">{f.mes}</span>
                          </span>
                          <span className="pc-vivo-txt">
                            <span className="pc-vivo-titulo">{s.titulo}</span>
                            <span className="pc-vivo-hora">
                              <span style={{ textTransform: "capitalize" }}>{f.semana}</span> · <HoraSesion iso={s.iso} zonaEstudio={s.zona} />
                            </span>
                          </span>
                          <span className="pc-vivo-res">
                            <strong>{s.reservas}</strong> {s.reservas === 1 ? "reserva" : "reservas"}
                          </span>
                        </Link>
                      </motion.li>
                    );
                  })}
                </ul>
              )}
            </motion.section>
          </motion.div>

          {/* ── Columna lateral ── */}
          <motion.aside className="pc-lateral" variants={grupo} initial="oculto" animate="visible">

            <motion.section variants={sube} className="pc-estudio">
              <div className="pc-estudio-a">
                <div className="pc-estudio-cab">
                  <p className="pc-estudio-eyebrow">Tu estudio</p>
                  <Link href="/admin/users" className="pc-estudio-link">Alumnas <ArrowUpRight size={13} strokeWidth={2.2} aria-hidden="true" /></Link>
                </div>
                <div className="pc-estudio-total">
                  <span className="pc-estudio-num"><Contador valor={total} /></span>
                  <span className="pc-estudio-total-txt">
                    <span>{total === 1 ? "alumna" : "alumnas"}</span>
                    <span className="pc-estudio-altas">+{m.altasDelMes} este mes</span>
                  </span>
                </div>

                {/* Una barra redondeada partida por plan: se lee igual con 4 que
                    con 400 alumnas, y cada tramo tiene el color de su pastilla. */}
                <div
                  className="pc-barra" role="img"
                  aria-label={datos.porPlan.map((p) => TIER[p.tier].label + ": " + p.cantidad).join(", ")}
                >
                  {total === 0 ? (
                    <span className="pc-barra-vacia" />
                  ) : (
                    datos.porPlan.filter((p) => p.cantidad > 0).map((p, i) => (
                      <motion.a
                        key={p.tier}
                        href={`/admin/users?plan=${p.tier}`}
                        title={`${TIER[p.tier].label}: ${p.cantidad}`}
                        className="pc-barra-tramo"
                        style={{ background: TIER[p.tier].color }}
                        initial={{ flexGrow: 0 }}
                        animate={{ flexGrow: p.cantidad }}
                        transition={{ duration: 1.1, delay: 0.3 + i * 0.08, ease: SUAVE }}
                      />
                    ))
                  )}
                </div>

                <ul className="pc-reparto">
                  {datos.porPlan.map((p) => {
                    const pct = total > 0 ? Math.round((p.cantidad / total) * 100) : 0;
                    return (
                      <li key={p.tier}>
                        <Link href={`/admin/users?plan=${p.tier}` as never} className="pc-reparto-fila">
                          <span className="pc-reparto-marca" style={{ background: TIER[p.tier].color }} />
                          <span className="pc-reparto-nombre">{TIER[p.tier].label}</span>
                          <span className="pc-reparto-pct">{pct}%</span>
                          <span className="pc-reparto-num">{p.cantidad}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>

              <div className="pc-estudio-sep" />

              <div className="pc-estudio-b">
                <div className="pc-estudio-cab">
                  <p className="pc-estudio-eyebrow">Últimas altas</p>
                  <Link href="/admin/users" className="pc-estudio-link">Ver todas <ArrowUpRight size={13} strokeWidth={2.2} aria-hidden="true" /></Link>
                </div>
                {datos.ultimas.length === 0 ? (
                  <p className="pc-estudio-vacio">Todavía no hay alumnas.</p>
                ) : (
                  <ul className="pc-altas">
                    {datos.ultimas.slice(0, 5).map((u) => {
                      const t = TIER[u.tier] ?? TIER.none;
                      const visible = nombreVisible(u);
                      return (
                        // La fila lleva a SU perfil (enlace estirado sobre toda la fila);
                        // la pastilla del plan, a la lista de ese plan. Dos enlaces
                        // hermanos: un <a> dentro de otro no es HTML valido.
                        <li key={u.id} className="pc-altas-fila">
                          <span className="pc-inicial">
                            {visible ? visible.trim()[0]?.toUpperCase() : <User size={15} strokeWidth={2} aria-hidden="true" />}
                          </span>
                          <span className="pc-altas-txt">
                            <Link href={`/admin/users/${u.id}` as never} className="pc-altas-perfil">
                              {visible
                                ? <span className="pc-altas-nombre">{visible}</span>
                                : <span className="pc-altas-nombre pc-altas-nombre--sin">Sin nombre cargado</span>}
                            </Link>
                            <Link href={`/admin/users?plan=${u.tier}` as never} className={"pc-tier pc-tier--link " + t.chip} title={`Ver todas las de ${t.label}`}>{t.label}</Link>
                          </span>
                          <span className="pc-altas-cuando">{u.cuando}</span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </motion.section>

          </motion.aside>
        </div>

        {/* ── Atajos, a lo ancho ── */}
        <motion.section className="pc-atajos" variants={grupo} initial="oculto" animate="visible" aria-label="Atajos">
          <h2 className="pc-atajos-titulo">Atajos</h2>
          <ol>
            {atajos.map((a) => (
              <motion.li key={a.href} variants={sube} whileHover="hover">
                <Link href={a.href as never} className="pc-atajo">
                  <motion.span
                    className="pc-atajo-ico" aria-hidden="true"
                    variants={{ hover: { rotate: -8, scale: 1.08 } }}
                    transition={{ type: "spring", stiffness: 300, damping: 14 }}
                  >
                    <a.Icono size={19} strokeWidth={2} />
                  </motion.span>
                  <span className="pc-atajo-txt">
                    <span className="pc-atajo-label">{a.label}</span>
                    <span className="pc-atajo-sub">{a.sub}</span>
                  </span>
                  <ArrowRight size={16} strokeWidth={2.2} className="pc-atajo-flecha" aria-hidden="true" />
                </Link>
              </motion.li>
            ))}
          </ol>
        </motion.section>
      </div>
    </MotionConfig>
  );
}

const CSS = `
.pc { display: flex; flex-direction: column; gap: 22px; }
.pc-recordatorios .rca { margin-bottom: 0; }
.pc a:focus { outline: none; }
.pc a:focus-visible { outline: 0; box-shadow: 0 0 0 4px rgba(230,79,85,.22); }

/* ── bienvenida ── */
.pc-mast {
  position: relative; overflow: hidden; isolation: isolate;
  display: flex; align-items: center; justify-content: space-between; gap: 20px 28px; flex-wrap: wrap;
  padding: clamp(24px, 3.4vw, 42px) clamp(22px, 3.4vw, 46px);
  border-radius: 32px; border: 1px solid var(--linea);
  background: linear-gradient(120deg, #FFF1EC 0%, #FFF7F3 55%, #FFEFE6 100%);
}
.pc-mast::before, .pc-mast::after { content: ""; position: absolute; z-index: -1; border-radius: 50%; pointer-events: none; }
.pc-mast::before { width: 340px; height: 340px; right: -90px; top: -170px; background: radial-gradient(circle, rgba(255,205,185,.8), transparent 68%); animation: pc-flota 12s ease-in-out infinite alternate; }
.pc-mast::after { width: 240px; height: 240px; right: 26%; bottom: -160px; background: radial-gradient(circle, rgba(242,198,198,.7), transparent 70%); animation: pc-flota 15s ease-in-out infinite alternate-reverse; }
@keyframes pc-flota { from { transform: translate(0, 0) scale(1); } to { transform: translate(-24px, 18px) scale(1.08); } }
.pc-mast-texto { min-width: 0; }
.pc-eyebrow {
  display: inline-flex; align-items: center; gap: 8px; margin-bottom: 14px; padding: 6px 13px 6px 10px; border-radius: 99px;
  background: #fff; box-shadow: var(--sombra); font-size: 12.5px; font-weight: 800; color: var(--pink-deep);
}
.pc-eyebrow span { width: 8px; height: 8px; border-radius: 50%; background: var(--pink); }
.pc-titulo { font-weight: 900; font-size: clamp(32px, 4.2vw, 54px); line-height: 1.06; letter-spacing: -0.03em; color: var(--ink); }
.pc-titulo-nombre { color: var(--pink); }
.pc-lede { margin-top: 10px; font-size: 15.5px; line-height: 1.6; color: var(--muted); }
.pc-mast-acciones { display: flex; gap: 10px; flex-wrap: wrap; }
.pc-btn {
  display: inline-flex; align-items: center; gap: 8px; white-space: nowrap;
  height: 48px; padding: 0 22px; border-radius: 99px; text-decoration: none;
  font-size: 14px; font-weight: 800; color: var(--ink); background: #fff; border: 1.5px solid var(--linea-fuerte);
  transition: border-color .2s, background .2s, transform .3s var(--curva), box-shadow .3s;
}
.pc-btn:hover { border-color: var(--pink-line); background: var(--rubor); transform: translateY(-2px); }
.pc-btn--lleno { background: var(--pink); border-color: var(--pink); color: #fff; box-shadow: 0 14px 26px -14px rgba(230,79,85,.85); }
.pc-btn--lleno:hover { background: var(--pink-mid); border-color: var(--pink-mid); }

/* ── cifras ── */
.pc-cifras { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; }
.pc-cifras > div { min-width: 0; }
.pc-cifra {
  position: relative; display: flex; flex-direction: column; gap: 4px; height: 100%;
  padding: 18px 20px 20px; text-decoration: none; color: inherit;
  border-radius: var(--radio); border: 1px solid var(--linea); box-shadow: var(--sombra);
  transition: transform .35s var(--curva), box-shadow .35s, border-color .25s;
}
.pc-cifras > div:nth-child(1) .pc-cifra { background: linear-gradient(160deg, #FFF1EC, #fff 72%); }
.pc-cifras > div:nth-child(2) .pc-cifra { background: linear-gradient(160deg, #FFF4E8, #fff 72%); }
.pc-cifras > div:nth-child(3) .pc-cifra { background: linear-gradient(160deg, #FFF4E8, #fff 72%); }
.pc-cifras > div:nth-child(4) .pc-cifra { background: linear-gradient(160deg, #FFF0EA, #fff 72%); }
.pc-cifra:hover { transform: translateY(-3px); box-shadow: var(--sombra-alta); border-color: var(--linea-fuerte); }
.pc-cifra-cab { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
.pc-cifra-ico { width: 40px; height: 40px; border-radius: 14px; display: grid; place-items: center; background: #fff; color: var(--pink-deep); box-shadow: 0 8px 18px -12px rgba(176,90,80,.55); }
.pc-cifras > div:nth-child(2) .pc-cifra-ico { color: var(--melocoton-deep); }
.pc-cifras > div:nth-child(3) .pc-cifra-ico { color: var(--melocoton-deep); }
.pc-cifras > div:nth-child(4) .pc-cifra-ico { color: #B4533A; }
.pc-cifra-flecha { color: #C9AFA7; transition: transform .3s var(--curva), color .2s; }
.pc-cifra:hover .pc-cifra-flecha { color: var(--pink-deep); transform: translate(2px, -2px); }
.pc-cifra-num { font-weight: 900; font-size: clamp(34px, 3.2vw, 44px); line-height: 1; letter-spacing: -0.03em; color: var(--ink); font-variant-numeric: lining-nums tabular-nums; }
.pc-cifra-label { margin-top: 4px; font-size: 14px; font-weight: 800; color: var(--ink); }
.pc-cifra-sub { font-size: 12.5px; font-weight: 600; color: var(--muted); }

/* ── cuerpo ── */
.pc-cuerpo { display: grid; grid-template-columns: minmax(0, 1fr) minmax(300px, 380px); gap: 22px; align-items: start; }
.pc-principal { display: flex; flex-direction: column; gap: 22px; min-width: 0; }
.pc-bloque { padding: 22px 22px 24px; border-radius: 28px; background: #fff; border: 1px solid var(--linea); box-shadow: var(--sombra); }
.pc-cab { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 18px; }
.pc-h2 { display: flex; align-items: center; gap: 10px; font-weight: 900; font-size: 20px; letter-spacing: -0.02em; color: var(--ink); line-height: 1.1; }
.pc-h2-ico { width: 34px; height: 34px; border-radius: 12px; display: grid; place-items: center; background: var(--rubor); color: var(--pink-deep); }
.pc-mas {
  display: inline-flex; align-items: center; gap: 6px; text-decoration: none; white-space: nowrap;
  padding: 7px 14px; border-radius: 99px; font-size: 13px; font-weight: 800; color: var(--pink-deep); background: var(--rubor);
  transition: background .2s;
}
.pc-mas:hover { background: var(--pink-wash); }

/* clases */
.pc-clases { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; }
.pc-clase { display: block; text-decoration: none; color: inherit; }
.pc-clase-img {
  position: relative; aspect-ratio: 4 / 5; border-radius: 22px; overflow: hidden;
  background:
    radial-gradient(130px 110px at 85% 12%, rgba(255,205,185,.95), transparent 70%),
    linear-gradient(160deg, #FFF1EC, #FDE3E0);
  transition: box-shadow .35s;
}
.pc-clase:hover .pc-clase-img { box-shadow: var(--sombra-alta); }
.pc-clase-img img { width: 100%; height: 100%; object-fit: cover; display: block; }
.pc-clase-sinimg { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; }
.pc-clase-play { width: 50px; height: 50px; border-radius: 50%; display: grid; place-items: center; padding-left: 3px; background: rgba(255,255,255,.92); color: var(--pink); box-shadow: 0 12px 24px -14px rgba(176,70,70,.6); }
.pc-estado {
  position: absolute; top: 10px; left: 10px; display: inline-flex; align-items: center; gap: 6px;
  font-size: 12px; font-weight: 800; padding: 5px 11px 5px 9px; border-radius: 99px;
}
.pc-punto { width: 7px; height: 7px; border-radius: 50%; background: currentColor; }
.pc-estado--pub  { background: var(--salvia); color: var(--salvia-deep); }
.pc-estado--borr { background: #FFEBDF; color: var(--melocoton-deep); }
.pc-estado--arch { background: #F6EEEA; color: var(--muted); }
.pc-clase-titulo {
  margin-top: 12px; font-size: 14.5px; font-weight: 800; color: var(--ink); line-height: 1.3;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}
.pc-clase:hover .pc-clase-titulo { color: var(--pink-deep); }
.pc-clase-meta { margin-top: 3px; font-size: 12.5px; font-weight: 600; color: var(--muted); }

.pc-hueco {
  aspect-ratio: 4 / 5; border-radius: 22px; border: 1.5px dashed var(--linea-fuerte); background: var(--crema);
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px;
  text-decoration: none; color: var(--pink-deep); transition: border-color .2s, background .2s;
}
.pc-hueco:hover { border-color: var(--pink-line); background: var(--rubor); }
.pc-hueco--extra { opacity: 0.55; }
.pc-hueco-ico { width: 46px; height: 46px; border-radius: 16px; display: inline-flex; align-items: center; justify-content: center; background: #fff; box-shadow: var(--sombra); }
.pc-hueco-txt { font-size: 13px; font-weight: 800; }

/* en vivo */
.pc-vivo { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.pc-vivo-fila {
  display: flex; align-items: center; gap: 16px; padding: 10px 14px 10px 10px; text-decoration: none; color: inherit;
  border-radius: 20px; background: var(--crema); border: 1px solid var(--linea); transition: background .2s, border-color .2s;
}
.pc-vivo-fila:hover { background: var(--rubor); border-color: var(--pink-line); }
.pc-vivo-fecha { display: flex; flex-direction: column; align-items: center; justify-content: center; width: 58px; height: 58px; flex-shrink: 0; border-radius: 18px; background: #fff; box-shadow: var(--sombra); }
.pc-vivo-dia { font-weight: 900; font-size: 22px; line-height: 1; color: var(--ink); }
.pc-vivo-mes { font-size: 12px; font-weight: 800; color: var(--pink-deep); margin-top: 2px; }
.pc-vivo-txt { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.pc-vivo-titulo { font-size: 15px; font-weight: 800; color: var(--ink); }
.pc-vivo-hora { font-size: 13px; color: var(--muted); }
.pc-vivo-res { font-size: 12.5px; font-weight: 700; color: var(--muted); white-space: nowrap; padding: 5px 12px; border-radius: 99px; background: #fff; }
.pc-vivo-res strong { font-size: 15px; font-weight: 900; color: var(--ink); margin-right: 2px; }
.pc-vivo-vacio {
  display: flex; align-items: center; gap: 14px; flex-wrap: wrap;
  padding: 16px 18px; border-radius: 22px; border: 1.5px dashed var(--linea-fuerte); background: var(--crema);
  text-decoration: none; color: inherit; transition: border-color .2s, background .2s;
}
.pc-vivo-vacio:hover { border-color: var(--pink-line); background: var(--rubor); }
.pc-vivo-vacio-ico { width: 46px; height: 46px; border-radius: 16px; flex-shrink: 0; display: grid; place-items: center; background: #fff; color: var(--pink-deep); box-shadow: var(--sombra); }
.pc-vivo-vacio-txt { flex: 1; min-width: 200px; display: flex; flex-direction: column; gap: 2px; font-size: 13px; color: var(--muted); }
.pc-vivo-vacio-txt strong { font-size: 14.5px; font-weight: 800; color: var(--ink); }
.pc-vivo-vacio-cta {
  display: inline-flex; align-items: center; gap: 6px; padding: 9px 16px; border-radius: 99px;
  font-size: 13px; font-weight: 800; color: #fff; background: var(--pink); box-shadow: 0 12px 22px -14px rgba(230,79,85,.85);
}

/* ── lateral ── */
.pc-lateral { display: flex; flex-direction: column; gap: 16px; min-width: 0; }
.pc-estudio {
  position: relative; overflow: hidden; border-radius: 28px; padding: 22px 22px 18px;
  background: linear-gradient(170deg, #FFF6F2 0%, #fff 45%); border: 1px solid var(--linea); box-shadow: var(--sombra);
}
.pc-estudio-cab { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 12px; }
.pc-estudio-eyebrow { font-size: 15px; font-weight: 900; color: var(--ink); }
.pc-estudio-link {
  display: inline-flex; align-items: center; gap: 3px; padding: 5px 11px; border-radius: 99px;
  font-size: 12.5px; font-weight: 800; color: var(--pink-deep); background: var(--rubor); text-decoration: none;
}
.pc-estudio-link:hover { background: var(--pink-wash); }
.pc-estudio-total { display: flex; align-items: flex-end; gap: 12px; }
.pc-estudio-num { font-weight: 900; font-size: 56px; line-height: 0.9; color: var(--ink); letter-spacing: -0.03em; }
.pc-estudio-total-txt { display: flex; flex-direction: column; gap: 2px; padding-bottom: 3px; font-size: 15px; font-weight: 800; color: var(--ink); }
.pc-estudio-altas { font-size: 12.5px; font-weight: 700; color: var(--pink-deep); background: var(--rubor); padding: 2px 9px; border-radius: 99px; align-self: flex-start; }

.pc-barra { display: flex; gap: 4px; height: 14px; margin: 20px 0 16px; padding: 3px; border-radius: 99px; background: var(--rubor); }
.pc-barra-tramo { display: block; flex-basis: 0; min-width: 10px; border-radius: 99px; }
.pc-barra-vacia { flex: 1; border-radius: 99px; background: var(--linea); }

.pc-reparto { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; }
.pc-reparto-fila {
  display: flex; align-items: center; gap: 10px; text-decoration: none;
  padding: 8px 10px; border-radius: 14px; transition: background .2s;
}
.pc-reparto-fila:hover { background: var(--rubor); }
.pc-reparto-marca { width: 12px; height: 12px; border-radius: 5px; flex-shrink: 0; }
.pc-reparto-nombre { flex: 1; font-size: 14px; font-weight: 700; color: var(--ink); white-space: nowrap; }
.pc-reparto-pct { font-size: 12px; font-weight: 800; color: var(--muted); background: #fff; border: 1px solid var(--linea); padding: 2px 8px; border-radius: 99px; font-variant-numeric: tabular-nums; }
.pc-reparto-num { font-weight: 900; font-size: 18px; line-height: 1; color: var(--ink); min-width: 22px; text-align: right; font-variant-numeric: lining-nums tabular-nums; }

.pc-estudio-sep { height: 1px; background: var(--linea); margin: 16px 0 16px; }
.pc-estudio-vacio { font-size: 13.5px; color: var(--muted); }
.pc-altas { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; }
.pc-altas-fila {
  display: flex; align-items: center; gap: 12px; padding: 8px 10px;
  text-decoration: none; border-radius: 16px; transition: background .2s;
}
.pc-altas-fila:hover { background: var(--rubor); }
.pc-altas-fila { position: relative; }
.pc-altas-perfil { text-decoration: none; max-width: 100%; display: block; }
.pc-altas-perfil::after { content: ""; position: absolute; inset: 0; border-radius: 16px; }
.pc-tier--link { position: relative; z-index: 1; text-decoration: none; transition: transform .2s, box-shadow .2s; }
.pc-tier--link:hover { transform: translateY(-1px); box-shadow: 0 4px 10px -4px rgba(176,58,62,.5); }
.pc-barra-tramo { cursor: pointer; transition: filter .2s; }
.pc-barra-tramo:hover { filter: brightness(.92); }
.pc-inicial {
  width: 38px; height: 38px; border-radius: 50%; flex-shrink: 0;
  display: inline-flex; align-items: center; justify-content: center;
  background: linear-gradient(135deg, var(--melocoton), var(--pink-soft)); color: var(--pink-deep);
  font-weight: 900; font-size: 15px;
}
.pc-altas-txt { flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: flex-start; gap: 3px; }
.pc-altas-nombre { max-width: 100%; font-size: 14px; font-weight: 800; color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pc-altas-nombre--sin { font-weight: 600; color: var(--muted); }
.pc-tier { font-size: 11.5px; font-weight: 800; padding: 2px 9px; border-radius: 99px; border: 1px solid transparent; }
.pc-tier--principal { background: var(--pink); color: #fff; }
.pc-tier--solista { background: var(--rubor); color: var(--pink-deep); border-color: var(--pink-line); }
.pc-tier--corps { background: #fff; color: var(--pink-deep); border-color: var(--pink-line); }
.pc-tier--none { background: #F6EEEA; color: var(--muted); }
.pc-altas-cuando { font-size: 12px; font-weight: 600; color: var(--muted); white-space: nowrap; }

/* ── atajos ── */
.pc-atajos-titulo { font-size: 18px; font-weight: 900; color: var(--ink); margin-bottom: 12px; }
.pc-atajos ol { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
.pc-atajo {
  display: flex; align-items: center; gap: 14px; padding: 16px 18px; height: 100%;
  text-decoration: none; color: inherit; border-radius: 24px; background: #fff; border: 1px solid var(--linea); box-shadow: var(--sombra);
  transition: background .2s, border-color .2s, box-shadow .35s, transform .35s var(--curva);
}
.pc-atajo:hover { background: var(--crema); border-color: var(--pink-line); box-shadow: var(--sombra-alta); transform: translateY(-2px); }
.pc-atajo-ico { width: 44px; height: 44px; border-radius: 16px; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; background: var(--rubor); color: var(--pink-deep); }
.pc-atajos li:nth-child(2) .pc-atajo-ico { background: #FFF4E8; color: var(--melocoton-deep); }
.pc-atajos li:nth-child(3) .pc-atajo-ico { background: #FFF0EA; color: #B4533A; }
.pc-atajos li:nth-child(4) .pc-atajo-ico { background: #FFF4E8; color: var(--melocoton-deep); }
.pc-atajos li:nth-child(5) .pc-atajo-ico { background: var(--rubor); color: var(--pink-deep); }
.pc-atajos li:nth-child(6) .pc-atajo-ico { background: #FFF4E8; color: var(--melocoton-deep); }
.pc-atajo-txt { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.pc-atajo-label { font-size: 14.5px; font-weight: 800; color: var(--ink); }
.pc-atajo-sub { font-size: 12.5px; color: var(--muted); }
.pc-atajo-flecha { color: #C9AFA7; flex-shrink: 0; transition: transform .3s var(--curva), color .2s; }
.pc-atajo:hover .pc-atajo-flecha { color: var(--pink-deep); transform: translateX(3px); }

/* ── responsive ── */
@media (max-width: 1180px) {
  .pc-cuerpo { grid-template-columns: minmax(0, 1fr); }
  .pc-estudio { display: grid; grid-template-columns: minmax(0, 1fr) 1px minmax(0, 1fr); gap: 0 28px; }
  .pc-estudio-sep { margin: 0; height: auto; }
  .pc-atajos ol { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 860px) {
  .pc-cifras { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .pc-clases { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .pc-estudio { display: block; }
  .pc-estudio-sep { margin: 16px 0; height: 1px; }
}
@media (max-width: 520px) {
  .pc { gap: 16px; }
  .pc-mast { border-radius: 28px; }
  .pc-mast-acciones { width: 100%; }
  .pc-mast-acciones .pc-btn { flex: 1; justify-content: center; padding: 0 14px; }
  .pc-cifras { gap: 10px; }
  .pc-cifra { padding: 14px 14px 16px; }
  .pc-cifra-ico { width: 34px; height: 34px; border-radius: 12px; }
  .pc-cifra-label { font-size: 13px; }
  .pc-bloque { padding: 18px 14px 18px; border-radius: 24px; }
  .pc-clases { gap: 10px; }
  .pc-vivo-fila { gap: 12px; }
  .pc-vivo-res { display: none; }
  .pc-hueco--extra { display: none; }
  .pc-atajos ol { grid-template-columns: minmax(0, 1fr); gap: 10px; }
}
@media (prefers-reduced-motion: reduce) {
  .pc-mast::before, .pc-mast::after { animation: none; }
  .pc-cifra:hover, .pc-atajo:hover, .pc-btn:hover { transform: none; }
}
`;
