"use client";
import { SubirPortadaClase } from "@/components/subir-portada-clase";

import { Desplegable } from "@/components/desplegable";
import { Check, Pencil, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { deleteVideoAction, upsertVideoAction } from "@/src/features/admin/actions";
import { BotonEnviar } from "@/components/boton-enviar";
import { AdminDrawer, BloqueAvanzado, botonBorrar, botonPrincipal, campoSuave, etiquetaSuave } from "@/components/admin-drawer";
import { SelectorMultiple } from "@/components/selector-multiple";
import { SelectorDePlanes } from "@/components/selector-de-planes";
import { BloqueSoloParaVos } from "@/components/bloque-solo-para-vos";
import { ClaseEnPlanes } from "@/components/clase-en-planes";
import type { PlanParaElegir, UbicacionEnPlan } from "@/src/features/admin/planes-de-trabajo";
import {
  CATEGORIAS,
  ESTADOS,
  MATERIALES,
  NIVELES,
  PLANES,
  SIN_MATERIAL,
  TIPOS_DE_CONTENIDO,
  planesDesde,
  rangoANivel
} from "@/src/features/studio/catalogo-clases";

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
  /** Lo que de verdad decide quien ve la clase. Ver la migracion 20260921. */
  planes_permitidos: string[] | null;
  content_type: string | null;
  recommended_min_level: string | null;
  recommended_max_level: string | null;
  duration_seconds: number;
  category_slugs: string[];
  equipment: string[];
  thumbnail_url: string | null;
  stream_playback_id: string | null;
  bunny_video_id: string | null;
  audio_tracks: AudioTrack[];
  is_featured: boolean;
};

const inp = campoSuave;

function Lbl({ children }: { children: React.ReactNode }) {
  return <span style={etiquetaSuave}>{children}</span>;
}

/**
 * Cierra el panel cuando el guardado TERMINO BIEN.
 *
 * COMO SABE QUE SALIO BIEN
 *   `pending` pasa de true a false tanto si guardo como si fallo. Lo que los
 *   distingue es que un ERROR navega -- redirectWithMessage lleva a
 *   /admin/videos?error=... -- y al navegar este componente se desmonta. Asi
 *   que si `pending` volvio a false y seguimos montados, guardo.
 *
 * TIENE QUE ESTAR DENTRO DEL <form>: useFormStatus lee el formulario que lo
 * contiene. Afuera devuelve pending=false para siempre y no cierra nunca.
 */
function CerrarAlGuardar({ onExito }: { onExito: () => void }) {
  const { pending } = useFormStatus();
  const estabaEnviando = useRef(false);

  useEffect(() => {
    if (estabaEnviando.current && !pending) onExito();
    estabaEnviando.current = pending;
  }, [pending, onExito]);

  return null;
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

function VideoForm({
  video,
  planes,
  ubicaciones,
  onGuardado,
}: {
  video: VideoRecord;
  planes: PlanParaElegir[];
  ubicaciones: UbicacionEnPlan[];
  onGuardado: () => void;
}) {
  // Read-only: audio_tracks is owned by the mux worker, not by this form.
  const muxedLocales = (video.audio_tracks ?? []).map((t) => t.locale);

  return (
    <form action={upsertVideoAction}>
      <CerrarAlGuardar onExito={onGuardado} />
      <input name="id" type="hidden" value={video.id} />

      {/* El mismo orden que el formulario de subida, a proposito: subir y
          editar son la misma tarea en dos momentos, y dos ordenes distintos
          obligan a volver a buscar cada campo. */}

      {/* 1 y 2 — los dos titulos */}
      <div className="adr-g2">
        <F label="Título en español">
          <input style={inp} defaultValue={video.title_i18n?.es ?? ""} name="titleEs" required placeholder="Ballet centro basico" />
        </F>
        <F label="Título en inglés">
          <input style={inp} defaultValue={video.title_i18n?.en ?? ""} name="titleEn" placeholder="Basic ballet center" />
        </F>
      </div>

      {/* 3 y 4 — las dos descripciones */}
      <div className="adr-g2" style={{ marginTop: 14 }}>
        <F label="Descripción en español">
          <textarea style={{ ...inp, minHeight: 80, resize: "vertical" }} defaultValue={video?.description_i18n?.es ?? ""} name="descriptionEs" required placeholder="Descripción de la clase…" />
        </F>
        <F label="Descripción en inglés">
          <textarea style={{ ...inp, minHeight: 80, resize: "vertical" }} defaultValue={video?.description_i18n?.en ?? ""} name="descriptionEn" placeholder="Class description..." />
        </F>
      </div>

      {/* 5 a 8 — como se clasifica la clase */}
      <div className="adr-g2" style={{ marginTop: 14 }}>
        <F label="Tipo de contenido">
          <Desplegable
            style={inp}
            defaultValue={video.content_type ?? "clase"}
            name="contentType"
            opciones={TIPOS_DE_CONTENIDO.map((t) => ({ value: t.slug, label: t.label }))}
          />
        </F>
        <F label="Categoría / Colección">
          {/* La columna es un array y el formulario elige una: se muestra la
              primera. Una clase vieja con dos categorias conserva la segunda
              hasta que alguien guarde, y ahi queda con la elegida. */}
          <Desplegable
            style={inp}
            defaultValue={video.category_slugs?.[0] ?? CATEGORIAS[0].slug}
            name="categorySlug"
            required
            opciones={CATEGORIAS.map((c) => ({ value: c.slug, label: c.label }))}
          />
        </F>
        <F label="Nivel">
          <Desplegable
            style={inp}
            defaultValue={rangoANivel(video.recommended_min_level, video.recommended_max_level)}
            name="nivel"
            opciones={NIVELES.map((n) => ({ value: n.slug, label: n.label }))}
          />
        </F>
        <F label="Duración (minutos)">
          {/* En minutos, que es como piensa una clase quien la da. La conversion
              a segundos se hace en la accion: la base sigue guardando segundos. */}
          <input style={inp} defaultValue={Math.round(video.duration_seconds / 60)} min={1} name="durationMinutes" required type="number" />
        </F>
      </div>

      {/* 9 — materiales */}
      <div style={{ marginTop: 14 }}>
        <Lbl>Materiales</Lbl>
        <SelectorMultiple
          name="equipment"
          opciones={MATERIALES}
          inicial={video.equipment ?? []}
          excluyente={SIN_MATERIAL}
          requerido
          mensajeRequerido="Elegí los materiales, o marcá «Sin material»."
        />
      </div>

      {/* 10 y 11 — lo que no ve la alumna */}
      <BloqueSoloParaVos>
        <Lbl>Plan que la puede ver</Lbl>
        <SelectorDePlanes
          name="planesPermitidos"
          /* Una clase guardada antes de la migracion 20260921 puede no tener
             lista todavia; ahi se cae a la regla vieja, que es exactamente de
             donde el trigger la va a derivar igual. */
          inicial={
            video.planes_permitidos?.length
              ? video.planes_permitidos
              : planesDesde(video.membership_tier_required)
          }
        />

        <div className="adr-g2" style={{ marginTop: 14 }}>
          <F label="Estado">
            {/* Una clase archivada de antes conserva su estado hasta que
                alguien lo cambie a mano: por eso la opcion "Archivado" aparece
                solo para ella, y por eso arranca elegida.
                ⚠️ Antes arrancaba en "draft" aunque la opcion existiera: abrir
                una clase archivada y guardar cualquier otro cambio la pasaba a
                borrador sin que nadie lo pidiera. */}
            <Desplegable
              style={inp}
              defaultValue={video.status}
              name="status"
              opciones={[
                ...ESTADOS.map((e) => ({ value: e.slug, label: e.label })),
                ...(video.status === "archived" ? [{ value: "archived", label: "Archivado" }] : []),
              ]}
            />
          </F>

          {/* Los campos "Mux Playback ID" y "Mux Asset ID" salieron el 2026-08-03:
              Mux fue reemplazado por Bunny, y esos valores los escribe sola la ruta
              de finalizacion de subida. Editarlos a mano solo podia romper la
              reproduccion.

              OJO: stream_playback_id NO es basura -- Bunny lo escribe con la URL
              del HLS y el proxy de video lo usa como respaldo para las clases
              viejas. Lo que se saco es el CAMPO del formulario, no la columna. */}
          <div style={{ display: "flex", alignItems: "center", paddingTop: 24 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
              <input defaultChecked={video.is_featured} name="isFeatured" type="checkbox" style={{ width: 18, height: 18, accentColor: "var(--pink)" }} />
              <span style={{ fontSize: 14, fontWeight: 700, color: "#3B2A2C" }}>Destacar este video</span>
            </label>
          </div>
        </div>

        {/* 12 — a que planes de trabajo pertenece esta clase */}
        <ClaseEnPlanes videoId={video.id} planes={planes} ubicaciones={ubicaciones} />
      </BloqueSoloParaVos>

      <div style={{ marginTop: 14 }}>
        <F label="Dirección">
          {/* Solo lectura: cambiar el slug de una clase publicada rompe
              cualquier enlace que alguien haya guardado o compartido. Se muestra
              porque es la direccion de esa clase y a Brunela le sirve verla. */}
          <input style={{ ...inp, background: "#FFFAF6", color: "#8A6F68", borderStyle: "dashed" }} defaultValue={video.slug} name="slug" readOnly />
        </F>
      </div>

      <div className="adr-caja" style={{ marginTop: 14 }}>
        <Lbl>Pistas de audio por idioma</Lbl>
        <div style={{ fontSize: 13, color: "#8A6F68", lineHeight: 1.65 }}>
          {muxedLocales.length > 0 ? (
            <>
              Idiomas ya integrados en el video:{" "}
              <strong style={{ color: "#3B2A2C" }}>
                {["es", ...muxedLocales].join(", ").toUpperCase()}
              </strong>
            </>
          ) : (
            <>Solo espanol. Los idiomas extra se cargan al subir la clase, como un mp3 por idioma.</>
          )}
          <div style={{ marginTop: 6, fontSize: 12.5, color: "#B39189" }}>
            Esto no se edita a mano: el worker de muxeo lo escribe cuando verifica que el
            idioma quedo dentro del video.
          </div>
        </div>
      </div>


        {/* El ingles dejo de estar escondido aca: paso a estar al lado de su
            equivalente en espanol, como pidio el orden nuevo. Categorias y
            materiales tampoco estan mas: subieron a la parte principal del
            formulario, que es donde se los busca.

            La portada queda escondida porque no se toca nunca: la escribe sola
            la subida a Bunny. Sigue siendo editable por si hay que reemplazar
            una imagen a mano. */}
        {/* Portada a la vista y con subida de foto (pedido de la duena). Si se
            deja vacia, el sistema vuelve a usar el cuadro del video. */}
        <div style={{ marginTop: 18 }}>
          <SubirPortadaClase name="thumbnailUrl" defaultValue={video.thumbnail_url ?? ""} />
        </div>

      <div className="adr-acciones" style={{ marginTop: 22 }}>
        <BotonEnviar style={botonPrincipal}>
          <Check size={16} strokeWidth={2.4} aria-hidden="true" /> Guardar cambios
        </BotonEnviar>
        {/* formAction en el boton, NO un <form> adentro de otro <form>.
            Los formularios anidados son HTML invalido: el parser descarta el
            interno, asi que el boton quedaba como submit del formulario de
            arriba y ELIMINAR terminaba llamando a upsertVideoAction. O sea que
            no borraba: guardaba. El id ya viaja en el hidden del form externo,
            que es el que deleteVideoAction lee. */}
        {(
          <BotonEnviar pendingLabel="Borrando…" confirmar="¿Borrar esta clase? Se borra también el video. No se puede deshacer." formAction={deleteVideoAction} style={{ ...botonBorrar, marginLeft: "auto" }}>
            <Trash2 size={15} strokeWidth={2} aria-hidden="true" /> Eliminar
          </BotonEnviar>
        )}
      </div>
    </form>
  );
}

/** El boton de la fila y su panel. Uno por clase, pero solo uno abierto. */
export function EditarClase({
  video,
  planes = [],
  ubicaciones = [],
}: {
  video: VideoRecord;
  planes?: PlanParaElegir[];
  ubicaciones?: UbicacionEnPlan[];
}) {
  const [abierto, setAbierto] = useState(false);
  const [guardado, setGuardado] = useState(false);

  // El aviso se borra solo. Un cartel que se queda obliga a cerrarlo a mano
  // por algo que ya salio bien.
  useEffect(() => {
    if (!guardado) return;
    const t = window.setTimeout(() => setGuardado(false), 2600);
    return () => window.clearTimeout(t);
  }, [guardado]);

  return (
    <>
      <button type="button" onClick={() => setAbierto(true)} className="acl-editar">
        <Pencil size={14} strokeWidth={2} aria-hidden="true" /> Editar
      </button>

      {guardado && (
        <span role="status" className="acl-guardado">
          <Check size={13} strokeWidth={3} aria-hidden="true" /> Guardado
        </span>
      )}

      <AdminDrawer
        abierto={abierto}
        titulo={video.title_i18n?.es ?? video.slug}
        subtitulo={`/${video.slug}`}
        onCerrar={() => setAbierto(false)}
      >
        <VideoForm
          video={video}
          planes={planes}
          ubicaciones={ubicaciones}
          onGuardado={() => { setAbierto(false); setGuardado(true); }}
        />
      </AdminDrawer>
    </>
  );
}
