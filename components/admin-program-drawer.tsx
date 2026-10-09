"use client";
import { CalendarDays, Check, Image as ImageIcon, Minus, Pencil, Plus, Trash2, X } from "lucide-react";
import { Desplegable } from "@/components/desplegable";
import { AutoDireccion } from "@/components/auto-direccion";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { BotonEnviar } from "@/components/boton-enviar";
import { AdminDrawer, BloqueAvanzado, botonPrincipal, campoSuave, etiquetaSuave } from "@/components/admin-drawer";
import {
  deleteProgramAction,
  deleteProgramDayAction,
  upsertProgramAction,
  upsertProgramDayAction,
} from "@/src/features/admin/actions";

/**
 * Edicion de un plan de trabajo y sus dias, en panel lateral.
 *
 * LAS OPCIONES DEL SELECTOR DE CLASES
 *   El <select> para agregar un dia lista TODAS las clases, y se renderizaba
 *   una vez por plan aunque nadie lo abriera. Medido hoy: 3 planes x 19
 *   clases = 57 opciones. Con 20 programas y 100 clases serian 2.000.
 *
 *   Escala con el PRODUCTO de planes por clases, que es la peor forma de
 *   escalar. Dentro del panel se renderiza uno solo, el del plan abierto.
 */

export type ProgramRecord = {
  id: string;
  slug: string;
  title_i18n: Record<string, string>;
  description_i18n: Record<string, string>;
  membership_tier_required: string;
  status: string;
  duration_days: number;
  cover_image_url: string | null;
  is_featured: boolean;
};

export type ProgramDayRecord = { id: string; program_id: string; day_number: number; video_id: string };
export type VideoLookup = { id: string; slug: string; title_i18n: Record<string, string> | null };

const inp = campoSuave;

function Lbl({ children }: { children: React.ReactNode }) {
  return <span style={etiquetaSuave}>{children}</span>;
}
function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <label style={{ display: "flex", flexDirection: "column" }}><Lbl>{label}</Lbl>{children}</label>;
}
/**
 * El formulario del plan de trabajo. Se exporta porque lo usan los DOS caminos: el
 * alta (en la pagina, sin panel) y la edicion (dentro del drawer). Una copia
 * por camino garantiza que en unos meses uno tenga un campo que el otro no.
 *
 * Va por secciones numeradas y con controles que se ven sin abrir nada (plan y
 * estado como opciones a la vista, dias con atajos, portada con vista previa).
 * Los `name` son los mismos de siempre: upsertProgramAction no cambia.
 */
export function ProgramForm({ actionLabel, program, onGuardado }: { actionLabel: string; program?: ProgramRecord; onGuardado?: () => void }) {
  const esNuevo = !program;
  const [dias, setDias] = useState<number>(program?.duration_days ?? 14);
  const [portada, setPortada] = useState(program?.cover_image_url ?? "");
  const [portadaRota, setPortadaRota] = useState(false);
  const portadaValida = /^https?:\/\/\S+$/.test(portada.trim());

  return (
    <form action={upsertProgramAction} className="pf">
      {onGuardado && <CerrarAlGuardar onExito={onGuardado} />}
      <input name="id" type="hidden" value={program?.id ?? ""} />

      <fieldset className="pf-seccion">
        <legend><span className="pf-num">01</span> Qué es</legend>
        <div className="pf-grilla">
          <label className="pf-campo">
            <span className="pf-etq">Título</span>
            <input defaultValue={program?.title_i18n?.es ?? ""} name="titleEs" required placeholder="Trabajo de pies en 14 días" />
          </label>
          <label className="pf-campo">
            <span className="pf-etq">Título en inglés <small>opcional</small></span>
            <input defaultValue={program?.title_i18n?.en ?? ""} name="titleEn" placeholder="Footwork in 14 days" />
          </label>
          <label className="pf-campo">
            <span className="pf-etq">Descripción <small>la lee la alumna antes de empezar</small></span>
            <textarea defaultValue={program?.description_i18n?.es ?? ""} name="descriptionEs" required rows={3} placeholder="Qué trabaja este plan y para quién es…" />
          </label>
          <label className="pf-campo">
            <span className="pf-etq">Descripción en inglés <small>opcional</small></span>
            <textarea defaultValue={program?.description_i18n?.en ?? ""} name="descriptionEn" rows={3} />
          </label>
        </div>
      </fieldset>

      <fieldset className="pf-seccion">
        <legend><span className="pf-num">02</span> Duración</legend>
        <div className="pf-grilla">
          <div className="pf-campo">
            <span className="pf-etq" id="pf-dias-etq">Cuántos días dura</span>
            <div className="pf-dias">
              <button type="button" className="pf-paso" aria-label="Un día menos" disabled={dias <= 1} onClick={() => setDias((d) => Math.max(1, d - 1))}>
                <Minus size={16} strokeWidth={2.2} />
              </button>
              <input
                aria-labelledby="pf-dias-etq" name="durationDays" type="number" min={1} max={365} required
                value={dias} onChange={(e) => setDias(Math.max(1, Number(e.target.value) || 1))}
              />
              <button type="button" className="pf-paso" aria-label="Un día más" disabled={dias >= 365} onClick={() => setDias((d) => Math.min(365, d + 1))}>
                <Plus size={16} strokeWidth={2.2} />
              </button>
            </div>
            <div className="pf-atajos" role="group" aria-label="Duraciones comunes">
              {[7, 14, 21, 28].map((n) => (
                <button key={n} type="button" className={"pf-atajo" + (dias === n ? " es-activo" : "")} onClick={() => setDias(n)}>
                  {n} días
                </button>
              ))}
            </div>
          </div>
          <label className="pf-campo">
            <span className="pf-etq">Dirección <small>{esNuevo ? "se completa sola con el título" : "no se cambia: rompería los enlaces ya compartidos"}</small></span>
            {/* Al editar es solo lectura: cambiarla rompe cualquier enlace ya
                compartido. Al crear hace falta, porque todavia no existe. */}
            <div className="pf-direccion">
              <span className="pf-direccion-pre">…/programs/</span>
              <input defaultValue={program?.slug ?? ""} name="slug" required readOnly={!esNuevo} placeholder="trabajo-de-pies-14-dias" />
            </div>
            <AutoDireccion desde="titleEs" activo={esNuevo} />
          </label>
        </div>
      </fieldset>

      <fieldset className="pf-seccion">
        <legend><span className="pf-num">03</span> Quién lo ve</legend>
        <div className="pf-planes" role="radiogroup" aria-label="Plan que lo puede ver">
          {[
            { value: "solista", titulo: "Solista", sub: "Lo ven Solista y Principal" },
            { value: "principal", titulo: "Principal", sub: "Solo Principal" },
          ].map((p) => (
            <label key={p.value} className="pf-plan">
              <input type="radio" name="membershipTierRequired" value={p.value} defaultChecked={(program?.membership_tier_required ?? "solista") === p.value} />
              <span className="pf-plan-caja">
                <span className="pf-plan-titulo">{p.titulo}</span>
                <span className="pf-plan-sub">{p.sub}</span>
                <span className="pf-plan-tilde" aria-hidden="true"><Check size={13} strokeWidth={3} /></span>
              </span>
            </label>
          ))}
        </div>

        <div className="pf-fila-estado">
          <div className="pf-campo">
            <span className="pf-etq">Estado</span>
            <div className="pf-segmento" role="radiogroup" aria-label="Estado">
              {[
                { value: "draft", label: "Borrador" },
                { value: "published", label: "Publicado" },
                { value: "archived", label: "Archivado" },
              ].map((e) => (
                <label key={e.value}>
                  <input type="radio" name="status" value={e.value} defaultChecked={(program?.status ?? "draft") === e.value} />
                  <span>{e.label}</span>
                </label>
              ))}
            </div>
          </div>
          <label className="pf-switch">
            <input defaultChecked={program?.is_featured ?? false} name="isFeatured" type="checkbox" role="switch" />
            <span className="pf-switch-pista" aria-hidden="true"><span /></span>
            <span className="pf-switch-txt">Destacar <small>aparece primero para las alumnas</small></span>
          </label>
        </div>
      </fieldset>

      <fieldset className="pf-seccion">
        <legend><span className="pf-num">04</span> Portada <small>opcional</small></legend>
        <div className="pf-portada">
          <div className="pf-portada-vista" aria-hidden="true">
            {portadaValida && !portadaRota ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={portada.trim()} alt="" onError={() => setPortadaRota(true)} onLoad={() => setPortadaRota(false)} />
            ) : (
              <span className="pf-portada-vacia">
                <ImageIcon size={22} strokeWidth={1.6} />
                {portadaRota ? "No se pudo cargar" : "Vista previa"}
              </span>
            )}
          </div>
          <label className="pf-campo">
            <span className="pf-etq">Dirección de la imagen</span>
            <input
              name="coverImageUrl" type="url" placeholder="https://…" value={portada}
              onChange={(e) => { setPortada(e.target.value); setPortadaRota(false); }}
            />
            <span className="pf-ayuda">
              {portadaRota ? "Esa dirección no devuelve una imagen: revisá que esté bien copiada." : "Pegá el enlace a una imagen horizontal. Si la dejás vacía, se usa un degradé."}
            </span>
          </label>
        </div>
      </fieldset>

      <div className="pf-pie">
        <BotonEnviar className="pf-guardar" pendingLabel={esNuevo ? "Creando…" : "Guardando…"}>
          {esNuevo ? <Plus size={16} strokeWidth={2.2} aria-hidden="true" /> : <Check size={16} strokeWidth={2.4} aria-hidden="true" />}
          {actionLabel}
        </BotonEnviar>
        {!esNuevo && (
          <BotonEnviar
            className="pf-borrar"
            pendingLabel="Borrando…"
            confirmar="¿Borrar este plan de trabajo y todos sus días? No se puede deshacer."
            formAction={deleteProgramAction}
          >
            <Trash2 size={15} strokeWidth={2} aria-hidden="true" /> Borrar plan
          </BotonEnviar>
        )}
      </div>
    </form>
  );
}


const tituloDe = (v: VideoLookup | undefined, fallback: string) =>
  v ? (v.title_i18n?.es ?? v.title_i18n?.en ?? v.slug) : fallback;


/**
 * Cierra el panel cuando el guardado termino bien.
 * TIENE que ir dentro del <form>: useFormStatus lee el formulario que lo
 * contiene, y afuera devuelve pending=false para siempre.
 */
function CerrarAlGuardar({ onExito }: { onExito: () => void }) {
  const { pending } = useFormStatus();
  const enviando = useRef(false);
  useEffect(() => {
    if (enviando.current && !pending) onExito();
    enviando.current = pending;
  }, [pending, onExito]);
  return null;
}

export function EditarPrograma({
  program, days, videos, videoById,
}: {
  program: ProgramRecord;
  days: ProgramDayRecord[];
  videos: VideoLookup[];
  videoById: Map<string, VideoLookup>;
}) {
  const [abierto, setAbierto] = useState(false);
  const [guardado, setGuardado] = useState(false);

  useEffect(() => {
    if (!guardado) return;
    const t = window.setTimeout(() => setGuardado(false), 2600);
    return () => window.clearTimeout(t);
  }, [guardado]);

  return (
    <>
      <button type="button" onClick={() => setAbierto(true)} className="ad-editar">
        <Pencil size={14} strokeWidth={2} aria-hidden="true" /> Editar y días
      </button>

      {guardado && (
        <span role="status" style={{
          display: "inline-flex", alignItems: "center", gap: 5, marginLeft: 8,
          fontSize: 12.5, fontWeight: 800, color: "var(--salvia-deep, #3F7A45)",
          background: "var(--salvia, #E7F1E4)", padding: "6px 12px", borderRadius: 99,
        }}><Check size={13} strokeWidth={3} aria-hidden="true" /> Guardado</span>
      )}

      <AdminDrawer
        abierto={abierto}
        titulo={program.title_i18n?.es ?? program.slug}
        subtitulo={`${days.length} de ${program.duration_days} días cargados`}
        onCerrar={() => setAbierto(false)}
      >

              <div>
                <ProgramForm actionLabel="Guardar cambios" program={program} onGuardado={() => { setAbierto(false); setGuardado(true); }} />

                {/* Días */}
                <div className="adr-caja" style={{ marginTop: 26 }}>
                  <p style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 16, fontWeight: 900, color: "#3B2A2C", margin: 0 }}>
                    <span aria-hidden="true" style={{ width: 36, height: 36, borderRadius: 12, display: "grid", placeItems: "center", background: "#FFE2D3", color: "#C25E3A" }}>
                      <CalendarDays size={17} strokeWidth={2} />
                    </span>
                    Días del plan
                    <span style={{ marginLeft: "auto", fontSize: 12.5, fontWeight: 800, color: "#8A6F68", background: "#fff", padding: "4px 11px", borderRadius: 99 }}>
                      {days.length} de {program.duration_days}
                    </span>
                  </p>

                  <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 14 }}>
                    {days.length === 0 && (
                      <p style={{ fontSize: 13, color: "#8A6F68" }}>
                        Todavía no hay días. Agregá el primero abajo.
                      </p>
                    )}
                    {days.map((day) => (
                      <div key={day.id} style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        gap: 12, borderRadius: 18, border: "1px solid #F3E3DC",
                        background: "#fff", padding: 8,
                      }}>
                        <span style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, fontSize: 13.5, color: "#3B2A2C" }}>
                          <strong title={`Día ${day.day_number}`} style={{ flexShrink: 0, minWidth: 40, height: 34, padding: "0 8px", borderRadius: 12, display: "grid", placeItems: "center", background: "#FFF2EE", color: "#B03A3E", fontWeight: 900, fontSize: 13 }}>{day.day_number}</strong>
                          {/* El titulo, no el slug: Brunela no tiene por que saber
                              que "demo-barra-suelo-i" es "Barra de suelo I". */}
                          <span style={{ minWidth: 0, fontWeight: 700 }}>{tituloDe(videoById.get(day.video_id), day.video_id)}</span>
                        </span>
                        <form action={deleteProgramDayAction}>
                          <input name="id" type="hidden" value={day.id} />
                          <BotonEnviar pendingLabel="Quitando…" style={{
                            display: "inline-flex", alignItems: "center", gap: 5,
                            background: "#fff", color: "var(--pink-deep)", border: "1.5px solid var(--pink-line)",
                            borderRadius: 99, padding: "6px 12px", fontSize: 12.5, fontWeight: 800,
                            fontFamily: "inherit", cursor: "pointer", whiteSpace: "nowrap",
                          }}><X size={13} strokeWidth={2.4} aria-hidden="true" /> Quitar</BotonEnviar>
                        </form>
                      </div>
                    ))}
                  </div>

                  <form action={upsertProgramDayAction} style={{
                    display: "flex", flexWrap: "wrap",
                    gap: 10, alignItems: "flex-end", marginTop: 16,
                  }}>
                    <input name="programId" type="hidden" value={program.id} />
                    <div style={{ flex: "0 0 104px" }}><F label="Día número">
                      <input style={inp} min={1} max={program.duration_days} name="dayNumber" required type="number" />
                    </F></div>
                    <div style={{ flex: "1 1 200px", minWidth: 0 }}><F label="Clase de ese día">
                      {/* Antes era un input donde habia que escribir el slug de
                          memoria. El datalist autocompletaba, pero listaba slugs:
                          en la practica, memorizar codigos. */}
                      <Desplegable
                        style={inp}
                        name="videoSlug"
                        required
                        defaultValue=""
                        placeholder="Elegí una clase…"
                        opciones={videos.map((v) => ({ value: v.slug, label: tituloDe(v, v.slug) }))}
                      />
                    </F></div>
                    <BotonEnviar pendingLabel="Agregando…" style={{ ...botonPrincipal, height: 46, padding: "0 20px" }}>
                      <Plus size={15} strokeWidth={2.4} aria-hidden="true" /> Agregar día
                    </BotonEnviar>
                  </form>
                </div>
              </div>
      </AdminDrawer>
    </>
  );
}
