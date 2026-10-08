"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import {
  motion, MotionConfig, animate, useInView, useMotionValue, useReducedMotion, useTransform,
  type Variants,
} from "motion/react";
import { ArrowRight, ArrowUpRight, Plus, Play, Upload } from "lucide-react";
import { Saludo } from "@/components/saludo";
import { HoraSesion } from "@/components/hora-sesion";

/*
 * Panel del estudio: la portada del dashboard para una cuenta admin.
 *
 * DIRECCION
 *   Editorial, como el programa de mano de una funcion: titulares en Bodoni,
 *   cifras grandes separadas por filetes y no metidas en cajas, y una sola
 *   superficie oscura (el estudio) para que el ojo tenga donde apoyarse. La
 *   version anterior repetia tarjetas blancas iguales y se leia como una
 *   plantilla de SaaS.
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
  ultimas: { id: string; nombre: string; tier: TierClave; cuando: string }[];
  clases: { id: string; titulo: string; estado: string; portada: string | null; minutos: number | null }[];
  enVivo: { id: string; titulo: string; iso: string; zona: string; reservas: number }[];
};

const TIER: Record<TierClave, { label: string; color: string }> = {
  principal:       { label: "Principal",       color: "#FDECEC" },
  solista:         { label: "Solista",         color: "#E64F55" },
  corps_de_ballet: { label: "Corps de Ballet", color: "#EB7478" },
  none:            { label: "Sin plan",        color: "#57534e" },
};

const ESTADO: Record<string, { label: string; clase: string }> = {
  published: { label: "Publicada", clase: "pc-estado--pub" },
  draft:     { label: "Borrador",  clase: "pc-estado--borr" },
  scheduled: { label: "Programada", clase: "pc-estado--borr" },
  archived:  { label: "Archivada", clase: "pc-estado--arch" },
};

const SUAVE = [0.16, 1, 0.3, 1] as const;

const grupo: Variants = {
  oculto: {},
  visible: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
};

const sube: Variants = {
  oculto: { opacity: 0, y: 22 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: SUAVE } },
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

/** Una linea de titular que sube desde abajo de una mascara. */
function Linea({ children, retraso = 0 }: { children: React.ReactNode; retraso?: number }) {
  return (
    <span className="pc-linea">
      <motion.span
        className="pc-linea-in"
        initial={{ y: "105%" }}
        animate={{ y: 0 }}
        transition={{ duration: 0.9, delay: retraso, ease: SUAVE }}
      >
        {children}
      </motion.span>
    </span>
  );
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

export function PanelControlAdmin({ datos }: { datos: DatosPanel }) {
  const m = datos.metricas;
  const total = datos.porPlan.reduce((a, p) => a + p.cantidad, 0);
  const huecos = Math.max(0, 4 - datos.clases.length);

  const cifras = [
    { valor: m.alumnas,    label: "Alumnas",           sub: `+${m.altasDelMes} este mes`, href: "/admin/users" },
    { valor: m.conPlan,    label: "Con plan activo",   sub: `${m.principal} en Principal`, href: "/admin/users" },
    { valor: m.publicadas, label: "Clases publicadas", sub: `${m.borradores} ${m.borradores === 1 ? "borrador" : "borradores"} · ${m.totales} en total`, href: "/admin/videos" },
    { valor: m.reservas,   label: "Reservas en vivo",  sub: `${m.sesiones} ${m.sesiones === 1 ? "sesión" : "sesiones"} en agenda`, href: "/admin/live" },
  ];

  const atajos = [
    { href: "/admin/videos",        label: "Subir una clase",    sub: "Video, categoría y planes" },
    { href: "/admin/live",          label: "Programar en vivo",  sub: "Sesión por Zoom" },
    { href: "/admin/announcements", label: "Publicar un anuncio", sub: `${m.anuncios} ${m.anuncios === 1 ? "activo" : "activos"} ahora` },
    { href: "/admin/programs",      label: "Armar un plan",      sub: "Planes de trabajo por día" },
  ];

  return (
    <MotionConfig reducedMotion="user">
      <style>{CSS}</style>
      <div className="pc">

        {/* ── Cabecera ── */}
        <header className="pc-mast">
          <div className="pc-mast-texto">
            <motion.p
              className="pc-eyebrow"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6 }}
            >
              <motion.span
                className="pc-eyebrow-raya"
                initial={{ scaleX: 0 }} animate={{ scaleX: 1 }}
                transition={{ duration: 0.8, delay: 0.1, ease: SUAVE }}
              />
              {datos.fecha} · Panel del estudio
            </motion.p>
            <h1 className="pc-titulo">
              <Linea retraso={0.05}>
                <Saludo />{datos.nombre ? "," : "."}
              </Linea>
              {datos.nombre && (
                <Linea retraso={0.16}><em>{datos.nombre}.</em></Linea>
              )}
            </h1>
          </div>
          <motion.div
            className="pc-mast-acciones"
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.35, ease: SUAVE }}
          >
            <Link href="/admin/videos" className="pc-btn pc-btn--lleno">
              <Upload size={15} strokeWidth={2.2} /> Subir clase
            </Link>
            <Link href="/admin" className="pc-btn">
              Panel completo <ArrowUpRight size={15} strokeWidth={2.2} />
            </Link>
          </motion.div>
        </header>

        {/* ── Cifras ── */}
        <motion.div className="pc-cifras" variants={grupo} initial="oculto" animate="visible">
          {cifras.map((c) => (
            <motion.div key={c.label} variants={sube}>
              <Link href={c.href as never} className="pc-cifra">
                <span className="pc-cifra-label">{c.label}</span>
                <span className="pc-cifra-num"><Contador valor={c.valor} /></span>
                <span className="pc-cifra-sub">{c.sub}</span>
              </Link>
            </motion.div>
          ))}
        </motion.div>

        <div className="pc-cuerpo">

          {/* ── Columna principal ── */}
          <motion.div className="pc-principal" variants={grupo} initial="oculto" animate="visible">

            <motion.section variants={sube}>
              <div className="pc-cab">
                <h2 className="pc-h2">Clases recientes</h2>
                <Link href="/admin/videos" className="pc-mas">Ver todas <ArrowRight size={14} strokeWidth={2} /></Link>
              </div>
              <div className="pc-clases">
                {datos.clases.map((c) => {
                  const e = ESTADO[c.estado] ?? { label: c.estado, clase: "pc-estado--borr" };
                  return (
                    <motion.div key={c.id} whileHover="hover" initial="reposo">
                      <Link href="/admin/videos" className="pc-clase">
                        <div className="pc-clase-img">
                          {c.portada ? (
                            <motion.img
                              src={c.portada} alt=""
                              variants={{ reposo: { scale: 1 }, hover: { scale: 1.06 } }}
                              transition={{ duration: 0.8, ease: SUAVE }}
                            />
                          ) : (
                            <div className="pc-clase-sinimg"><Play size={22} strokeWidth={1.6} /></div>
                          )}
                          <span className={"pc-estado " + e.clase}>{e.label}</span>
                        </div>
                        <p className="pc-clase-titulo">{c.titulo}</p>
                        <p className="pc-clase-meta">{c.minutos ? `${c.minutos} min` : "Sin duración"}</p>
                      </Link>
                    </motion.div>
                  );
                })}
                {Array.from({ length: huecos }).map((_, i) => (
                  <Link key={"hueco" + i} href="/admin/videos" className={"pc-hueco" + (i > 0 ? " pc-hueco--extra" : "")}>
                    <motion.span
                      className="pc-hueco-ico"
                      whileHover={{ rotate: 90, scale: 1.1 }}
                      transition={{ type: "spring", stiffness: 300, damping: 14 }}
                    >
                      <Plus size={20} strokeWidth={1.8} />
                    </motion.span>
                    {i === 0 && <span className="pc-hueco-txt">Subir una clase</span>}
                  </Link>
                ))}
              </div>
            </motion.section>

            <motion.section variants={sube}>
              <div className="pc-cab">
                <h2 className="pc-h2">Próximas en vivo</h2>
                <Link href="/admin/live" className="pc-mas">Agenda <ArrowRight size={14} strokeWidth={2} /></Link>
              </div>
              {datos.enVivo.length === 0 ? (
                <Link href="/admin/live" className="pc-vivo-vacio">
                  <span>No hay ninguna sesión en agenda.</span>
                  <span className="pc-vivo-vacio-cta">Programar una <ArrowRight size={14} strokeWidth={2} /></span>
                </Link>
              ) : (
                <ul className="pc-vivo">
                  {datos.enVivo.map((s) => {
                    const f = partesFecha(s.iso, s.zona);
                    return (
                      <motion.li key={s.id} whileHover={{ x: 6 }} transition={{ type: "spring", stiffness: 300, damping: 24 }}>
                        <Link href="/admin/live" className="pc-vivo-fila">
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
              <motion.div
                className="pc-estudio-luz" aria-hidden="true"
                animate={{ x: [0, 30, -14, 0], y: [0, -20, 14, 0], scale: [1, 1.12, 0.94, 1] }}
                transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
              />
              <div className="pc-estudio-a">
              <p className="pc-estudio-eyebrow">El estudio</p>
              <p className="pc-estudio-total">
                <span className="pc-estudio-num"><Contador valor={total} /></span>
                <span>{total === 1 ? "alumna" : "alumnas"}</span>
              </p>

              <div className="pc-pila" role="img" aria-label={datos.porPlan.map((p) => `${TIER[p.tier].label}: ${p.cantidad}`).join(", ")}>
                {total > 0 && datos.porPlan.map((p, i) => p.cantidad > 0 && (
                  <motion.span
                    key={p.tier}
                    style={{ background: TIER[p.tier].color }}
                    initial={{ flexGrow: 0 }}
                    animate={{ flexGrow: p.cantidad }}
                    transition={{ duration: 1.1, delay: 0.4 + i * 0.1, ease: SUAVE }}
                  />
                ))}
              </div>

              <ul className="pc-leyenda">
                {datos.porPlan.map((p) => {
                  const pct = total > 0 ? Math.round((p.cantidad / total) * 100) : 0;
                  return (
                    <li key={p.tier}>
                      <span className="pc-punto" style={{ background: TIER[p.tier].color }} />
                      <span className="pc-leyenda-nombre">{TIER[p.tier].label}</span>
                      <span className="pc-leyenda-num">{p.cantidad}</span>
                      <span className="pc-leyenda-pct">{pct}%</span>
                    </li>
                  );
                })}
              </ul>

              </div>

              <div className="pc-estudio-sep" />

              <div className="pc-estudio-b">

              <div className="pc-estudio-cab">
                <p className="pc-estudio-eyebrow" style={{ margin: 0 }}>Últimas altas</p>
                <Link href="/admin/users" className="pc-estudio-link">Ver todas <ArrowUpRight size={13} strokeWidth={2.2} /></Link>
              </div>
              {datos.ultimas.length === 0 ? (
                <p className="pc-estudio-vacio">Todavía no hay alumnas.</p>
              ) : (
                <ul className="pc-altas">
                  {datos.ultimas.slice(0, 5).map((u) => (
                    <li key={u.id}>
                      <span className="pc-inicial">{(u.nombre.trim()[0] ?? "?").toUpperCase()}</span>
                      <span className="pc-altas-txt">
                        <span className="pc-altas-nombre">{u.nombre}</span>
                        <span className="pc-altas-cuando">{TIER[u.tier]?.label ?? "Sin plan"} · {u.cuando}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              </div>
            </motion.section>

          </motion.aside>
        </div>

        {/* ── Atajos, a lo ancho ── */}
        <motion.section className="pc-atajos" variants={sube} initial="oculto" animate="visible" transition={{ delay: 0.5 }}>
          <p className="pc-atajos-titulo">Atajos</p>
          <ol>
            {atajos.map((a, i) => (
              <motion.li key={a.href} whileHover="hover" initial="reposo">
                <Link href={a.href as never} className="pc-atajo">
                  <span className="pc-atajo-num">{String(i + 1).padStart(2, "0")}</span>
                  <span className="pc-atajo-txt">
                    <span className="pc-atajo-label">{a.label}</span>
                    <span className="pc-atajo-sub">{a.sub}</span>
                  </span>
                  <motion.span
                    className="pc-atajo-flecha"
                    variants={{ reposo: { x: 0, opacity: 0.35 }, hover: { x: 4, opacity: 1 } }}
                  >
                    <ArrowRight size={16} strokeWidth={2} />
                  </motion.span>
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
.pc { display: flex; flex-direction: column; }

/* ── cabecera ── */
.pc-mast {
  display: flex; align-items: flex-end; justify-content: space-between; gap: 24px; flex-wrap: wrap;
  padding-bottom: clamp(22px, 3vw, 34px);
}
.pc-mast-texto { min-width: 0; }
.pc-eyebrow {
  display: flex; align-items: center; gap: 12px;
  font-size: 11px; font-weight: 700; letter-spacing: 0.2em; text-transform: uppercase;
  color: var(--pink-deep); margin-bottom: 18px;
}
.pc-eyebrow-raya { display: inline-block; width: 36px; height: 1.5px; background: var(--pink); transform-origin: left; }
.pc-titulo {
  font-family: var(--font-serif), serif; font-weight: 400;
  font-size: clamp(44px, 6.2vw, 92px); line-height: 0.98; letter-spacing: -0.025em;
  color: var(--ink);
}
.pc-titulo em { font-style: italic; color: var(--pink-mid); }
.pc-linea { display: block; overflow: hidden; padding-bottom: 0.08em; }
.pc-linea-in { display: block; }

.pc-mast-acciones { display: flex; gap: 10px; flex-wrap: wrap; padding-bottom: 10px; }
.pc-btn {
  display: inline-flex; align-items: center; gap: 8px; white-space: nowrap;
  height: 44px; padding: 0 20px; border-radius: 99px; text-decoration: none;
  font-size: 13px; font-weight: 700; letter-spacing: 0.02em;
  color: var(--ink); border: 1.5px solid #d6d3d1; background: transparent;
  transition: border-color .2s, background .2s, color .2s, transform .2s;
}
.pc-btn:hover { border-color: var(--ink); background: #fff; }
.pc-btn--lleno { background: var(--ink); border-color: var(--ink); color: #fff; }
.pc-btn--lleno:hover { background: var(--pink-mid); border-color: var(--pink-mid); color: #fff; }

/* ── cifras ── */
.pc-cifras {
  display: grid; grid-template-columns: repeat(4, minmax(0, 1fr));
  border-top: 1px solid var(--ink); border-bottom: 1px solid #e7e5e4;
}
.pc-cifras > div + div { border-left: 1px solid #e7e5e4; }
.pc-cifra {
  position: relative; display: flex; flex-direction: column; gap: 10px; height: 100%;
  padding: 22px 26px 24px; text-decoration: none; color: inherit;
  transition: background .25s;
}
.pc-cifras > div:first-child .pc-cifra { padding-left: 0; }
.pc-cifra::after {
  content: ""; position: absolute; left: 0; right: 0; top: -1px; height: 3px;
  background: var(--pink); transform: scaleX(0); transform-origin: left;
  transition: transform .5s cubic-bezier(.16,1,.3,1);
}
.pc-cifra:hover::after { transform: scaleX(1); }
.pc-cifra-label {
  font-size: 10.5px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: #78716c;
}
.pc-cifra-num {
  font-family: var(--font-serif), serif; font-weight: 400;
  font-size: clamp(48px, 5vw, 76px); line-height: 0.9; letter-spacing: -0.03em;
  color: var(--ink); font-variant-numeric: lining-nums tabular-nums;
}
.pc-cifra:hover .pc-cifra-num { color: var(--pink-mid); }
.pc-cifra-sub { font-size: 12.5px; color: var(--pink-muted); }

/* ── cuerpo ── */
.pc-cuerpo {
  display: grid; grid-template-columns: minmax(0, 1fr) minmax(300px, 380px);
  gap: clamp(24px, 3vw, 44px); padding-top: clamp(28px, 3vw, 40px);
}
.pc-principal { display: flex; flex-direction: column; gap: 40px; min-width: 0; }
.pc-cab {
  display: flex; align-items: baseline; justify-content: space-between; gap: 12px;
  padding-bottom: 12px; margin-bottom: 18px; border-bottom: 1px solid #e7e5e4;
}
.pc-h2 {
  font-family: var(--font-serif), serif; font-weight: 400; font-size: 30px;
  letter-spacing: -0.015em; color: var(--ink); line-height: 1;
}
.pc-mas {
  display: inline-flex; align-items: center; gap: 6px; text-decoration: none;
  font-size: 12px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--pink-deep);
}
.pc-mas:hover { color: var(--ink); }

/* clases */
.pc-clases { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; }
.pc-clase { display: block; text-decoration: none; color: inherit; }
.pc-clase-img {
  position: relative; aspect-ratio: 4 / 5; border-radius: 16px; overflow: hidden;
  background: linear-gradient(160deg, var(--pink-wash), var(--pink-soft));
}
.pc-clase-img img { width: 100%; height: 100%; object-fit: cover; display: block; }
.pc-clase-sinimg {
  position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; color: var(--pink-deep);
}
.pc-estado {
  position: absolute; top: 10px; left: 10px;
  font-size: 9.5px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase;
  padding: 5px 10px; border-radius: 99px; backdrop-filter: blur(8px);
}
.pc-estado--pub  { background: rgba(28,25,23,0.82); color: #fff; }
.pc-estado--borr { background: rgba(255,255,255,0.9); color: var(--pink-deep); }
.pc-estado--arch { background: rgba(255,255,255,0.9); color: #78716c; }
.pc-clase-titulo {
  margin-top: 12px; font-size: 14px; font-weight: 700; color: var(--ink); line-height: 1.3;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}
.pc-clase:hover .pc-clase-titulo { color: var(--pink-deep); }
.pc-clase-meta { margin-top: 3px; font-size: 12px; color: #a8a29e; }

.pc-hueco {
  aspect-ratio: 4 / 5; border-radius: 16px; border: 1.5px dashed #d6d3d1;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px;
  text-decoration: none; color: #a8a29e; transition: border-color .2s, background .2s, color .2s;
}
.pc-hueco:hover { border-color: var(--pink); background: var(--pink-wash); color: var(--pink-deep); }
.pc-hueco--extra { opacity: 0.55; }
.pc-hueco-ico {
  width: 44px; height: 44px; border-radius: 50%; border: 1.5px solid currentColor;
  display: inline-flex; align-items: center; justify-content: center;
}
.pc-hueco-txt { font-size: 12px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; }

/* en vivo */
.pc-vivo { list-style: none; margin: 0; padding: 0; }
.pc-vivo li + li { border-top: 1px solid #f0eeec; }
.pc-vivo-fila { display: flex; align-items: center; gap: 22px; padding: 14px 0; text-decoration: none; color: inherit; }
.pc-vivo-fecha { display: flex; flex-direction: column; align-items: center; width: 56px; flex-shrink: 0; }
.pc-vivo-dia { font-family: var(--font-serif), serif; font-size: 40px; line-height: 0.9; color: var(--ink); }
.pc-vivo-mes { font-size: 10px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: var(--pink-deep); margin-top: 4px; }
.pc-vivo-txt { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.pc-vivo-titulo { font-size: 15px; font-weight: 700; color: var(--ink); }
.pc-vivo-hora { font-size: 12.5px; color: #78716c; }
.pc-vivo-res { font-size: 12px; color: #78716c; white-space: nowrap; }
.pc-vivo-res strong { font-family: var(--font-serif), serif; font-size: 22px; font-weight: 400; color: var(--ink); margin-right: 3px; }
.pc-vivo-vacio {
  display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap;
  padding: 22px 24px; border-radius: 16px; border: 1.5px dashed #d6d3d1;
  text-decoration: none; font-size: 14px; color: #78716c;
  transition: border-color .2s, background .2s;
}
.pc-vivo-vacio:hover { border-color: var(--pink); background: var(--pink-wash); }
.pc-vivo-vacio-cta {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 12px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--pink-deep);
}

/* ── lateral ── */
.pc-lateral { display: flex; flex-direction: column; gap: 16px; min-width: 0; }
.pc-estudio {
  position: relative; overflow: hidden; isolation: isolate;
  background: var(--ink); color: #fff; border-radius: 24px; padding: 26px 26px 22px;
}
.pc-estudio-luz {
  position: absolute; z-index: -1; pointer-events: none;
  width: 340px; height: 340px; right: -150px; top: -150px; border-radius: 50%;
  background: radial-gradient(circle, rgba(230,79,85,0.5), rgba(230,79,85,0) 68%);
}
.pc-estudio-eyebrow {
  font-size: 10.5px; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; color: var(--rose);
  margin-bottom: 10px;
}
.pc-estudio-total { display: flex; align-items: baseline; gap: 10px; font-size: 14px; color: #d6d3d1; }
.pc-estudio-num { font-family: var(--font-serif), serif; font-size: 64px; line-height: 0.9; color: #fff; letter-spacing: -0.03em; }
.pc-pila {
  display: flex; gap: 3px; height: 10px; margin: 20px 0 16px; border-radius: 99px; overflow: hidden;
  background: rgba(255,255,255,0.08);
}
.pc-pila span { display: block; height: 100%; flex-basis: 0; min-width: 0; }
.pc-leyenda { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
.pc-leyenda li { display: flex; align-items: center; gap: 10px; font-size: 13px; }
.pc-punto { width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0; box-shadow: 0 0 0 1px rgba(255,255,255,0.15); }
.pc-leyenda-nombre { flex: 1; color: #e7e5e4; }
.pc-leyenda-num { font-weight: 700; color: #fff; font-variant-numeric: tabular-nums; }
.pc-leyenda-pct { width: 38px; text-align: right; font-size: 11.5px; color: #a8a29e; font-variant-numeric: tabular-nums; }
.pc-estudio-sep { height: 1px; background: rgba(255,255,255,0.12); margin: 22px 0 18px; }
.pc-estudio-cab { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.pc-estudio-link {
  display: inline-flex; align-items: center; gap: 3px;
  font-size: 11.5px; font-weight: 600; color: #e7e5e4; text-decoration: none;
}
.pc-estudio-link:hover { color: #fff; text-decoration: underline; }
.pc-estudio-vacio { font-size: 13px; color: #a8a29e; }
.pc-altas { list-style: none; margin: 0; padding: 0; display: grid; gap: 12px; }
.pc-altas li { display: flex; align-items: center; gap: 12px; }
.pc-inicial {
  width: 34px; height: 34px; border-radius: 50%; flex-shrink: 0;
  display: inline-flex; align-items: center; justify-content: center;
  font-family: var(--font-serif), serif; font-size: 16px; color: var(--ink); background: var(--pink-soft);
}
.pc-altas-txt { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.pc-altas-nombre { font-size: 13px; font-weight: 600; color: #fff; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pc-altas-cuando { font-size: 11.5px; color: #a8a29e; }

.pc-atajos { margin-top: 40px; border-top: 1px solid var(--ink); padding-top: 18px; }
.pc-atajos-titulo {
  font-size: 10.5px; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; color: #78716c;
  margin-bottom: 8px;
}
.pc-atajos ol { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); }
.pc-atajos li + li { border-left: 1px solid #e7e5e4; }
.pc-atajo {
  display: flex; align-items: center; gap: 16px; padding: 16px 22px; height: 100%;
  text-decoration: none; color: inherit; border-radius: 16px; transition: background .2s;
}
.pc-atajos li:first-child .pc-atajo { padding-left: 0; }
.pc-atajo:hover { background: #fff; }
.pc-atajo-num { font-family: var(--font-serif), serif; font-style: italic; font-size: 30px; color: var(--pink-mid); width: 36px; flex-shrink: 0; }
.pc-atajo-txt { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.pc-atajo-label { font-size: 14px; font-weight: 700; color: var(--ink); }
.pc-atajo:hover .pc-atajo-label { color: var(--pink-deep); }
.pc-atajo-sub { font-size: 12px; color: #a8a29e; }
.pc-atajo-flecha { color: var(--pink-deep); display: inline-flex; }

/* ── responsive ── */
@media (max-width: 1180px) {
  .pc-cuerpo { grid-template-columns: minmax(0, 1fr); }
  .pc-estudio { display: grid; grid-template-columns: minmax(0, 1fr) 1px minmax(0, 1fr); gap: 0 28px; }
  .pc-estudio-sep { margin: 0; height: auto; }
  .pc-atajos ol { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .pc-atajos li:nth-child(3) { border-left: 0; }
  .pc-atajos li:nth-child(n+3) { border-top: 1px solid #e7e5e4; }
  .pc-atajos li:nth-child(3) .pc-atajo { padding-left: 0; }
}
@media (max-width: 860px) {
  .pc-cifras { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .pc-cifras > div:nth-child(3) { border-left: 0; }
  .pc-cifras > div:nth-child(n+3) { border-top: 1px solid #e7e5e4; }
  .pc-cifras > div:nth-child(3) .pc-cifra { padding-left: 0; }
  .pc-clases { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .pc-estudio { display: block; }
  .pc-estudio-sep { margin: 22px 0 18px; height: 1px; }
}
@media (max-width: 520px) {
  .pc-mast-acciones { width: 100%; }
  .pc-mast-acciones .pc-btn { flex: 1; justify-content: center; }
  .pc-cifra { padding: 18px 16px 20px; }
  .pc-cifras > div:nth-child(odd) .pc-cifra { padding-left: 0; }
  .pc-vivo-fila { gap: 14px; }
  .pc-vivo-res { display: none; }
  .pc-hueco--extra { display: none; }
  .pc-atajos ol { grid-template-columns: minmax(0, 1fr); }
  .pc-atajos li + li { border-left: 0; border-top: 1px solid #e7e5e4; }
  .pc-atajo { padding-left: 0; }
}
`;
