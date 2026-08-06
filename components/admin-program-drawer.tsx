"use client";
import { AutoDireccion } from "@/components/auto-direccion";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { BotonEnviar } from "@/components/boton-enviar";
import { AdminDrawer, BloqueAvanzado } from "@/components/admin-drawer";
import {
  deleteProgramAction,
  deleteProgramDayAction,
  upsertProgramAction,
  upsertProgramDayAction,
} from "@/src/features/admin/actions";

/**
 * Edicion de un programa y sus dias, en panel lateral.
 *
 * LAS OPCIONES DEL SELECTOR DE CLASES
 *   El <select> para agregar un dia lista TODAS las clases, y se renderizaba
 *   una vez por programa aunque nadie lo abriera. Medido hoy: 3 programas x 19
 *   clases = 57 opciones. Con 20 programas y 100 clases serian 2.000.
 *
 *   Escala con el PRODUCTO de programas por clases, que es la peor forma de
 *   escalar. Dentro del panel se renderiza uno solo, el del programa abierto.
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

const inp: React.CSSProperties = {
  width: "100%", borderRadius: 10, border: "1px solid #e7e5e4",
  background: "#fff", color: "#1c1917", padding: "9px 13px",
  fontSize: 13, outline: "none", fontFamily: "inherit",
};

const sel: React.CSSProperties = {
  ...inp, appearance: "none",
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath d='M2 4l4 4 4-4' stroke='%23a8a29e' strokeWidth='1.5' strokeLinecap='round' fill='none'/%3E%3C/svg%3E")`,
  backgroundRepeat: "no-repeat", backgroundPosition: "right 12px center", paddingRight: 34,
};

const tarjeta: React.CSSProperties = {
  background: "#fff", border: "1px solid #f0eeec", borderRadius: 16,
};

function Lbl({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ display: "block", fontSize: 10, fontWeight: 700, letterSpacing: "0.09em", color: "#78716c", textTransform: "uppercase", marginBottom: 5 }}>
      {children}
    </span>
  );
}
function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <label style={{ display: "flex", flexDirection: "column" }}><Lbl>{label}</Lbl>{children}</label>;
}
/**
 * El formulario del programa. Se exporta porque lo usan los DOS caminos: el
 * alta (en la pagina, sin panel) y la edicion (dentro del drawer). Una copia
 * por camino garantiza que en unos meses uno tenga un campo que el otro no.
 */
export function ProgramForm({ actionLabel, program, onGuardado }: { actionLabel: string; program?: ProgramRecord; onGuardado?: () => void }) {
  const esNuevo = !program;

  return (
    <form action={upsertProgramAction}>
      {onGuardado && <CerrarAlGuardar onExito={onGuardado} />}
      <input name="id" type="hidden" value={program?.id ?? ""} />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <F label={esNuevo ? "Dirección del programa" : "Dirección"}>
          {/* Al editar es solo lectura: cambiarla rompe cualquier enlace ya
              compartido. Al crear hace falta, porque todavia no existe. */}
          <input
            style={esNuevo ? inp : { ...inp, background: "#fafaf9", color: "#78716c" }}
            defaultValue={program?.slug ?? ""}
            name="slug"
            required
            readOnly={!esNuevo}
            placeholder="fundamentos-7-dias"
          />
            <AutoDireccion desde="titleEs" activo={esNuevo} />
        </F>

        <F label="Cuántos días dura">
          <input style={inp} defaultValue={program?.duration_days ?? 14} min={1} name="durationDays" required type="number" />
        </F>

        <F label="Título en español">
          <input style={inp} defaultValue={program?.title_i18n?.es ?? ""} name="titleEs" required placeholder="Fundamentos en 7 días" />
        </F>

        <F label="Título en inglés">
          <input style={inp} defaultValue={program?.title_i18n?.en ?? ""} name="titleEn" placeholder="Fundamentals in 7 days" />
        </F>

        <F label="Plan que lo puede ver">
          <select style={sel} defaultValue={program?.membership_tier_required ?? "solista"} name="membershipTierRequired">
            <option value="solista">Solista</option>
            <option value="principal">Principal</option>
          </select>
        </F>

        <F label="Estado">
          <select style={sel} defaultValue={program?.status ?? "draft"} name="status">
            <option value="draft">Borrador</option>
            <option value="published">Publicado</option>
            <option value="archived">Archivado</option>
          </select>
        </F>

        <F label="Imagen de portada">
          <input style={inp} defaultValue={program?.cover_image_url ?? ""} name="coverImageUrl" placeholder="https://..." />
        </F>

        <div style={{ display: "flex", alignItems: "center", paddingTop: 20 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
            <input defaultChecked={program?.is_featured ?? false} name="isFeatured" type="checkbox" style={{ width: 16, height: 16, accentColor: "var(--pink)" }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: "#44403c" }}>Destacar este programa</span>
          </label>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 14 }}>
        <F label="Descripción en español">
          <textarea style={{ ...inp, minHeight: 78, resize: "vertical" }} defaultValue={program?.description_i18n?.es ?? ""} name="descriptionEs" required placeholder="Qué trabaja este programa…" />
        </F>
        <F label="Descripción en inglés">
          <textarea style={{ ...inp, minHeight: 78, resize: "vertical" }} defaultValue={program?.description_i18n?.en ?? ""} name="descriptionEn" />
        </F>
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
        <button type="submit" style={{
          background: esNuevo ? "var(--pink)" : "#1c1917", color: "#fff", border: "none",
          borderRadius: 99, padding: "10px 24px", fontSize: 11, fontWeight: 700,
          letterSpacing: "0.1em", cursor: "pointer",
        }}>{actionLabel}</button>

        {!esNuevo && (
          <BotonEnviar pendingLabel="Borrando…" formAction={deleteProgramAction} style={{
            background: "transparent", color: "#ef4444", border: "1px solid #fecaca",
            borderRadius: 99, padding: "10px 22px", fontSize: 11, fontWeight: 700,
            letterSpacing: "0.1em", cursor: "pointer",
          }}>ELIMINAR</BotonEnviar>
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
      <button
        onClick={() => setAbierto(true)}
        style={{
          padding: "6px 14px", borderRadius: 8, cursor: "pointer",
          border: "1px solid #f0eeec", background: "#fff",
          color: "#57534e", fontSize: 11, fontWeight: 700, fontFamily: "inherit",
        }}
      >Editar y días</button>

      {guardado && (
        <span style={{
          marginLeft: 8, fontSize: 10.5, fontWeight: 700,
          color: "#166534", background: "#f0fdf4",
          padding: "4px 10px", borderRadius: 99,
        }}>Guardado</span>
      )}

      <AdminDrawer
        abierto={abierto}
        titulo={program.title_i18n?.es ?? program.slug}
        subtitulo={`${days.length} de ${program.duration_days} días cargados`}
        onCerrar={() => setAbierto(false)}
      >

              <div style={{ borderTop: "1px solid #f0eeec", padding: "22px" }}>
                <ProgramForm actionLabel="GUARDAR CAMBIOS" program={program} onGuardado={() => { setAbierto(false); setGuardado(true); }} />

                {/* Días */}
                <div style={{ marginTop: 26, borderTop: "1px solid #f0eeec", paddingTop: 20 }}>
                  <Lbl>Días del programa</Lbl>

                  <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10 }}>
                    {days.length === 0 && (
                      <p style={{ fontSize: 12.5, color: "#a8a29e" }}>
                        Todavía no hay días. Agregá el primero abajo.
                      </p>
                    )}
                    {days.map((day) => (
                      <div key={day.id} style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        gap: 14, borderRadius: 12, border: "1px solid #f0eeec",
                        background: "#fafaf9", padding: "10px 14px",
                      }}>
                        <span style={{ fontSize: 13, color: "#1c1917" }}>
                          <strong style={{ fontWeight: 700 }}>Día {day.day_number}</strong>
                          {/* El titulo, no el slug: Brunela no tiene por que saber
                              que "demo-barra-suelo-i" es "Barra de suelo I". */}
                          <span style={{ color: "#78716c" }}> — {tituloDe(videoById.get(day.video_id), day.video_id)}</span>
                        </span>
                        <form action={deleteProgramDayAction}>
                          <input name="id" type="hidden" value={day.id} />
                          <BotonEnviar style={{
                            background: "transparent", color: "#ef4444", border: "1px solid #fecaca",
                            borderRadius: 99, padding: "5px 14px", fontSize: 10, fontWeight: 700,
                            letterSpacing: "0.08em", cursor: "pointer",
                          }}>QUITAR</BotonEnviar>
                        </form>
                      </div>
                    ))}
                  </div>

                  <form action={upsertProgramDayAction} style={{
                    display: "grid", gridTemplateColumns: "120px 1fr auto",
                    gap: 12, alignItems: "end", marginTop: 14,
                  }}>
                    <input name="programId" type="hidden" value={program.id} />
                    <F label="Día número">
                      <input style={inp} min={1} max={program.duration_days} name="dayNumber" required type="number" />
                    </F>
                    <F label="Clase de ese día">
                      {/* Antes era un input donde habia que escribir el slug de
                          memoria. El datalist autocompletaba, pero listaba slugs:
                          en la practica, memorizar codigos. */}
                      <select style={sel} name="videoSlug" required defaultValue="">
                        <option value="" disabled>Elegí una clase…</option>
                        {videos.map((v) => (
                          <option key={v.id} value={v.slug}>{tituloDe(v, v.slug)}</option>
                        ))}
                      </select>
                    </F>
                    <BotonEnviar style={{
                      background: "var(--pink)", color: "#fff", border: "none", borderRadius: 99,
                      padding: "9px 20px", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em",
                      cursor: "pointer", whiteSpace: "nowrap",
                    }}>AGREGAR DÍA</BotonEnviar>
                  </form>
                </div>
              </div>
      </AdminDrawer>
    </>
  );
}
