import { BotonEnviar } from "@/components/boton-enviar";
import { Desplegable } from "@/components/desplegable";
import { requireAdmin } from "@/src/features/auth/guards";
import {
  ChevronDown, Download, Eye, FileText, FileType, Image, Link2, Music, Paperclip, Pencil, Plus, Tag, Trash2, Upload, Users, Video,
  type LucideIcon,
} from "lucide-react";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";
import { upsertDocumentAction, deleteDocumentAction } from "@/src/features/admin/document-actions";
import { AdminDocumentUpload } from "@/components/admin-document-upload";
import { AdminAviso, AdminBoton, AdminCabecera, AdminCifras, AdminNueva, AdminGuia } from "@/components/admin-ui";
import { CATEGORIAS, CATEGORIA_LABEL } from "@/src/features/studio/catalogo-clases";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

type Doc = {
  id: string;
  title: string;
  description: string | null;
  file_url: string;
  file_type: string;
  file_size_kb: number | null;
  membership_tier_required: string;
  category_slug: string | null;
  video_slug: string | null;
  is_published: boolean;
  sort_order: number;
};

type ClaseCorta = { slug: string; title_i18n: Record<string, string> | null };

// Iconos de lucide en vez de emojis: los emojis los dibuja cada sistema
// operativo distinto, no heredan el color de la marca y no se pueden alinear
// con el resto de la interfaz.
const FILE_ICONS: Record<string, LucideIcon> = {
  pdf: FileText, image: Image, video: Video, audio: Music, doc: FileType, other: Paperclip,
};
const TIPO_LABEL: Record<string, string> = {
  pdf: "PDF", image: "Imagen", video: "Video", audio: "Audio", doc: "Word", other: "Archivo",
};

const PLANES = [
  { value: "none", label: "Todas las alumnas" },
  { value: "corps_de_ballet", label: "Desde Corps de Ballet" },
  { value: "solista", label: "Desde Solista" },
  { value: "principal", label: "Solo Principal" },
];
const PLAN_CORTO: Record<string, string> = {
  none: "Todas", corps_de_ballet: "Corps", solista: "Solista", principal: "Principal",
};

function peso(kb: number | null) {
  if (!kb) return null;
  return kb >= 1000 ? `${(kb / 1000).toFixed(1)} MB` : `${kb} KB`;
}

/**
 * Los campos de un documento, iguales para crear y para editar.
 *
 * ⚠️ Antes, editar un documento solo dejaba cambiar titulo, archivo, plan y
 *    estado: descripcion, categoria, clase y orden viajaban en <input hidden>
 *    con el valor viejo, o sea que quedaban fijos para siempre.
 *
 * Categoria y clase son LISTAS y no texto libre: la pantalla de la alumna
 * agrupa por el slug exacto, y "ballet " con un espacio era otra categoria.
 */
function Campos({ doc, clases }: { doc?: Doc; clases: ClaseCorta[] }) {
  const opcionesClase = [
    { value: "", label: "Ninguna" },
    ...clases.map((c) => ({ value: c.slug, label: c.title_i18n?.es ?? c.slug })),
  ];
  // Un documento viejo puede apuntar a un slug que ya no esta en la lista: se
  // conserva como opcion para no perderlo al guardar otra cosa.
  if (doc?.video_slug && !clases.some((c) => c.slug === doc.video_slug)) {
    opcionesClase.push({ value: doc.video_slug, label: `${doc.video_slug} (ya no existe)` });
  }
  const opcionesCategoria = [
    { value: "", label: "Ninguna" },
    ...CATEGORIAS.map((c) => ({ value: c.slug, label: c.label })),
  ];
  if (doc?.category_slug && !CATEGORIAS.some((c) => c.slug === doc.category_slug)) {
    opcionesCategoria.push({ value: doc.category_slug, label: `${doc.category_slug} (vieja)` });
  }

  return (
    <div className="doc-form">
      <label className="doc-campo doc-campo--ancho">
        <span className="doc-etq">Título</span>
        <input name="title" defaultValue={doc?.title ?? ""} required placeholder="Guía de alineación postural" />
      </label>
      <label className="doc-campo doc-campo--ancho">
        <span className="doc-etq">Descripción <small>opcional</small></span>
        <textarea name="description" rows={2} defaultValue={doc?.description ?? ""} placeholder="Para qué sirve, en una línea…" />
      </label>
      <div className="doc-campo doc-campo--ancho">
        <span className="doc-etq">Archivo</span>
        {/* El tipo y el peso los deduce el componente del archivo real. */}
        <AdminDocumentUpload valorInicial={doc?.file_url} />
      </div>
      <label className="doc-campo">
        <span className="doc-etq">Quién lo ve</span>
        <Desplegable name="membershipTierRequired" defaultValue={doc?.membership_tier_required ?? "none"} opciones={PLANES} />
      </label>
      <label className="doc-campo">
        <span className="doc-etq">Orden <small>el más bajo va primero</small></span>
        <input name="sortOrder" type="number" min={0} defaultValue={doc?.sort_order ?? 0} />
      </label>
      <label className="doc-campo">
        <span className="doc-etq">Categoría <small>opcional</small></span>
        <Desplegable name="categorySlug" defaultValue={doc?.category_slug ?? ""} opciones={opcionesCategoria} />
      </label>
      <label className="doc-campo">
        <span className="doc-etq">Clase relacionada <small>opcional</small></span>
        <Desplegable name="videoSlug" defaultValue={doc?.video_slug ?? ""} opciones={opcionesClase} />
      </label>
      <label className="doc-publicado doc-campo--ancho">
        <input name="isPublished" type="checkbox" defaultChecked={doc?.is_published ?? false} />
        <span>Publicado <small>si no lo tildás, queda guardado pero las alumnas no lo ven</small></span>
      </label>
    </div>
  );
}

export default async function AdminDocumentsPage({ searchParams }: { searchParams?: SearchParams }) {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();
  const params = (await searchParams) ?? {};
  const success = typeof params.success === "string" ? params.success : null;
  const error = typeof params.error === "string" ? params.error : null;
  const abrirNueva = params.nueva === "1";

  const [{ data }, { data: clasesData }] = await Promise.all([
    supabase
      .from("documents")
      .select("id, title, description, file_url, file_type, file_size_kb, membership_tier_required, category_slug, video_slug, is_published, sort_order")
      .order("sort_order")
      .order("created_at", { ascending: false }),
    supabase.from("videos").select("slug, title_i18n").order("title_i18n->>es"),
  ]);

  const docs = (data ?? []) as Doc[];
  const clases = (clasesData ?? []) as ClaseCorta[];
  const tituloClase = new Map(clases.map((c) => [c.slug, c.title_i18n?.es ?? c.slug]));
  const publicados = docs.filter((d) => d.is_published).length;
  const pesoTotal = docs.reduce((a, d) => a + (d.file_size_kb ?? 0), 0);

  return (
    <main className="doc">
      <style>{CSS}</style>

      <AdminCabecera
        eyebrow="Gestión de contenido"
        titulo="Documentos"
        lede="Guías, PDFs y material de apoyo. Cada documento lo ven las alumnas del plan que elijas, y puede ir atado a una clase o a una categoría."
        acciones={<>
          <AdminBoton href="/admin/documents?nueva=1#nueva" lleno><Plus size={16} strokeWidth={2.2} aria-hidden="true" /> Subir documento</AdminBoton>
          <AdminBoton href="/dashboard/documents"><Eye size={15} strokeWidth={2} aria-hidden="true" /> Ver como alumna</AdminBoton>
        </>}
      />

      <AdminAviso mensaje={success} tono="ok" />
      <AdminAviso mensaje={error} tono="error" />

      {docs.length === 0 ? (
        <>
          {/* Sin documentos, las cifras en cero no dicen nada: en su lugar,
              como los ve la alumna y los tres pasos para subir el primero. */}
          <AdminGuia
            rotuloEjemplo="Así los ve la alumna"
            ejemplo={
              <div className="ad-guia-flota doc-ejemplo">
                {[
                  { Icono: FileText, titulo: "Guía de alineación postural", meta: "PDF · 2,4 MB", plan: "Todas" },
                  { Icono: Image, titulo: "Mapa de estiramientos", meta: "Imagen · 860 KB", plan: "Solista" },
                  { Icono: Music, titulo: "Respiración guiada", meta: "Audio · 6,1 MB", plan: "Principal" },
                ].map((d, i) => (
                  <div key={d.titulo} className="doc-ejemplo-fila" style={{ animationDelay: `${0.3 + i * 0.18}s` }}>
                    <span className="doc-ejemplo-ico"><d.Icono size={18} strokeWidth={1.8} /></span>
                    <span className="doc-ejemplo-txt">
                      <span className="doc-ejemplo-titulo">{d.titulo}</span>
                      <span className="doc-ejemplo-meta">{d.meta} · {d.plan}</span>
                    </span>
                    <span className="doc-ejemplo-bajar"><Download size={15} strokeWidth={2} /></span>
                  </div>
                ))}
              </div>
            }
            eyebrow="Tu primer documento"
            titulo="Subilo en tres pasos."
            pasos={[
              { icono: <Upload size={18} strokeWidth={2} />, titulo: "Subí el archivo", texto: "PDF, imagen, audio, video o Word, hasta 50 MB. El tipo y el peso se completan solos." },
              { icono: <Users size={18} strokeWidth={2} />, titulo: "Elegí quién lo ve", texto: "Todas las alumnas o desde un plan. Si querés, atalo a una clase o a una categoría." },
              { icono: <Eye size={18} strokeWidth={2} />, titulo: "Publicalo", texto: "Aparece en «Documentos» de las alumnas que lo pueden ver, listo para leer o descargar." },
            ]}
            cta={<AdminBoton href="/admin/documents?nueva=1#nueva" lleno><Plus size={16} strokeWidth={2.2} aria-hidden="true" /> Subir el primero</AdminBoton>}
          />
      <AdminNueva abierto={abrirNueva} titulo="Subir un documento" sub="Archivo, quién lo ve y, si querés, a qué clase o categoría va atado">
        <form action={upsertDocumentAction}>
          <input name="id" type="hidden" value="" />
          <Campos clases={clases} />
          <div className="doc-pie">
            <BotonEnviar className="ad-btn ad-btn--lleno" pendingLabel="Guardando…">Guardar documento</BotonEnviar>
          </div>
        </form>
      </AdminNueva>

        </>
      ) : (
        <>
      <AdminCifras items={[
        { label: "Documentos", value: docs.length, sub: "en total" },
        { label: "Publicados", value: publicados, sub: "visibles para las alumnas" },
        { label: "Borradores", value: docs.length - publicados, sub: "guardados sin publicar" },
        { label: "Espacio", value: peso(pesoTotal) ?? "0 KB", sub: "ocupado por los archivos" },
      ]} />

      <AdminNueva abierto={abrirNueva} titulo="Subir un documento" sub="Archivo, quién lo ve y, si querés, a qué clase o categoría va atado">
        <form action={upsertDocumentAction}>
          <input name="id" type="hidden" value="" />
          <Campos clases={clases} />
          <div className="doc-pie">
            <BotonEnviar className="ad-btn ad-btn--lleno" pendingLabel="Guardando…">Guardar documento</BotonEnviar>
          </div>
        </form>
      </AdminNueva>

        <ul className="doc-lista">
          {docs.map((doc) => {
            const Icono = FILE_ICONS[doc.file_type] ?? Paperclip;
            return (
              <li key={doc.id} className={"doc-card" + (doc.is_published ? "" : " es-borrador")}>
                <div className="doc-fila">
                  <span className="doc-ico" aria-hidden="true"><Icono size={22} strokeWidth={1.8} /></span>
                  <div className="doc-info">
                    <div className="doc-linea">
                      <span className={"doc-estado" + (doc.is_published ? " es-pub" : "")}>
                        <span className="doc-punto" aria-hidden="true" />{doc.is_published ? "Publicado" : "Borrador"}
                      </span>
                      <span className="doc-tipo">{TIPO_LABEL[doc.file_type] ?? doc.file_type}{peso(doc.file_size_kb) ? ` · ${peso(doc.file_size_kb)}` : ""}</span>
                    </div>
                    <h2 className="doc-titulo">{doc.title}</h2>
                    {doc.description && <p className="doc-desc">{doc.description}</p>}
                    <ul className="doc-datos">
                      <li><Users size={14} strokeWidth={2} aria-hidden="true" /> {PLAN_CORTO[doc.membership_tier_required] ?? doc.membership_tier_required}</li>
                      {doc.category_slug && <li><Tag size={14} strokeWidth={2} aria-hidden="true" /> {CATEGORIA_LABEL[doc.category_slug] ?? doc.category_slug}</li>}
                      {doc.video_slug && <li><Link2 size={14} strokeWidth={2} aria-hidden="true" /> {tituloClase.get(doc.video_slug) ?? doc.video_slug}</li>}
                    </ul>
                  </div>
                </div>

                <details className="doc-editar">
                  <summary>
                    <Pencil size={14} strokeWidth={2} aria-hidden="true" /> Editar
                    <ChevronDown size={15} strokeWidth={2} className="ad-flecha" aria-hidden="true" />
                  </summary>
                  <form action={upsertDocumentAction}>
                    <input name="id" type="hidden" value={doc.id} />
                    <Campos doc={doc} clases={clases} />
                    <div className="doc-pie">
                      <BotonEnviar className="ad-btn ad-btn--lleno" pendingLabel="Guardando…">Guardar cambios</BotonEnviar>
                      <BotonEnviar
                        className="ad-btn doc-borrar"
                        pendingLabel="Borrando…"
                        formAction={deleteDocumentAction}
                        confirmar={`¿Borrar «${doc.title}»? Se borra también el archivo. No se puede deshacer.`}
                      >
                        <Trash2 size={14} strokeWidth={2} aria-hidden="true" /> Borrar
                      </BotonEnviar>
                    </div>
                  </form>
                </details>
              </li>
            );
          })}
        </ul>
        </>
      )}
    </main>
  );
}

const CSS = `
.doc { display: flex; flex-direction: column; }
.doc-form { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px 18px; padding-top: 18px; }
.doc-campo { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.doc-campo--ancho { grid-column: 1 / -1; }
.doc-etq { font-size: 10.5px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: #78716c; }
.doc-etq small { margin-left: 6px; font-size: 11px; font-weight: 500; letter-spacing: 0; text-transform: none; color: #a8a29e; }
.doc-campo input, .doc-campo textarea { border-radius: 12px; border: 1.5px solid #e7e5e4; padding: 0.75rem 0.95rem; font-size: 14px; }
.doc-campo input:focus, .doc-campo textarea:focus { border-color: var(--pink); }
.doc-campo .dsp-boton { border-color: #e7e5e4; }
.doc-publicado { display: flex; align-items: flex-start; gap: 10px; font-size: 14px; font-weight: 600; color: var(--ink); cursor: pointer; }
.doc-publicado input { width: 17px; height: 17px; margin-top: 2px; accent-color: var(--pink); padding: 0; }
.doc-publicado small { display: block; font-size: 12px; font-weight: 400; color: #a8a29e; }
.doc-pie { display: flex; gap: 10px; align-items: center; padding-top: 18px; }
.doc-borrar { margin-left: auto; color: var(--pink-deep); border-color: var(--pink-line); }
.doc-borrar:hover { background: var(--pink-wash); border-color: var(--pink); }

.doc-lista { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 12px; }
.doc-card {
  border: 1px solid #e7e5e4; border-radius: 20px; background: #fff;
  transition: transform .35s cubic-bezier(.16,1,.3,1), box-shadow .35s, border-color .25s;
}
.doc-card:hover { transform: translateY(-2px); border-color: var(--pink-line); box-shadow: 0 20px 36px -24px rgba(176,58,62,0.45); }
.doc-fila { display: flex; gap: 16px; align-items: flex-start; padding: 18px 20px 14px; }
.doc-ico {
  width: 52px; height: 52px; border-radius: 14px; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center;
  background: var(--pink-wash); color: var(--pink-deep);
}
.doc-card.es-borrador .doc-ico { background: #f5f5f4; color: #a8a29e; }
.doc-info { flex: 1; min-width: 0; }
.doc-linea { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 4px; }
.doc-estado { display: inline-flex; align-items: center; gap: 7px; font-size: 11px; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; color: var(--pink-deep); }
.doc-estado.es-pub { color: #15803d; }
.doc-punto { width: 8px; height: 8px; border-radius: 50%; background: currentColor; }
.doc-tipo { font-size: 12px; color: #a8a29e; }
.doc-titulo { font-family: var(--font-display), sans-serif; font-weight: 800; font-size: 19px; letter-spacing: -0.025em; color: var(--ink); }
.doc-desc { margin-top: 4px; font-size: 13.5px; line-height: 1.55; color: #57534e; }
.doc-datos { list-style: none; margin: 10px 0 0; padding: 0; display: flex; flex-wrap: wrap; gap: 6px 16px; }
.doc-datos li { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; color: #57534e; }
.doc-datos svg { color: #a8a29e; }
.doc-editar { border-top: 1px solid #f0eeec; margin: 0 20px; }
.doc-editar > summary {
  list-style: none; cursor: pointer; display: flex; align-items: center; gap: 7px; padding: 12px 0 14px;
  font-size: 13px; font-weight: 700; color: var(--ink); user-select: none;
}
.doc-editar > summary::-webkit-details-marker { display: none; }
.doc-editar > summary .ad-flecha { margin-left: auto; }
.doc-editar[open] { padding-bottom: 18px; }
.doc-editar[open] .doc-form { padding-top: 4px; }

.doc-ejemplo { padding: 8px; transform: rotate(-1.5deg); }
.doc-ejemplo-fila {
  display: flex; align-items: center; gap: 12px; padding: 12px; border-radius: 14px;
  animation: ad-entra .6s cubic-bezier(.16,1,.3,1) both;
}
.doc-ejemplo-fila + .doc-ejemplo-fila { border-top: 1px solid #f5f5f4; border-radius: 0 0 14px 14px; }
.doc-ejemplo-ico {
  width: 42px; height: 42px; border-radius: 12px; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center;
  background: var(--pink-wash); color: var(--pink-deep);
}
.doc-ejemplo-txt { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.doc-ejemplo-titulo { font-weight: 700; font-size: 14px; color: var(--ink); }
.doc-ejemplo-meta { font-size: 12px; color: #a8a29e; }
.doc-ejemplo-bajar {
  width: 34px; height: 34px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center;
  background: var(--pink); color: #fff;
}
@media (prefers-reduced-motion: reduce) { .doc-ejemplo-fila { animation: none; } }

@media (max-width: 640px) {
  .doc-form { grid-template-columns: minmax(0, 1fr); }
}
`;
