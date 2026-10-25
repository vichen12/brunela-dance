"use client";
import { CalendarDays, Check, Minus, Moon, Pencil, Plus, Trash2, X } from "lucide-react";
import { AutoDireccion } from "@/components/auto-direccion";
import { SubirPortadaClase } from "@/components/subir-portada-clase";
import { ElegirConBuscador, type OpcionBuscable } from "@/components/elegir-con-buscador";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { BotonEnviar } from "@/components/boton-enviar";
import { AdminDrawer, botonPrincipal, campoSuave, etiquetaSuave } from "@/components/admin-drawer";
import {
  deleteProgramAction,
  deleteProgramDayAction,
  upsertProgramAction,
} from "@/src/features/admin/actions";
import { guardarDiaDePlanAction } from "@/src/features/admin/dias-de-plan-actions";
import { primerDiaLibre } from "@/src/features/admin/planes-de-trabajo";
import {
  AVISO_FALTA_MIGRACION_DESCANSO,
  NOTA_DESCANSO_MAX,
  NOTA_DESCANSO_POR_DEFECTO,
  diasSinCargar,
} from "@/src/features/studio/dias-de-plan";

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

/** `es_descanso` y `nota` llegan solo si corrio 20261025_dia_de_descanso.sql. */
export type ProgramDayRecord = {
  id: string;
  program_id: string;
  day_number: number;
  video_id: string | null;
  es_descanso?: boolean;
  nota?: string | null;
};
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
        {/* Antes era un campo para pegar la direccion de una imagen: Brunela no
            sabia de donde sacarla. Ahora se sube la foto, igual que en las
            clases (bucket publico landing-media). El campo sigue llamandose
            coverImageUrl y lleva una URL: upsertProgramAction no cambia, y una
            portada vieja pegada a mano se sigue viendo y se puede cambiar. */}
        <SubirPortadaClase
          name="coverImageUrl"
          defaultValue={program?.cover_image_url ?? ""}
          ayudaVacio="Elegí una foto horizontal. Si no ponés ninguna, se usa un degradé."
          ayudaLista="Es la imagen que ven las alumnas en la tarjeta del plan y arriba de su ficha."
        />
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
  program, days, videos, videoById, descansoDisponible,
}: {
  program: ProgramRecord;
  days: ProgramDayRecord[];
  videos: VideoLookup[];
  videoById: Map<string, VideoLookup>;
  /** false si falta la migracion 20261025_dia_de_descanso.sql. */
  descansoDisponible: boolean;
}) {
  const [abierto, setAbierto] = useState(false);
  const [guardado, setGuardado] = useState(false);

  useEffect(() => {
    if (!guardado) return;
    const t = window.setTimeout(() => setGuardado(false), 2600);
    return () => window.clearTimeout(t);
  }, [guardado]);

  const descansos = days.filter((d) => d.es_descanso).length;

  return (
    <>
      <button type="button" onClick={() => setAbierto(true)} className="ad-editar">
        <Pencil size={14} strokeWidth={2} aria-hidden="true" /> Editar y días
      </button>

      {guardado && (
        <span role="status" style={{
          display: "inline-flex", alignItems: "center", gap: 5, marginLeft: 8,
          fontSize: 12.5, fontWeight: 800, color: "var(--pink-deep)",
          background: "var(--rubor)", padding: "6px 12px", borderRadius: 99,
        }}><Check size={13} strokeWidth={3} aria-hidden="true" /> Guardado</span>
      )}

      <AdminDrawer
        abierto={abierto}
        titulo={program.title_i18n?.es ?? program.slug}
        subtitulo={`${days.length} de ${program.duration_days} días cargados` + (descansos > 0 ? ` · ${descansos} de descanso` : "")}
        onCerrar={() => setAbierto(false)}
      >
        <div>
          <ProgramForm actionLabel="Guardar cambios" program={program} onGuardado={() => { setAbierto(false); setGuardado(true); }} />
          <DiasDelPlan program={program} days={days} videos={videos} videoById={videoById} descansoDisponible={descansoDisponible} />
        </div>
      </AdminDrawer>
    </>
  );
}

const VALOR_DESCANSO = "descanso";

const botonChico: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 5,
  background: "#fff", color: "var(--pink-deep)", border: "1.5px solid var(--pink-line)",
  borderRadius: 99, padding: "6px 12px", fontSize: 12.5, fontWeight: 800,
  fontFamily: "inherit", cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0,
};

const numeroDia = (descanso: boolean, hueco = false): React.CSSProperties => ({
  flexShrink: 0, minWidth: 40, height: 34, padding: "0 8px", borderRadius: 12, display: "grid", placeItems: "center",
  fontWeight: 900, fontSize: 13,
  ...(hueco
    ? { background: "#fff", color: "#B39189", border: "1px dashed #EBCFC4" }
    : descanso
      ? { background: "#FFE8D6", color: "#C25E3A" }
      : { background: "#FFF2EE", color: "#B03A3E" }),
});

/**
 * Los dias del plan, EN ORDEN, con los huecos a la vista.
 *
 * Cada numero de 1 a la duracion es una fila: una clase, un descanso, o
 * «sin cargar» con un boton que prepara el formulario de abajo con ese numero.
 * Antes la lista mostraba solo lo cargado (1, 2, 3, 5, 6...) y el 4 que
 * faltaba no se veia hasta que la alumna llegaba ahi.
 *
 * Cada fila cargada se EDITA EN EL LUGAR (cambiar la clase, pasarla a
 * descanso, cambiar el mensaje) sin tener que quitarla y volver a agregarla.
 */
function DiasDelPlan({
  program, days, videos, videoById, descansoDisponible,
}: {
  program: ProgramRecord;
  days: ProgramDayRecord[];
  videos: VideoLookup[];
  videoById: Map<string, VideoLookup>;
  descansoDisponible: boolean;
}) {
  const porNumero = new Map(days.map((d) => [d.day_number, d]));
  const [dia, setDia] = useState<number>(() => primerDiaLibre(days.map((d) => d.day_number)));
  const [editando, setEditando] = useState<number | null>(null);
  const campoDia = useRef<HTMLInputElement>(null);

  // Al guardar llegan los dias nuevos: el numero salta al proximo hueco y la
  // fila que se estaba editando se cierra.
  const firma = days.map((d) => `${d.day_number}:${d.video_id ?? "d"}:${d.nota ?? ""}`).join(",");
  useEffect(() => {
    setDia(primerDiaLibre(firma ? firma.split(",").map((x) => Number(x.split(":")[0])) : []));
    setEditando(null);
  }, [firma]);

  const hasta = Math.max(program.duration_days, ...days.map((d) => d.day_number), 0);
  const huecos = new Set(diasSinCargar(porNumero.keys(), program.duration_days));
  const ocupado = porNumero.get(dia);

  const opciones: OpcionBuscable[] = videos.map((v) => ({ value: v.id, label: tituloDe(v, v.slug) }));
  const fijas: OpcionBuscable[] = descansoDisponible
    ? [{ value: VALOR_DESCANSO, label: "Descanso", detalle: "Un día sin clase, con un mensaje para ella", icono: <Moon size={15} strokeWidth={2.2} /> }]
    : [];

  function prepararDia(n: number) {
    setDia(n);
    campoDia.current?.scrollIntoView({ block: "center", behavior: "smooth" });
    campoDia.current?.focus();
  }

  return (
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
        {days.length > 0 && Array.from({ length: hasta }, (_, i) => i + 1).map((n) => {
          const day = porNumero.get(n);
          if (!day) {
            if (!huecos.has(n)) return null;
            return (
              <div key={`hueco-${n}`} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
                borderRadius: 18, border: "1.5px dashed #EBCFC4", background: "#FFFAF6", padding: 8,
              }}>
                <span style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, fontSize: 13.5, color: "#8A6F68" }}>
                  <strong style={numeroDia(false, true)}>{n}</strong>
                  <span style={{ fontWeight: 700 }}>Día {n} — sin cargar</span>
                </span>
                <button type="button" onClick={() => prepararDia(n)} style={botonChico}>
                  <Plus size={13} strokeWidth={2.4} aria-hidden="true" /> Agregar
                </button>
              </div>
            );
          }

          const descanso = Boolean(day.es_descanso);
          const abiertoAca = editando === n;
          return (
            <div key={day.id} style={{
              borderRadius: 18, border: abiertoAca ? "1.5px solid var(--pink-line)" : "1px solid #F3E3DC",
              background: descanso ? "#FFF6EF" : "#fff", padding: 8,
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, fontSize: 13.5, color: "#3B2A2C" }}>
                  <strong title={`Día ${day.day_number}`} style={numeroDia(descanso)}>{day.day_number}</strong>
                  {descanso ? (
                    <span style={{ minWidth: 0, display: "flex", flexDirection: "column" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 800, color: "#C25E3A" }}>
                        <Moon size={14} strokeWidth={2.2} aria-hidden="true" /> Descanso
                      </span>
                      <span style={{ fontSize: 12.5, color: "#8A6F68", lineHeight: 1.45, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                        {day.nota?.trim() || NOTA_DESCANSO_POR_DEFECTO}
                      </span>
                    </span>
                  ) : (
                    // El titulo, no el slug: Brunela no tiene por que saber que
                    // "demo-barra-suelo-i" es "Barra de suelo I".
                    <span style={{ minWidth: 0, fontWeight: 700 }}>{tituloDe(day.video_id ? videoById.get(day.video_id) : undefined, day.video_id ?? "clase")}</span>
                  )}
                </span>
                <span style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  <button
                    type="button" style={botonChico} aria-expanded={abiertoAca}
                    onClick={() => setEditando(abiertoAca ? null : n)}
                  >
                    {abiertoAca ? <><X size={13} strokeWidth={2.4} aria-hidden="true" /> Cerrar</> : <><Pencil size={12} strokeWidth={2.4} aria-hidden="true" /> Cambiar</>}
                  </button>
                  {!abiertoAca && (
                    <form action={deleteProgramDayAction}>
                      <input name="id" type="hidden" value={day.id} />
                      <BotonEnviar pendingLabel="Quitando…" style={botonChico}>
                        <X size={13} strokeWidth={2.4} aria-hidden="true" /> Quitar
                      </BotonEnviar>
                    </form>
                  )}
                </span>
              </div>

              {abiertoAca && (
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px dashed #EBCFC4" }}>
                  <FormDia
                    programId={program.id}
                    diaFijo={day.day_number}
                    opciones={opciones}
                    fijas={fijas}
                    inicial={descanso ? VALOR_DESCANSO : day.video_id ?? ""}
                    notaInicial={day.nota?.trim() || NOTA_DESCANSO_POR_DEFECTO}
                    etiquetaBoton="Guardar el día"
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {!descansoDisponible && (
        <p role="note" style={{ marginTop: 14, fontSize: 12.5, lineHeight: 1.5, color: "#C25E3A", background: "#FFF4E8", padding: "8px 12px", borderRadius: 12, fontWeight: 700 }}>
          {AVISO_FALTA_MIGRACION_DESCANSO}
        </p>
      )}

      <div style={{ marginTop: 16 }}>
        <FormDia
          programId={program.id}
          dia={dia}
          setDia={setDia}
          campoDia={campoDia}
          opciones={opciones}
          fijas={fijas}
          inicial=""
          notaInicial={NOTA_DESCANSO_POR_DEFECTO}
          aviso={ocupado ? (
            <>El día {dia} ya tiene {ocupado.es_descanso ? "un descanso" : `«${tituloDe(ocupado.video_id ? videoById.get(ocupado.video_id) : undefined, "una clase")}»`}: se reemplaza.</>
          ) : null}
        />
      </div>
    </div>
  );
}

/**
 * El formulario de UN dia: elegir clase (con buscador) o «Descanso», y el
 * mensaje si es descanso. Lo usan el alta (con el numero de dia editable) y
 * la edicion en el lugar (con el numero fijo).
 */
function FormDia({
  programId, diaFijo, dia, setDia, campoDia, opciones, fijas, inicial, notaInicial, aviso, etiquetaBoton,
}: {
  programId: string;
  /** Edicion: el numero no se cambia. */
  diaFijo?: number;
  dia?: number;
  setDia?: (n: number) => void;
  campoDia?: React.RefObject<HTMLInputElement | null>;
  opciones: OpcionBuscable[];
  fijas: OpcionBuscable[];
  inicial: string;
  notaInicial: string;
  aviso?: React.ReactNode;
  etiquetaBoton?: string;
}) {
  const [eleccion, setEleccion] = useState(inicial);
  const esDescanso = eleccion === VALOR_DESCANSO;
  const hayDescanso = fijas.length > 0;

  return (
    <form action={guardarDiaDePlanAction} style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-end" }}>
      <input name="programId" type="hidden" value={programId} />
      {diaFijo !== undefined ? (
        <input name="dayNumber" type="hidden" value={diaFijo} />
      ) : (
        <div style={{ flex: "0 0 104px" }}><F label="Día número">
          <input
            ref={campoDia} style={inp} min={1} max={365} name="dayNumber" required type="number"
            value={dia} onChange={(e) => setDia?.(Math.max(1, Number(e.target.value) || 1))}
          />
        </F></div>
      )}
      <div style={{ flex: "1 1 240px", minWidth: 0 }}>
        <Lbl>{diaFijo !== undefined ? `Qué va el día ${diaFijo}` : "Clase de ese día"}</Lbl>
        {/* Con muchas clases, un desplegable de todas no se podia recorrer:
            ahora se escribe y se filtra (sin importar tildes). «Descanso»
            queda siempre primero. */}
        <ElegirConBuscador
          name="eleccion"
          required
          etiqueta={diaFijo !== undefined ? `Qué va el día ${diaFijo}` : "Clase de ese día"}
          placeholder={hayDescanso ? "Buscá una clase o elegí «Descanso»…" : "Buscá una clase por su título…"}
          opciones={opciones}
          fijas={fijas}
          defaultValue={inicial}
          onChange={setEleccion}
        />
      </div>

      {esDescanso && (
        <label style={{ flex: "1 1 100%", display: "flex", flexDirection: "column" }}>
          <Lbl>Mensaje para ese día · lo lee la alumna, podés cambiarlo</Lbl>
          <textarea
            name="nota" rows={4} maxLength={NOTA_DESCANSO_MAX}
            defaultValue={notaInicial}
            style={{ ...inp, resize: "vertical", lineHeight: 1.5 }}
          />
        </label>
      )}

      {aviso && (
        <p style={{ flex: "1 1 100%", margin: 0, fontSize: 12.5, fontWeight: 700, color: "#C25E3A" }}>{aviso}</p>
      )}

      <BotonEnviar pendingLabel="Guardando…" style={{ ...botonPrincipal, height: 46, padding: "0 20px" }}>
        {diaFijo !== undefined
          ? <><Check size={15} strokeWidth={2.4} aria-hidden="true" /> {etiquetaBoton ?? "Guardar"}</>
          : <><Plus size={15} strokeWidth={2.4} aria-hidden="true" /> {esDescanso ? "Agregar descanso" : "Agregar día"}</>}
      </BotonEnviar>
    </form>
  );
}
