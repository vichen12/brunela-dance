import Link from "next/link";
import { CATEGORIAS } from "@/src/features/studio/catalogo-clases";
import { BuscadorDeClases } from "@/components/buscador-de-clases";
import type { ClaseParaBuscar } from "@/src/features/admin/buscar-clases";
import { portadaDeClase, portadaDePlan } from "@/src/lib/video/portada";
import { CalendarDays, Check, Eye, Pencil, Plus, Rocket, Star, Heart } from "lucide-react";
import { AdminAviso, AdminBoton, AdminCabecera, AdminCifras, AdminVacio, AdminGuia } from "@/components/admin-ui";
import { AdminBuscador } from "@/components/admin-buscador";
import { Paginacion, hrefConPagina } from "@/components/paginacion";
import { requireAdmin } from "@/src/features/auth/guards";
import { esFaltaDeColumnaDescanso } from "@/src/features/studio/dias-de-plan";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Planes por pagina del listado. */
const POR_PAGINA = 10;

const ESTADOS_PROG = [
  { key: "", label: "Cualquier estado" },
  { key: "published", label: "Publicados" },
  { key: "draft", label: "Borradores" },
  { key: "archived", label: "Archivados" },
];

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

type ProgramRecord = {
  id: string;
  slug: string;
  title_i18n: Record<string, string>;
  description_i18n: Record<string, string>;
  membership_tier_required: "solista" | "principal";
  status: "draft" | "published" | "archived";
  duration_days: number;
  cover_image_url: string | null;
  is_featured: boolean;
};

type ProgramDayRecord = {
  id: string;
  program_id: string;
  day_number: number;
  /** null en un descanso. */
  video_id: string | null;
  es_descanso?: boolean;
  nota?: string | null;
};
type VideoLookup = { id: string; slug: string; title_i18n: Record<string, string> | null };

// ── Estilos compartidos con el resto del panel ────────────────────────────────
//
// Esta pantalla era la unica que seguia con el lenguaje visual viejo: cabecera
// `panel rounded-[36px]`, tarjetas `bg-white/76` y clases de Tailwind sueltas,
// mientras las otras nueve usaban hero-stage y tarjetas blancas con borde
// #F6E7E1. Al entrar acá se notaba que era otro producto.

const STATUS_STYLE: Record<string, { clase: string; label: string }> = {
  published: { clase: "apl-estado--pub",  label: "Publicado" },
  draft:     { clase: "apl-estado--borr", label: "Borrador" },
  archived:  { clase: "apl-estado--arch", label: "Archivado" },
};

const TIER_STYLE: Record<string, { label: string }> = {
  solista:   { label: "Solista" },
  principal: { label: "Principal" },
};

const tituloDe = (v: VideoLookup | undefined, fallback: string) =>
  v ? (v.title_i18n?.es ?? v.title_i18n?.en ?? v.slug) : fallback;

// ── Días ─────────────────────────────────────────────────────────────────────

/**
 * Los dias de todos los planes. Pide las columnas del descanso; si la migracion
 * 20261025_dia_de_descanso.sql no corrio, el select da 42703 y se repite sin
 * ellas: la pantalla sigue andando y el panel avisa que falta la migracion.
 */
async function cargarDias(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>) {
  const nuevo = await supabase
    .from("program_days")
    .select("id, program_id, day_number, video_id, es_descanso, nota")
    .order("day_number", { ascending: true });
  if (!nuevo.error) return { dias: (nuevo.data ?? []) as ProgramDayRecord[], faltaMigracion: false };
  if (!esFaltaDeColumnaDescanso(nuevo.error)) {
    console.error("[admin/programs] program_days:", nuevo.error.message);
    return { dias: [] as ProgramDayRecord[], faltaMigracion: false };
  }
  const viejo = await supabase
    .from("program_days")
    .select("id, program_id, day_number, video_id")
    .order("day_number", { ascending: true });
  return { dias: (viejo.data ?? []) as ProgramDayRecord[], faltaMigracion: true };
}

// ── Página ────────────────────────────────────────────────────────────────────

export default async function AdminProgramsPage({ searchParams }: { searchParams?: SearchParams }) {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();
  const params = (await searchParams) ?? {};
  const success = typeof params.success === "string" ? params.success : null;
  const error = typeof params.error === "string" ? params.error : null;

  // Buscador del lado del servidor, mismo criterio que clases y sesiones.
  const q = (typeof params.q === "string" ? params.q : "").trim();
  const fEstadoProg = ESTADOS_PROG.some((e) => e.key === params.estado) ? (params.estado as string) : "";
  // Filtros nuevos (2026-10-25): quien lo ve, y que categorias trabaja (las de
  // sus clases).
  const OPC_PLAN = [
    { key: "", label: "Cualquier plan" },
    { key: "solista", label: "Desde Solista" },
    { key: "principal", label: "Solo Principal" },
  ];
  const OPC_CATEGORIA = [{ key: "", label: "Cualquier categoría" }, ...CATEGORIAS.map((c) => ({ key: c.slug as string, label: c.label as string }))];
  const fPlanProg = OPC_PLAN.some((o) => o.key && o.key === params.plan) ? (params.plan as string) : "";
  const fCategoriaProg = OPC_CATEGORIA.some((o) => o.key && o.key === params.categoria) ? (params.categoria as string) : "";

  const { count: totalProgramas } = await supabase
    .from("programs").select("*", { count: "exact", head: true });

  const [{ data: programsData }, programDaysData, { data: videosData }] = await Promise.all([
    (() => {
      let c = supabase
        .from("programs")
        .select("id, slug, title_i18n, description_i18n, membership_tier_required, status, duration_days, cover_image_url, is_featured");
      if (fEstadoProg) c = c.eq("status", fEstadoProg);
      if (fPlanProg) c = c.eq("membership_tier_required", fPlanProg);
      if (q) {
        const t = q.replace(/[,()]/g, " ");
        c = c.or(`slug.ilike.%${t}%,title_i18n->>es.ilike.%${t}%`);
      }
      return c.order("created_at", { ascending: false });
    })(),
    cargarDias(supabase),
    // title_i18n hace falta para que el selector de clases muestre titulos y no
    // slugs. Se ordena por titulo para que la lista se pueda recorrer con la vista.
    supabase.from("videos").select("id, slug, title_i18n, thumbnail_url, bunny_video_id, stream_playback_id, category_slugs").order("title_i18n->>es", { ascending: true })
  ]);

  const programDays = programDaysData.dias;

  // Cuantas alumnas empezaron y terminaron cada programa.
  //
  // Va aca y no solo en /admin/analiticas a proposito: una metrica sirve donde
  // se puede ACTUAR sobre ella. Si Brunela ve que un programa se abandona el
  // dia 4, quiere poder mirar el dia 4 sin cambiar de pantalla.
  const { data: progresoData } = await supabase
    .from("user_progress")
    .select("user_id, program_id, program_day_number")
    .not("program_id", "is", null);

  const usoPorPrograma = new Map<string, { empezaron: number; terminaron: number }>();
  {
    const llegoHasta = new Map<string, Map<string, number>>();
    for (const g of progresoData ?? []) {
      const pid = g.program_id as string;
      if (!llegoHasta.has(pid)) llegoHasta.set(pid, new Map());
      const m = llegoHasta.get(pid)!;
      const dia = g.program_day_number ?? 0;
      m.set(g.user_id, Math.max(m.get(g.user_id) ?? 0, dia));
    }
    for (const [pid, m] of llegoHasta) {
      // El ultimo dia CON CLASE: un descanso no deja progreso (no tiene
      // video), asi que un plan que termina en descanso no lo terminaria nadie.
      const totalDias = Math.max(
        0,
        ...programDays.filter((d) => d.program_id === pid && !d.es_descanso).map((d) => d.day_number)
      );
      usoPorPrograma.set(pid, {
        empezaron: m.size,
        terminaron: totalDias > 0
          ? Array.from(m.values()).filter((d) => d >= totalDias).length
          : 0,
      });
    }
  }

  // La categoria no es del plan sino de sus clases: se filtra aca, en memoria
  // (son pocos planes y los dias ya estan cargados).
  const categoriasDeVideo = new Map(((videosData ?? []) as { id: string; category_slugs?: string[] | null }[]).map((v) => [v.id, v.category_slugs ?? []]));
  const programs = ((programsData ?? []) as ProgramRecord[]).filter((pr) =>
    !fCategoriaProg ||
    programDays.some((d) => d.program_id === pr.id && d.video_id && (categoriasDeVideo.get(d.video_id) ?? []).includes(fCategoriaProg))
  );

  // Para las sugerencias del buscador: TODOS los planes, sin el filtro de la
  // busqueda (si no, al escribir solo se sugeriria lo que ya esta en pantalla).
  const { data: todosLosPlanes } = await supabase
    .from("programs")
    .select("id, slug, title_i18n, description_i18n, status, duration_days, cover_image_url")
    .order("created_at", { ascending: false });
  const planesParaBuscar: ClaseParaBuscar[] = ((todosLosPlanes ?? []) as Pick<ProgramRecord, "id" | "slug" | "title_i18n" | "description_i18n" | "status" | "duration_days" | "cover_image_url">[]).map((pl) => {
    const dias = programDays.filter((d) => d.program_id === pl.id);
    const primera = dias.find((d) => d.video_id && !d.es_descanso);
    const v = primera ? (videosData ?? []).find((x) => x.id === primera.video_id) : null;
    const nClases = dias.filter((d) => d.video_id && !d.es_descanso).length;
    return {
      id: pl.id,
      slug: pl.slug,
      titulo: pl.title_i18n?.es ?? "",
      tituloEn: pl.title_i18n?.en ?? "",
      categorias: nClases === 1 ? "1 clase" : `${nClases} clases`,
      descripcion: (pl.description_i18n?.es ?? "").slice(0, 160),
      estado: (["draft", "published", "archived"].includes(pl.status) ? pl.status : "draft") as ClaseParaBuscar["estado"],
      duracionMin: pl.duration_days,
      portada: portadaDePlan(pl.cover_image_url) || (v ? portadaDeClase(v) : null),
    };
  });
  const videos = (videosData ?? []) as VideoLookup[];
  const videoById = new Map(videos.map((v) => [v.id, v]));
  const publicados = programs.filter((p) => p.status === "published").length;

  const hayFiltro = Boolean(q || fEstadoProg || fPlanProg || fCategoriaProg);
  // El estudio todavia no tiene NINGUN plan (no es lo mismo que un filtro sin
  // resultados): ahi se muestra la guia en vez de cifras en cero.
  const estudioVacio = (totalProgramas ?? 0) === 0;
  // Se pagina sobre lo ya filtrado en SQL y en memoria: `publicados` y las
  // cifras miran la lista entera, no solo la pagina.
  const paginaPedida = Math.max(0, Math.min(1000, Math.floor(Number(params.pagina)) || 0));
  const pagina = Math.min(paginaPedida, Math.max(1, Math.ceil(programs.length / POR_PAGINA)) - 1);
  const enPagina = programs.slice(pagina * POR_PAGINA, pagina * POR_PAGINA + POR_PAGINA);
  const totalEmpezaron = [...usoPorPrograma.values()].reduce((a, u) => a + u.empezaron, 0);

  return (
    <main className="apl">
      <style>{CSS_PLANES}</style>

      <AdminCabecera
        eyebrow="Gestión de contenido"
        titulo="Planes de trabajo"
        lede="Recorridos de varios días: cada día lleva una clase y la alumna avanza en orden. Es lo que suma Solista sobre Corps de Ballet."
        acciones={<>
          <AdminBoton href="/admin/programs/nuevo" lleno><Plus size={16} strokeWidth={2.2} aria-hidden="true" /> Nuevo plan</AdminBoton>
          <AdminBoton href="/dashboard/programs"><Eye size={15} strokeWidth={2} aria-hidden="true" /> Ver como alumna</AdminBoton>
        </>}
      />

      <AdminAviso mensaje={success} tono="ok" />
      <AdminAviso mensaje={error} tono="error" />

      {estudioVacio ? (
        <>
          {/* Sin ningun plan, las cifras en cero y el buscador no dicen nada.
              En su lugar: como se ve un plan y los tres pasos para armarlo. */}
          <AdminGuia
            rotuloEjemplo="Así lo ve la alumna"
            ejemplo={
              <div className="ad-guia-flota">
                <div className="apl-ejemplo-portada">
                  <span className="apl-dias-num"><strong>14</strong> días</span>
                </div>
                <div className="apl-ejemplo-cuerpo">
                  <span className="apl-estado apl-estado--pub"><span className="apl-punto" />Publicado</span>
                  <p className="apl-ejemplo-titulo">Trabajo de pies</p>
                  <div className="apl-ejemplo-dias">
                    {Array.from({ length: 14 }, (_, i) => (
                      <span key={i} className="apl-ejemplo-dia" style={{ animationDelay: `${0.4 + i * 0.09}s` }} />
                    ))}
                  </div>
                  <p className="apl-ejemplo-hoy"><span>Hoy</span> Día 3 · Relevé en barra</p>
                </div>
              </div>
            }
            eyebrow="Tu primer plan"
            titulo="Armalo en tres pasos."
            pasos={[
              { icono: <Plus size={18} strokeWidth={2.2} />, titulo: "Creá el plan", texto: "Nombre, cuántos días dura y qué plan lo ve. Por ejemplo: «Trabajo de pies, 14 días», para Solista." },
              { icono: <CalendarDays size={18} strokeWidth={2} />, titulo: "Asigná una clase a cada día", texto: "Ahí mismo, al crearlo: cada día una clase o un descanso. Después, desde «Editar»." },
              { icono: <Rocket size={18} strokeWidth={2} />, titulo: "Publicalo", texto: "La alumna lo encuentra en «Planes de trabajo», ve qué le toca hoy y su plan recuerda por dónde va." },
            ]}
            cta={<AdminBoton href="/admin/programs/nuevo" lleno><Plus size={16} strokeWidth={2.2} aria-hidden="true" /> Crear el primer plan</AdminBoton>}
          />
        </>
      ) : (
        <>
      <AdminCifras items={[
        { label: "Planes", value: totalProgramas ?? programs.length, sub: "creados" },
        { label: "Publicados", value: publicados, sub: "visibles para las alumnas" },
        { label: "Días cargados", value: programDays.length, sub: "en todos los planes" },
        { label: "Alumnas", value: totalEmpezaron, sub: "empezaron alguno" },
      ]} />

      <AdminBuscador
        action="/admin/programs"
        q={q}
        placeholder="Buscar por título o dirección"
        // Sugerencias mientras se escribe, como en Clases. Se busca entre TODOS
        // los planes (son pocos), no solo los de esta pagina.
        entrada={<BuscadorDeClases de="plan" q={q} placeholder="Buscar por título o dirección" clases={planesParaBuscar} />}
        filtros={[
          { name: "estado", valor: fEstadoProg, etiqueta: "Estado", opciones: ESTADOS_PROG },
          { name: "plan", valor: fPlanProg, etiqueta: "Lo ve", opciones: OPC_PLAN },
          { name: "categoria", valor: fCategoriaProg, etiqueta: "Categoría", opciones: OPC_CATEGORIA },
        ]}
        total={totalProgramas ?? programs.length}
        mostrando={programs.length}
      />

      {programs.length === 0 ? (
        <AdminVacio titulo={hayFiltro ? "Ningún plan coincide." : "Todavía no hay planes de trabajo."}>
          {hayFiltro ? (
            <AdminBoton href="/admin/programs">Ver todos</AdminBoton>
          ) : (
            <>
              <p>Un plan es una serie de días en orden — «Trabajo de pies, 14 días». Creás el plan y después le asignás una clase a cada día.</p>
              <AdminBoton href="/admin/programs/nuevo" lleno><Plus size={16} strokeWidth={2.2} aria-hidden="true" /> Crear el primero</AdminBoton>
            </>
          )}
        </AdminVacio>
      ) : (
        <ul className="apl-grilla">
          {enPagina.map((program) => {
            const days = programDays.filter((d) => d.program_id === program.id);
            const st = STATUS_STYLE[program.status] ?? STATUS_STYLE.draft;
            const tier = TIER_STYLE[program.membership_tier_required] ?? TIER_STYLE.solista;
            const uso = usoPorPrograma.get(program.id);
            const cargados = new Map(days.map((d) => [d.day_number, d]));
            const total = Math.max(program.duration_days, ...days.map((d) => d.day_number), 0);
            // Un dia sin clase ES descanso, igual que lo ve la alumna
            // (completarConDescansos): los marcados y los que quedaron libres.
            const clases = days.filter((d) => !d.es_descanso && d.video_id).length;
            const descansos = Math.max(0, total - clases);

            return (
              <li key={program.id} className={"apl-card apl-card--" + program.status}>
                <div className="apl-portada">
                  {(() => {
                    // Sin portada propia: la foto de la primera clase del plan.
                    const primera = days.find((d) => d.video_id);
                    const v = primera ? (videosData ?? []).find((x) => x.id === primera.video_id) : null;
                    const src = portadaDePlan(program.cover_image_url) || (v ? portadaDeClase(v) : null);
                    return src ? <img src={src} alt="" /> : null;
                  })()}
                  <span className="apl-dias-num">
                    <strong>{program.duration_days}</strong> días
                  </span>
                  {program.is_featured && <span className="apl-dest"><Star size={12} strokeWidth={2.4} fill="currentColor" aria-hidden="true" /> Destacado</span>}
                </div>

                <div className="apl-cuerpo">
                  <div className="apl-linea">
                    <span className={"apl-estado " + st.clase}><span className="apl-punto" aria-hidden="true" />{st.label}</span>
                    <span className={"apl-plan apl-plan--" + program.membership_tier_required}>Desde {tier.label}</span>
                  </div>
                  <h2 className="apl-titulo">{program.title_i18n?.es ?? program.slug}</h2>

                  {/* Un cuadrito por dia: lleno si ya tiene clase. Es lo que
                      hay que mirar para saber que falta cargar. */}
                  <div className="apl-dias" aria-label={`${total} días: ${clases} con clase y ${descansos} de descanso`}>
                    {Array.from({ length: Math.min(total, 31) }, (_, i) => {
                      const d = cargados.get(i + 1);
                      return (
                        <span
                          key={i}
                          className={"apl-dia" + (d && !d.es_descanso ? " es-cargado" : " es-descanso")}
                          title={
                            !d || d.es_descanso ? `Día ${i + 1}: descanso`
                            : `Día ${i + 1}: ${tituloDe(d.video_id ? videoById.get(d.video_id) : undefined, "clase")}`
                          }
                        >
                          {!(d && !d.es_descanso) && <Heart size={15} strokeWidth={0} fill="currentColor" aria-hidden="true" />}
                        </span>
                      );
                    })}
                    {total > 31 && <span className="apl-dias-mas">+{total - 31}</span>}
                  </div>
                  <p className={"apl-dias-txt" + (clases === 0 ? " es-faltan" : "")}>
                    {clases === 0
                      ? <>Todavía no tiene clases</>
                      : <><Check size={13} strokeWidth={2.6} aria-hidden="true" /> {clases} {clases === 1 ? "clase" : "clases"}{descansos > 0 && <> · {descansos} {descansos === 1 ? "día" : "días"} de descanso</>}</>}
                  </p>

                  {uso && uso.empezaron > 0 && (
                    <p className="apl-uso">
                      {/* "Lo empezaron", no "vistas": lo unico que se puede
                          contar hoy es cuantas alumnas tienen progreso en el. */}
                      Lo empezaron <strong>{uso.empezaron}</strong> · lo terminaron <strong>{uso.terminaron}</strong>
                    </p>
                  )}

                  <div className="apl-pie">
                    {/* Un solo boton: abre el editor a pantalla completa (datos y dias). */}
                    <Link href={`/admin/programs/${program.id}`} className="ad-editar">
                      <Pencil size={14} strokeWidth={2} aria-hidden="true" /> Editar
                    </Link>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <Paginacion pagina={pagina} total={programs.length} porPagina={POR_PAGINA} href={hrefConPagina("/admin/programs", { q, estado: fEstadoProg, plan: fPlanProg, categoria: fCategoriaProg })} />
        </>
      )}
    </main>
  );
}

const CSS_PLANES = `
.apl { display: flex; flex-direction: column; }
.apl-grilla { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 320px), 1fr)); gap: 18px; }
.apl-card {
  position: relative; display: flex; flex-direction: column; border: 1px solid var(--linea); border-radius: 28px; background: #fff; overflow: hidden;
  box-shadow: var(--sombra);
  transition: transform .35s var(--curva), box-shadow .35s, border-color .25s;
}
.apl-card:hover { transform: translateY(-3px); border-color: var(--linea-fuerte); box-shadow: var(--sombra-alta); }
.apl-card--archived { opacity: 0.65; }
.apl-portada {
  position: relative; aspect-ratio: 16 / 7; overflow: hidden; margin: 10px 10px 0; border-radius: 20px;
  background:
    radial-gradient(160px 120px at 85% 10%, rgba(255,205,185,.9), transparent 70%),
    linear-gradient(140deg, #FFF1EC 0%, #FDE3E0 60%, #FFE2D3 100%);
}
.apl-portada img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; transition: transform .8s var(--curva); }
.apl-card:hover .apl-portada img { transform: scale(1.05); }
.apl-dias-num {
  position: absolute; left: 12px; bottom: 12px; display: inline-flex; align-items: baseline; gap: 6px;
  font-size: 13px; font-weight: 800; color: var(--pink-deep);
  padding: 5px 13px; border-radius: 99px; background: rgba(255,255,255,0.92); backdrop-filter: blur(6px);
}
.apl-dias-num strong { font-weight: 900; font-size: 18px; letter-spacing: -0.02em; color: var(--ink); }
.apl-dest {
  position: absolute; right: 12px; top: 12px; display: inline-flex; align-items: center; gap: 5px;
  font-size: 12px; font-weight: 800; color: var(--melocoton-deep); padding: 5px 11px; border-radius: 99px; background: #fff;
}
.apl-cuerpo { display: flex; flex-direction: column; flex: 1; padding: 16px 20px 20px; }
.apl-linea { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 8px; }
.apl-estado { display: inline-flex; align-items: center; gap: 7px; padding: 5px 12px 5px 10px; border-radius: 99px; font-size: 12.5px; font-weight: 800; }
.apl-punto { width: 7px; height: 7px; border-radius: 50%; background: currentColor; }
.apl-estado--pub { color: var(--pink-deep); background: var(--rubor); }
.apl-estado--borr { color: var(--melocoton-deep); background: #FFEBDF; }
.apl-estado--arch { color: var(--muted); background: #F6EEEA; }
.apl-plan { font-size: 12.5px; font-weight: 800; padding: 4px 12px; border-radius: 99px; }
.apl-plan--solista { color: var(--pink-deep); background: var(--rubor); border: 1.5px solid var(--pink-line); }
.apl-plan--principal { color: #fff; background: var(--pink); border: 1.5px solid var(--pink); }
.apl-titulo { font-weight: 900; font-size: 21px; line-height: 1.2; letter-spacing: -0.02em; color: var(--ink); }

.apl-dias { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 14px; }
.apl-dia { width: 16px; height: 16px; border-radius: 6px; background: #FFEBDF; transition: transform .25s var(--curva); }
.apl-dia.es-cargado { background: var(--pink); box-shadow: 0 4px 8px -4px rgba(230,79,85,.7); }
/* Descanso: cargado, pero en melocoton y redondo, para que se distinga de una clase. */
/* Descanso: un corazon (pedido 2026-10-25). */
.apl-dia.es-descanso { background: none; display: grid; place-items: center; color: var(--pink-soft, #F7A8AB); }
.apl-dia:hover { transform: scale(1.25); }
.apl-dias-mas { font-size: 12px; font-weight: 800; color: var(--muted); align-self: center; margin-left: 2px; }
.apl-dias-txt {
  display: inline-flex; align-self: flex-start; align-items: center; gap: 6px; margin-top: 10px; padding: 5px 12px; border-radius: 99px;
  font-size: 12.5px; font-weight: 800; color: var(--pink-deep); background: var(--rubor);
}
.apl-dias-txt.es-faltan { color: var(--melocoton-deep); background: #FFF4E8; }
.apl-dias-txt strong { color: inherit; }
.apl-uso { margin-top: 8px; font-size: 13px; color: var(--muted); }
.apl-uso strong { color: var(--ink); }
.apl-pie { margin-top: auto; padding-top: 16px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.apl .ad-editar { text-decoration: none;
  display: inline-flex; align-items: center; gap: 7px; height: 42px; padding: 0 18px; border-radius: 99px; cursor: pointer;
  border: 1.5px solid var(--linea-fuerte); background: #fff; color: var(--ink); font: inherit; font-size: 14px; font-weight: 800;
  transition: background .2s, border-color .2s, transform .3s var(--curva);
}
.apl .ad-editar svg { color: var(--pink-deep); }
.apl .ad-editar:hover { background: var(--rubor); border-color: var(--pink-line); color: var(--ink); transform: translateY(-2px); }
.pf-paso:disabled { opacity: .35; cursor: not-allowed; background: #FFFAF6; color: #B39189; }

/* guia de primer plan (solo con el estudio sin ningun plan) */
.apl-ejemplo-portada {
  position: relative; aspect-ratio: 16 / 7;
  background:
    radial-gradient(160px 120px at 85% 10%, rgba(255,205,185,.9), transparent 70%),
    linear-gradient(140deg, #FFF1EC 0%, #FDE3E0 60%, #FFE2D3 100%);
}
.apl-ejemplo-cuerpo { padding: 16px 18px 18px; }
.apl-ejemplo-titulo { margin-top: 8px; font-weight: 900; font-size: 20px; letter-spacing: -0.02em; color: var(--ink); }
.apl-ejemplo-dias { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 12px; }
.apl-ejemplo-dia { width: 17px; height: 17px; border-radius: 6px; background: #FFEBDF; animation: apl-llena 0.4s ease both; }
.apl-ejemplo-dia:nth-child(-n+3) { animation-name: apl-llena-hecho; }
.apl-ejemplo-dia:nth-child(3) { animation-name: apl-llena-hoy; }
@keyframes apl-llena { from { transform: scale(0.4); opacity: 0; } to { transform: none; opacity: 1; background: #FFE2D3; } }
@keyframes apl-llena-hecho { from { transform: scale(0.4); opacity: 0; } to { transform: none; opacity: 1; background: var(--pink); } }
@keyframes apl-llena-hoy { from { transform: scale(0.4); opacity: 0; } to { transform: none; opacity: 1; background: var(--pink); box-shadow: 0 0 0 3px #fff, 0 0 0 5px var(--pink-line); } }
.apl-ejemplo-hoy { display: flex; align-items: center; gap: 8px; margin-top: 12px; font-size: 13px; font-weight: 700; color: #6E5550; }
.apl-ejemplo-hoy span {
  font-size: 12px; font-weight: 800; color: var(--pink-deep);
  background: var(--rubor); padding: 3px 10px; border-radius: 99px;
}

@media (prefers-reduced-motion: reduce) {
  .apl-ejemplo-dia { animation: none; }
  .apl-ejemplo-dia { background: #FFE2D3; }
  .apl-ejemplo-dia:nth-child(-n+3) { background: var(--pink); }
  .apl-card:hover { transform: none; }
}
`;

// ── Formulario ────────────────────────────────────────────────────────────────

