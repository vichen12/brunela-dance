"use client";

import { useState } from "react";
import { deleteVideoAction, upsertVideoAction } from "@/src/features/admin/actions";
import { BotonEnviar } from "@/components/boton-enviar";
import { AdminDrawer, BloqueAvanzado } from "@/components/admin-drawer";

/**
 * Edicion de una clase en panel lateral.
 *
 * POR QUE SE MUDO ACA
 *   La lista renderizaba el formulario COMPLETO de cada clase dentro de un
 *   <details>. Colapsado o no, React lo renderiza igual: con 19 clases eran
 *   ~250 controles de formulario en el DOM, con sus etiquetas y contenedores.
 *   Eso es lo que hacia scrollear metros y lo que trababa la pantalla.
 *
 *   Ahora el formulario NO EXISTE hasta que se abre el panel: el drawer
 *   devuelve null cerrado. De ~250 controles a 13.
 *
 * POR QUE LOS DATOS VIENEN POR PROPS Y NO SE PIDEN AL ABRIR
 *   Porque medido: las 19 clases con TODOS sus campos pesan 10,1 KB, y traer
 *   solo lo que muestra la fila ahorraria 2 KB. Una segunda consulta por cada
 *   apertura costaria mas -- en latencia y en codigo -- de lo que ahorra.
 *
 *   El calculo cambia con el volumen: a 500 clases serian ~265 KB y ahi si
 *   conviene recortar la consulta de la lista y pedir la fila completa al
 *   abrir. Cuando pase de ~150 clases, revisarlo.
 */

type AudioTrack = { locale: string; label: string; muxed_at?: string };

export type VideoRecord = {
  id: string;
  slug: string;
  title_i18n: Record<string, string>;
  description_i18n: Record<string, string>;
  status: "draft" | "published" | "archived";
  membership_tier_required: "corps_de_ballet" | "solista" | "principal";
  duration_seconds: number;
  category_slugs: string[];
  equipment: string[];
  thumbnail_url: string | null;
  stream_playback_id: string | null;
  stream_asset_id: string | null;
  bunny_video_id: string | null;
  audio_tracks: AudioTrack[];
  is_featured: boolean;
};

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


function Lbl({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ display: "block", fontSize: 10, fontWeight: 700, letterSpacing: "0.09em", color: "#78716c", textTransform: "uppercase", marginBottom: 5 }}>
      {children}
    </span>
  );
}

/** Etiqueta + campo. */
function F({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column" }}>
      <Lbl>{label}</Lbl>
      {children}
    </label>
  );
}

function VideoForm({ video }: { video: VideoRecord }) {
  // Read-only: audio_tracks is owned by the mux worker, not by this form.
  const muxedLocales = (video.audio_tracks ?? []).map((t) => t.locale);

  return (
    <form action={upsertVideoAction}>
      <input name="id" type="hidden" value={video.id} />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <F label="Dirección">
          {/* Solo lectura: cambiar el slug de una clase publicada rompe
              cualquier enlace que alguien haya guardado o compartido. Se muestra
              porque es la direccion de esa clase y a Brunela le sirve verla. */}
          <input style={{ ...inp, background: "#fafaf9", color: "#78716c" }} defaultValue={video.slug} name="slug" readOnly />
        </F>
        <F label="Estado">
          <select style={sel} defaultValue={video.status} name="status">
            <option value="draft">Borrador</option>
            <option value="published">Publicado</option>
            <option value="archived">Archivado</option>
          </select>
        </F>

        <F label="Título en español">
          <input style={inp} defaultValue={video.title_i18n?.es ?? ""} name="titleEs" required placeholder="Ballet centro basico" />
        </F>

        <F label="Duración (minutos)">
          {/* En minutos, que es como piensa una clase quien la da. La conversion
              a segundos se hace en la accion: la base sigue guardando segundos. */}
          <input style={inp} defaultValue={Math.round(video.duration_seconds / 60)} min={1} name="durationMinutes" required type="number" />
        </F>
        <F label="Plan que la puede ver">
          <select style={sel} defaultValue={video.membership_tier_required} name="membershipTierRequired">
            <option value="corps_de_ballet">Corps de Ballet</option>
            <option value="solista">Solista</option>
            <option value="principal">Principal</option>
          </select>
        </F>


        {/* Los campos "Mux Playback ID" y "Mux Asset ID" salieron el 2026-08-03:
            Mux fue reemplazado por Bunny, y esos valores los escribe sola la ruta
            de finalizacion de subida. Editarlos a mano solo podia romper la
            reproduccion.

            OJO: stream_playback_id NO es basura -- Bunny lo escribe con la URL
            del HLS y el proxy de video lo usa como respaldo para las clases
            viejas. Lo que se saco es el CAMPO del formulario, no la columna. */}
        <div style={{ display: "flex", alignItems: "center", paddingTop: 20 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
            <input defaultChecked={video.is_featured} name="isFeatured" type="checkbox" style={{ width: 16, height: 16, accentColor: "var(--pink-mid)" }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: "#44403c" }}>Destacar este video</span>
          </label>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 14 }}>
        <F label="Descripción en español">
          <textarea style={{ ...inp, minHeight: 80, resize: "vertical" }} defaultValue={video?.description_i18n?.es ?? ""} name="descriptionEs" required placeholder="Descripción de la clase…" />
        </F>
      </div>

      <div style={{ marginTop: 14, borderRadius: 12, padding: "16px 18px", background: "#fafaf9", border: "1px solid #f0eeec" }}>
        <Lbl>Pistas de audio por idioma</Lbl>
        <div style={{ fontSize: 11, color: "#78716c", marginTop: 8, lineHeight: 1.7 }}>
          {muxedLocales.length > 0 ? (
            <>
              Idiomas ya integrados en el video:{" "}
              <strong style={{ color: "#1c1917" }}>
                {["es", ...muxedLocales].join(", ").toUpperCase()}
              </strong>
            </>
          ) : (
            <>Solo espanol. Los idiomas extra se cargan al subir la clase, como un mp3 por idioma.</>
          )}
          <div style={{ marginTop: 6, color: "#a8a29e" }}>
            Esto no se edita a mano: el worker de muxeo lo escribe cuando verifica que el
            idioma quedo dentro del video.
          </div>
        </div>
      </div>


        <BloqueAvanzado titulo="Traducción al inglés" cantidad={2}>
        <F label="Título en inglés">
          <input style={inp} defaultValue={video.title_i18n?.en ?? ""} name="titleEn" placeholder="Basic ballet center" />
        </F>
        <F label="Descripción en inglés">
          <textarea style={{ ...inp, minHeight: 80, resize: "vertical" }} defaultValue={video?.description_i18n?.en ?? ""} name="descriptionEn" placeholder="Class description..." />
        </F>
        </BloqueAvanzado>

        <BloqueAvanzado titulo="Clasificación y portada" cantidad={3}>
        <F label="Categorías">
          <input style={inp} defaultValue={video.category_slugs?.join(", ") ?? ""} name="categories" placeholder="ballet, reformer" />
        </F>
        <F label="Materiales">
          <input style={inp} defaultValue={video.equipment?.join(", ") ?? ""} name="equipment" placeholder="colchoneta, banda elastica" />
        </F>
        <F label="Imagen de portada">
          <input style={inp} defaultValue={video.thumbnail_url ?? ""} name="thumbnailUrl" placeholder="https://..." type="url" />
        </F>
        </BloqueAvanzado>

      <div style={{ marginTop: 18, display: "flex", gap: 10 }}>
        <BotonEnviar style={{
          background: "#1c1917",
          color: "#fff", border: "none", borderRadius: 99,
          padding: "10px 24px", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em",
          cursor: "pointer",
        }}>GUARDAR CAMBIOS</BotonEnviar>
        {/* formAction en el boton, NO un <form> adentro de otro <form>.
            Los formularios anidados son HTML invalido: el parser descarta el
            interno, asi que el boton quedaba como submit del formulario de
            arriba y ELIMINAR terminaba llamando a upsertVideoAction. O sea que
            no borraba: guardaba. El id ya viaja en el hidden del form externo,
            que es el que deleteVideoAction lee. */}
        {(
          <BotonEnviar pendingLabel="Borrando…" formAction={deleteVideoAction} style={{
            background: "transparent", color: "#ef4444", border: "1px solid #fecaca",
            borderRadius: 99, padding: "10px 22px", fontSize: 11, fontWeight: 700,
            letterSpacing: "0.1em", cursor: "pointer",
          }}>ELIMINAR</BotonEnviar>
        )}
      </div>
    </form>
  );
}

/** El boton de la fila y su panel. Uno por clase, pero solo uno abierto. */
export function EditarClase({ video }: { video: VideoRecord }) {
  const [abierto, setAbierto] = useState(false);

  return (
    <>
      <button
        onClick={() => setAbierto(true)}
        style={{
          padding: "6px 14px", borderRadius: 8, cursor: "pointer",
          border: "1px solid #f0eeec", background: "#fff",
          color: "#57534e", fontSize: 11, fontWeight: 700, fontFamily: "inherit",
        }}
      >Editar</button>

      <AdminDrawer
        abierto={abierto}
        titulo={video.title_i18n?.es ?? video.slug}
        subtitulo={`/${video.slug}`}
        onCerrar={() => setAbierto(false)}
      >
        <VideoForm video={video} />
      </AdminDrawer>
    </>
  );
}
