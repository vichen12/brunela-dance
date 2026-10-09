import { CATEGORIA_LABEL } from "@/src/features/studio/catalogo-clases";
import Link from "next/link";
import { requireUser } from "@/src/features/auth/guards";
import { getCurrentProfile } from "@/src/features/auth/profile";
import { Download, Eye, FileText, Image, MessageCircle, Music, FileType, Paperclip, PlayCircle, Upload, Video, type LucideIcon } from "lucide-react";
import { AdminBoton, AdminCabecera, AdminGuia } from "@/components/admin-ui";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";
import { firmarDescarga } from "@/src/lib/documents/storage";

export const dynamic = "force-dynamic";

type MembershipTier = "none" | "corps_de_ballet" | "solista" | "principal";

type Doc = {
  id: string;
  title: string;
  description: string | null;
  file_url: string;
  file_type: string;
  file_size_kb: number | null;
  membership_tier_required: MembershipTier;
  category_slug: string | null;
  video_slug: string | null;
};

// Iconos de lucide en vez de emojis: los emojis los dibuja cada sistema
// operativo distinto, no heredan el color de la marca y no se pueden alinear
// con el resto de la interfaz.
const FILE_ICONS: Record<string, LucideIcon> = {
  pdf: FileText, image: Image, video: Video, audio: Music, doc: FileType, other: Paperclip,
};

const TIER_LABELS: Record<string, string> = {
  none: "Todas", corps_de_ballet: "Corps", solista: "Solista", principal: "Principal",
};

/** Mismo orden que `membership_tier_rank()` en la base. Un plan incluye a los de abajo. */
const ORDEN_TIER: Record<MembershipTier, number> = {
  none: 0, corps_de_ballet: 1, solista: 2, principal: 3,
};

export default async function DocumentsPage({ searchParams }: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { user } = await requireUser();
  const supabase = await createSupabaseServerClient();
  const perfil = await getCurrentProfile(user.id);
  const tier = (perfil?.membership_tier ?? "none") as MembershipTier;
  const params = (await searchParams) ?? {};
  const activeCategory = typeof params.cat === "string" ? params.cat : "all";

  const { data: docs } = await supabase
    .from("documents")
    .select("id, title, description, file_url, file_type, file_size_kb, membership_tier_required, category_slug, video_slug")
    .eq("is_published", true)
    .order("sort_order")
    .order("created_at", { ascending: false });

  // 🔴 ESTE FILTRO NO ES LA SEGURIDAD, PERO HOY ES LO QUE FRENA LA DESCARGA.
  //
  //    Hasta el 2026-08-06 aca decia que RLS ya habia filtrado por plan. NO LO
  //    HACIA: `documents_select_published` solo miraba `is_published`, asi que
  //    esta consulta devolvia TODOS los documentos publicados -- incluidos los
  //    de principal -- a cualquiera con cuenta.
  //
  //    Y firmar es entregar el acceso: la firma se hace con service_role, que
  //    saltea el bucket privado. O sea que una alumna gratuita recibia un enlace
  //    de descarga funcionando para contenido pago. Se encontro ATACANDO la base
  //    con su sesion, no leyendo -- este mismo comentario afirmaba lo contrario
  //    y nadie lo noto en varias revisiones.
  //
  //    Lo arregla de verdad 20260806_documentos_y_progreso_por_plan.sql, que
  //    pone el plan en la policy. Este filtro se queda igual, como segunda
  //    barrera: es lo unico que hay hasta que esa migracion corra, y despues
  //    sigue valiendo porque lo caro no es leer el titulo, es FIRMAR.
  const alcanza = (requerido: string) => {
    // Un valor que no este en la escala se trata como INALCANZABLE, no como
    // "none". La columna es texto libre: si alguna vez entra un typo, tiene que
    // ocultar el documento, no abrirlo.
    const pedido = ORDEN_TIER[requerido as MembershipTier];
    if (pedido === undefined) return false;
    return ORDEN_TIER[tier] >= pedido;
  };

  const accesibles = ((docs ?? []) as Doc[]).filter((d) => alcanza(d.membership_tier_required));

  // Las filas viejas guardaban una URL completa; firmarDescarga() las devuelve
  // tal cual, para que las dos formas convivan.
  const allDocs = await Promise.all(
    accesibles.map(async (d) => ({
      ...d,
      file_url: await firmarDescarga(d.file_url),
    }))
  );

  const categories = Array.from(new Set(allDocs.map((d) => d.category_slug).filter(Boolean))) as string[];

  const visible = activeCategory === "all"
    ? allDocs
    : allDocs.filter((d) => d.category_slug === activeCategory);

  // La clase a la que va atado cada documento, por su titulo. Con el cliente de
  // la alumna: si RLS no le deja ver la clase, el documento no la nombra.
  const slugsDeClase = Array.from(new Set(allDocs.map((d) => d.video_slug).filter(Boolean))) as string[];
  const { data: clasesData } = slugsDeClase.length
    ? await supabase.from("videos").select("slug, title_i18n").in("slug", slugsDeClase)
    : { data: [] as { slug: string; title_i18n: Record<string, string> | null }[] };
  const claseDe = new Map(((clasesData ?? []) as { slug: string; title_i18n: Record<string, string> | null }[])
    .map((c) => [c.slug, c.title_i18n?.es ?? c.slug]));

  const peso = (kb: number | null) => (!kb ? null : kb >= 1000 ? `${(kb / 1000).toFixed(1)} MB` : `${kb} KB`);
  const TIPO: Record<string, string> = { pdf: "PDF", image: "Imagen", video: "Video", audio: "Audio", doc: "Word", other: "Archivo" };

  return (
    <main className="sd">
      <style>{CSS}</style>
      <section className="sd-shell">
        <AdminCabecera
          eyebrow="Recursos del estudio"
          titulo="Documentos"
          lede="Guías, PDFs y material de apoyo que Brunela comparte con tu plan, listos para leer o descargar."
        />

        {allDocs.length === 0 ? (
          <AdminGuia
            rotuloEjemplo="Así se ven"
            ejemplo={
              <div className="ad-guia-flota sd-ejemplo">
                {[
                  { Icono: FileText, titulo: "Guía de alineación postural", meta: "PDF · 2,4 MB" },
                  { Icono: Image, titulo: "Mapa de estiramientos", meta: "Imagen · 860 KB" },
                  { Icono: Music, titulo: "Respiración guiada", meta: "Audio · 6,1 MB" },
                ].map((d, i) => (
                  <div key={d.titulo} className="sd-ejemplo-fila" style={{ animationDelay: `${0.3 + i * 0.18}s` }}>
                    <span className="sd-ico"><d.Icono size={18} strokeWidth={1.8} /></span>
                    <span className="sd-ejemplo-txt"><strong>{d.titulo}</strong><small>{d.meta}</small></span>
                    <span className="sd-ejemplo-bajar"><Download size={15} strokeWidth={2} /></span>
                  </div>
                ))}
              </div>
            }
            eyebrow="Todavía no hay material para tu plan"
            titulo="Va a aparecer acá."
            pasos={[
              { icono: <Upload size={18} strokeWidth={2} />, titulo: "Brunela sube el material", texto: "Guías, hojas de ejercicios, audios de respiración." },
              { icono: <Eye size={18} strokeWidth={2} />, titulo: "Lo ves según tu plan", texto: "Algunos son para todas; otros, para planes más avanzados." },
              { icono: <Download size={18} strokeWidth={2} />, titulo: "Lo abrís o lo descargás", texto: "Desde el celular o la computadora, cuando quieras." },
            ]}
            cta={
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {/* No existe un sistema de avisos: estas dos salidas si funcionan hoy. */}
                <AdminBoton href="/dashboard/chat" lleno><MessageCircle size={16} strokeWidth={2} aria-hidden="true" /> Pedirle material a Brunela</AdminBoton>
                <AdminBoton href="/dashboard/plan">Ver mi plan</AdminBoton>
              </div>
            }
          />
        ) : (
          <>
            {categories.length > 0 && (
              <nav className="sd-filtros" aria-label="Categorías">
                {[{ key: "all", label: "Todos" }, ...categories.map((c) => ({ key: c, label: CATEGORIA_LABEL[c] ?? c }))].map((f) => (
                  <Link
                    key={f.key}
                    href={(f.key === "all" ? "/dashboard/documents" : `/dashboard/documents?cat=${f.key}`) as never}
                    className={"sd-filtro" + (activeCategory === f.key ? " es-activo" : "")}
                    aria-current={activeCategory === f.key ? "page" : undefined}
                  >{f.label}</Link>
                ))}
              </nav>
            )}

            <p className="sd-cuenta"><strong>{visible.length}</strong> {visible.length === 1 ? "documento" : "documentos"}</p>

            <ul className="sd-grilla">
              {visible.map((doc) => {
                const Icono = FILE_ICONS[doc.file_type] ?? Paperclip;
                const clase = doc.video_slug ? claseDe.get(doc.video_slug) : null;
                return (
                  <li key={doc.id} className="sd-card" data-tipo={doc.file_type}>
                    <a href={doc.file_url} target="_blank" rel="noreferrer" className="sd-abrir" aria-label={`Abrir ${doc.title}`}>
                      <span className="sd-ico sd-ico--grande"><Icono size={26} strokeWidth={1.6} aria-hidden="true" /></span>
                      <span className="sd-info">
                        <span className="sd-meta">
                          {TIPO[doc.file_type] ?? doc.file_type}{peso(doc.file_size_kb) ? ` · ${peso(doc.file_size_kb)}` : ""}
                          {doc.membership_tier_required !== "none" && <span className="sd-plan">{TIER_LABELS[doc.membership_tier_required]}</span>}
                        </span>
                        <span className="sd-titulo">{doc.title}</span>
                        {doc.description && <span className="sd-desc">{doc.description}</span>}
                      </span>
                      <span className="sd-bajar" aria-hidden="true"><Download size={17} strokeWidth={2} /></span>
                    </a>
                    {(clase || doc.category_slug) && (
                      <div className="sd-atado">
                        {clase && (
                          <Link href={`/dashboard/library/${doc.video_slug}` as never} className="sd-clase">
                            <PlayCircle size={14} strokeWidth={2} aria-hidden="true" /> {clase}
                          </Link>
                        )}
                        {doc.category_slug && <span className="sd-cat">{CATEGORIA_LABEL[doc.category_slug] ?? doc.category_slug}</span>}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </section>
    </main>
  );
}

const CSS = `
.sd { padding-bottom: 80px; }
.sd-shell { max-width: 1320px; margin: 0 auto; padding: clamp(20px, 3vw, 40px) clamp(16px, 3.4vw, 48px) 0; display: flex; flex-direction: column; gap: 18px; }
.sd .ad-mast { padding-bottom: 4px; }

/* Filtros: pildoras suaves; la activa en coral. */
.sd-filtros { display: flex; gap: 8px; flex-wrap: wrap; }
.sd-filtro {
  display: inline-flex; align-items: center; height: 40px; padding: 0 17px; border-radius: 99px; text-decoration: none;
  font-size: 14px; font-weight: 800; color: var(--ink); background: #fff; border: 1.5px solid var(--linea);
  transition: border-color .2s, color .2s, background .2s, transform .3s var(--curva);
}
.sd-filtro:hover { border-color: var(--pink-line); background: var(--rubor); color: var(--pink-deep); transform: translateY(-1px); }
.sd-filtro.es-activo { background: var(--pink); border-color: var(--pink); color: #fff; box-shadow: 0 10px 20px -12px rgba(230,79,85,.85); }
.sd-cuenta { font-size: 13.5px; font-weight: 600; color: var(--muted); }
.sd-cuenta strong { color: var(--ink); font-weight: 900; }

.sd-grilla { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(min(340px, 100%), 1fr)); gap: 16px; }
@keyframes sd-entra { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
.sd-card {
  display: flex; flex-direction: column; border: 1px solid var(--linea); border-radius: 26px; background: #fff; overflow: hidden;
  box-shadow: var(--sombra); animation: sd-entra .6s var(--curva) backwards;
  transition: transform .35s var(--curva), box-shadow .35s, border-color .25s;
}
.sd-card:nth-child(2) { animation-delay: .05s; }
.sd-card:nth-child(3) { animation-delay: .1s; }
.sd-card:nth-child(n+4) { animation-delay: .15s; }
.sd-card:hover { transform: translateY(-3px); border-color: var(--linea-fuerte); box-shadow: var(--sombra-alta); }
.sd-abrir { display: flex; align-items: center; gap: 14px; padding: 16px; text-decoration: none; color: inherit; flex: 1; }

/* Icono del archivo en una burbuja pastel; el tono sigue al tipo. */
.sd-ico { width: 42px; height: 42px; border-radius: 14px; flex-shrink: 0; display: grid; place-items: center; background: var(--rubor); color: var(--pink-deep); }
.sd-ico--grande { width: 58px; height: 58px; border-radius: 20px; transition: transform .45s var(--curva); }
.sd-card:hover .sd-ico--grande { transform: rotate(-6deg) scale(1.05); }
.sd-card[data-tipo="image"] .sd-ico { background: #FFF4E8; color: var(--melocoton-deep); }
.sd-card[data-tipo="audio"] .sd-ico { background: #FFF0EA; color: #B4533A; }
.sd-card[data-tipo="video"] .sd-ico { background: #FFF4E8; color: var(--salvia-deep); }
.sd-card[data-tipo="doc"] .sd-ico, .sd-card[data-tipo="other"] .sd-ico { background: var(--crema); color: var(--muted); }

.sd-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
.sd-meta { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-size: 12.5px; font-weight: 700; color: var(--muted); }
.sd-plan { padding: 2px 9px; border-radius: 99px; background: var(--rubor); color: var(--pink-deep); font-weight: 800; }
.sd-titulo { font-weight: 900; font-size: 17px; line-height: 1.25; letter-spacing: -0.015em; color: var(--ink); transition: color .2s; }
.sd-card:hover .sd-titulo { color: var(--pink-deep); }
.sd-desc { font-size: 13.5px; line-height: 1.55; color: var(--muted); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.sd-bajar {
  width: 44px; height: 44px; border-radius: 50%; flex-shrink: 0; display: grid; place-items: center;
  background: var(--pink); color: #fff; box-shadow: 0 12px 22px -12px rgba(230,79,85,.85); transition: transform .35s var(--curva), background .2s;
}
.sd-card:hover .sd-bajar { transform: translateY(2px) scale(1.06); background: var(--pink-mid); }
.sd-atado { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin: 0 12px 12px; padding: 10px 12px; border-radius: 18px; background: var(--crema); }
.sd-clase { display: inline-flex; align-items: center; gap: 6px; padding: 4px 11px 4px 8px; border-radius: 99px; background: #fff; font-size: 12.5px; font-weight: 800; color: var(--pink-deep); text-decoration: none; border: 1px solid var(--linea); transition: border-color .2s, background .2s; }
.sd-clase:hover { border-color: var(--pink-line); background: var(--rubor); }
.sd-cat { padding: 4px 11px; border-radius: 99px; font-size: 12.5px; font-weight: 800; color: var(--melocoton-deep); background: #FFF4E8; }

/* Ejemplo de la guia vacia */
.sd-ejemplo { padding: 8px; }
.sd-ejemplo-fila { display: flex; align-items: center; gap: 12px; padding: 12px; border-radius: 18px; animation: ad-entra .6s var(--curva) both; }
.sd-ejemplo-fila + .sd-ejemplo-fila { margin-top: 4px; }
.sd-ejemplo-fila:nth-child(1) { background: #FFF6F2; }
.sd-ejemplo-fila:nth-child(2) .sd-ico { background: #FFF4E8; color: var(--melocoton-deep); }
.sd-ejemplo-fila:nth-child(3) .sd-ico { background: #FFF0EA; color: #B4533A; }
.sd-ejemplo-txt { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.sd-ejemplo-txt strong { font-size: 14px; font-weight: 800; color: var(--ink); }
.sd-ejemplo-txt small { font-size: 12px; font-weight: 600; color: var(--muted); }
.sd-ejemplo-bajar { width: 34px; height: 34px; border-radius: 50%; display: grid; place-items: center; background: var(--pink); color: #fff; }
@media (max-width: 640px) {
  .sd-filtros { flex-wrap: nowrap; overflow-x: auto; margin: 0 -16px; padding: 2px 16px 6px; scrollbar-width: none; }
  .sd-filtros::-webkit-scrollbar { display: none; }
  .sd-filtro { flex-shrink: 0; }
}
@media (prefers-reduced-motion: reduce) { .sd-ejemplo-fila, .sd-card { animation: none; } }
`;
