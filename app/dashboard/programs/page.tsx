import Link from "next/link";
import { ArrowRight, CalendarDays, Check, ListChecks, Lock, Sparkles, Star } from "lucide-react";
import { AdminBoton, AdminCabecera, AdminCifras, AdminGuia } from "@/components/admin-ui";
import { AdminBuscador } from "@/components/admin-buscador";
import {
  membershipTierLabel,
  resolveI18nText,
  safePercent,
  type MembershipTier,
  type ProgramStatus
} from "@/src/features/studio/helpers";
import { requireUser } from "@/src/features/auth/guards";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";
import { createSupabaseAdminClient } from "@/src/lib/supabase/admin";
import { getCurrentProfile } from "@/src/features/auth/profile";
import { getProgresoDelUsuario } from "@/src/features/studio/progress";
import { CATEGORIA_LABEL, nivelEnTexto } from "@/src/features/studio/catalogo-clases";

/**
 * Los planes de trabajo, con candado para quien todavia no los tiene.
 *
 * POR QUE HAY VITRINA
 *   Un plan de trabajo es LA diferencia entre Corps de Ballet y Solista: Corps
 *   ve las clases sueltas, Solista las ve ordenadas en un recorrido de varios
 *   dias. Hasta hoy RLS le escondia los planes a Corps -- correctamente -- y
 *   esta pantalla le decia «Todavia no hay programas publicados para tu plan».
 *
 *   O sea que a quien habia que convencer de subir de plan se le mostraba una
 *   pantalla vacia que se lee como «aca no hay nada». Ahora ve los planes que
 *   existen, con candado y con el plan que hace falta.
 *
 * 🔴 LO QUE LA VITRINA NO MUESTRA, Y ES EL PUNTO
 *    El DIA POR DIA. Que clase toca cada dia es el trabajo de Brunela y es lo
 *    que se paga; la vitrina muestra portada, titulo, descripcion, cuantos dias
 *    y los chips. El detalle (`[slug]`) tiene su propia version bloqueada.
 *
 *    La tarjeta bloqueada TAMPOCO enlaza al detalle: lleva a /dashboard/plan.
 *    Es la misma decision que en la biblioteca.
 */

type ProgramRecord = {
  id: string;
  slug: string;
  title_i18n: Record<string, string>;
  description_i18n: Record<string, string>;
  membership_tier_required: MembershipTier;
  duration_days: number;
  cover_image_url: string | null;
  is_featured: boolean;
  status: ProgramStatus;
};

type VideoDeDia = { recommended_min_level: string | null; category_slugs: string[] | null };

type ProgramDayRecord = {
  program_id: string;
  // PostgREST tipa el embed como arreglo aunque la relacion sea a-uno.
  videos: VideoDeDia | VideoDeDia[] | null;
};

/** Normaliza el embed, venga como objeto o como arreglo de uno. */
function claseDelDia(videos: ProgramDayRecord["videos"]): VideoDeDia | null {
  if (!videos) return null;
  return Array.isArray(videos) ? videos[0] ?? null : videos;
}

const ORDEN_NIVEL = ["principiante", "intermedio", "avanzado", "profesional", "maestro"];

type ProgressRecord = {
  program_id: string | null;
  completion_percent: number;
  is_completed: boolean;
};

/**
 * Las columnas de la vitrina.
 *
 * Es la lista completa de `programs` menos nada: en esta tabla no hay ningun
 * campo sensible -- no guarda ids de Bunny ni de Stripe. Lo que hay que cuidar
 * es `program_days`, que dice QUE clase va cada dia, y eso no se consulta por
 * plan bloqueado en ningun lado de este archivo.
 */
const COLUMNAS =
  "id, slug, title_i18n, description_i18n, membership_tier_required, duration_days, cover_image_url, is_featured, status";

export default async function DashboardProgramsPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const params = (await searchParams) ?? {};
  const txt = (k: string) => (typeof params[k] === "string" ? (params[k] as string).trim() : "");
  const q = txt("q").slice(0, 80);
  const fAcceso = ["mios", "bloqueados", "en-curso"].includes(txt("ver")) ? txt("ver") : "";
  const fNivel = ["principiante", "intermedio", "avanzado"].includes(txt("nivel")) ? txt("nivel") : "";
  const pagina = Math.max(0, Math.min(100, Number(params.pagina) || 0));
  const POR_PAGINA = 9;
  const { user } = await requireUser();
  const supabase = await createSupabaseServerClient();
  const admin = createSupabaseAdminClient();

  const profile = await getCurrentProfile(user.id);
  const isAdmin = profile?.is_admin ?? false;

  const [{ data: accesiblesData }, { data: programsData }, { data: daysData }, progressRows] =
    await Promise.all([
      /**
       * ⚠️ Con el cliente DE LA ALUMNA, o sea RLS. Es lo que decide el candado.
       *    Un calculo aparte en JavaScript podria decir que si y la pagina de
       *    detalle que no -- que es exactamente el tipo de desacuerdo que este
       *    proyecto ya pago cuatro veces.
       */
      supabase.from("programs").select("id"),

      // La lista visible: solo publicados, para todas. /dashboard es la vista
      // de alumna, admin incluida; los borradores se ven en /admin/programs.
      admin.from("programs").select(COLUMNAS)
        .eq("status", "published")
        .order("is_featured", { ascending: false })
        .order("published_at", { ascending: false }),

      // Nivel y foco salen del CONTENIDO real del plan, no de campos de
      // `programs`. Se piden con service_role para que los chips existan
      // tambien en las tarjetas bloqueadas.
      //
      // 🔴 SOLO estos dos campos del video. Ni slug, ni id, ni titulo: con el
      //    slug se puede tantear /dashboard/library/<slug>, y aunque RLS lo
      //    frenaria, el dia por dia de un plan que no se pago no tiene por que
      //    salir de la base.
      admin.from("program_days").select("program_id, videos(recommended_min_level, category_slugs)"),

      getProgresoDelUsuario(user.id).then((filas) => filas.filter((f) => f.program_id !== null)),
    ]);

  const programs = (programsData ?? []) as unknown as ProgramRecord[];
  const days = (daysData ?? []) as unknown as ProgramDayRecord[];

  /**
   * A la admin RLS le contesta "todos" (la policy lleva is_admin()), asi que
   * para mostrarle la vista de alumna el candado sale del plan de su perfil:
   * lo que veria una alumna con ese plan. Para la alumna decide RLS, siempre.
   */
  const RANGO: Record<string, number> = { none: 0, corps_de_ballet: 1, solista: 2, principal: 3 };
  const rangoPropio = RANGO[profile?.membership_tier ?? "none"] ?? 0;
  const accesibles = isAdmin
    ? new Set(((programsData ?? []) as unknown as ProgramRecord[])
        .filter((p) => (RANGO[p.membership_tier_required] ?? 0) <= rangoPropio)
        .map((p) => p.id))
    : new Set((accesiblesData ?? []).map((p: { id: string }) => p.id));
  const bloqueado = (id: string) => !accesibles.has(id);
  const hayBloqueados = programs.some((p) => bloqueado(p.id));

  const daysByProgram = new Map<string, number>();
  // Nivel exigido = el mas alto entre los minimos de sus clases. Es el nivel que
  // hace falta para seguir el plan entero, no el de la clase mas facil.
  const nivelPorPrograma = new Map<string, string>();
  const categoriasPorPrograma = new Map<string, Map<string, number>>();

  for (const day of days) {
    daysByProgram.set(day.program_id, (daysByProgram.get(day.program_id) ?? 0) + 1);

    const clase = claseDelDia(day.videos);
    const nivel = clase?.recommended_min_level;
    if (nivel) {
      const actual = nivelPorPrograma.get(day.program_id);
      if (!actual || ORDEN_NIVEL.indexOf(nivel) > ORDEN_NIVEL.indexOf(actual)) {
        nivelPorPrograma.set(day.program_id, nivel);
      }
    }

    const conteo = categoriasPorPrograma.get(day.program_id) ?? new Map<string, number>();
    for (const cat of clase?.category_slugs ?? []) {
      conteo.set(cat, (conteo.get(cat) ?? 0) + 1);
    }
    categoriasPorPrograma.set(day.program_id, conteo);
  }

  /** Foco = la categoria que mas aparece entre las clases del plan. */
  const focoDe = (programId: string) => {
    const conteo = categoriasPorPrograma.get(programId);
    if (!conteo || conteo.size === 0) return null;
    const [top] = [...conteo.entries()].sort((a, b) => b[1] - a[1]);
    return CATEGORIA_LABEL[top[0]] ?? top[0];
  };

  const progressByProgram = new Map<string, { completedDays: number; maxPercent: number }>();

  for (const progress of progressRows as ProgressRecord[]) {
    if (!progress.program_id) continue;

    const current = progressByProgram.get(progress.program_id) ?? { completedDays: 0, maxPercent: 0 };
    current.maxPercent = Math.max(current.maxPercent, safePercent(progress.completion_percent));
    if (progress.is_completed) current.completedDays += 1;

    progressByProgram.set(progress.program_id, current);
  }

  const mios = programs.filter((p) => !bloqueado(p.id)).length;

  // Buscador y filtros (pedido de la duena). En memoria: son decenas de planes.
  const normal = (t: string) => t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const filtrados = programs.filter((p) => {
    const t = (p.title_i18n?.es ?? "") + " " + (p.description_i18n?.es ?? "") + " " + (focoDe(p.id) ?? "");
    if (q && !normal(t).includes(normal(q))) return false;
    if (fAcceso === "mios" && bloqueado(p.id)) return false;
    if (fAcceso === "bloqueados" && !bloqueado(p.id)) return false;
    if (fAcceso === "en-curso" && (bloqueado(p.id) || (progressByProgram.get(p.id)?.completedDays ?? 0) === 0)) return false;
    if (fNivel) {
      const n = nivelPorPrograma.get(p.id);
      if (fNivel === "avanzado" ? !(n && ["avanzado", "profesional", "maestro"].includes(n)) : n !== fNivel) return false;
    }
    return true;
  });
  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA));
  const paginaReal = Math.min(pagina, totalPaginas - 1);
  const enPagina = filtrados.slice(paginaReal * POR_PAGINA, paginaReal * POR_PAGINA + POR_PAGINA);
  const conPagina = (p: number) => {
    const u = new URLSearchParams();
    if (q) u.set("q", q);
    if (fAcceso) u.set("ver", fAcceso);
    if (fNivel) u.set("nivel", fNivel);
    if (p > 0) u.set("pagina", String(p));
    const t = u.toString();
    return "/dashboard/programs" + (t ? "?" + t : "");
  };
  const enCurso = programs.filter((p) => !bloqueado(p.id) && (progressByProgram.get(p.id)?.completedDays ?? 0) > 0).length;
  const diasHechos = [...progressByProgram.values()].reduce((a, p) => a + p.completedDays, 0);

  return (
    <main className="sp">
      <style>{CSS}</style>
      <section className="sp-shell">
        <AdminCabecera
          eyebrow="Planes de trabajo"
          titulo="Entrená con un orden"
          lede="Una serie de días pensados en orden — «Trabajo de pies, 14 días». En vez de elegir una clase suelta cada vez, ya sabés qué te toca hoy, y el plan recuerda por dónde vas."
        />

        {mios > 0 && (
          <AdminCifras items={[
            { label: "Tus planes", value: mios, sub: hayBloqueados ? `de ${programs.length} en el estudio` : "disponibles" },
            { label: "En curso", value: enCurso, sub: "con algún día hecho" },
            { label: "Días completados", value: diasHechos, sub: "en todos tus planes" },
          ]} />
        )}

        {/* El aviso va ARRIBA de la rejilla y no dentro de cada tarjeta: repetido
            doce veces se vuelve ruido, y una sola vez explica los doce candados. */}
        {hayBloqueados && mios === 0 && (
          <Link href="/dashboard/plan" className="sp-subir">
            <span className="sp-subir-ico"><Sparkles size={22} strokeWidth={1.8} aria-hidden="true" /></span>
            <span className="sp-subir-txt">
              <span className="sp-subir-eyebrow">Los planes de trabajo son de Solista</span>
              <span className="sp-subir-titulo">Brunela te arma el recorrido.</span>
              <span className="sp-subir-sub">
                Con Corps de Ballet tenés todas las clases y elegís cuál hacer. Con Solista sabés qué clase toca cada día,
                en qué orden y con qué objetivo.
              </span>
            </span>
            <span className="sp-subir-btn">Ver planes <ArrowRight size={16} strokeWidth={2.2} aria-hidden="true" /></span>
          </Link>
        )}

        {programs.length === 0 ? (
          <AdminGuia
            rotuloEjemplo="Así se ve un plan"
            ejemplo={
              <div className="ad-guia-flota">
                <div className="sp-portada"><span className="sp-dias"><strong>14</strong> días</span></div>
                <div className="sp-cuerpo">
                  <p className="sp-titulo">Trabajo de pies</p>
                  <div className="sp-ej-dias">
                    {Array.from({ length: 14 }, (_, i) => (
                      <span key={i} className={"sp-ej-dia" + (i < 2 ? " es-hecho" : i === 2 ? " es-hoy" : "")} style={{ animationDelay: `${0.4 + i * 0.08}s` }} />
                    ))}
                  </div>
                  <p className="sp-ej-hoy"><span>Hoy</span> Día 3 · Relevé en barra</p>
                </div>
              </div>
            }
            eyebrow="Brunela está armando los primeros"
            titulo="Así se usan."
            pasos={[
              { icono: <ListChecks size={18} strokeWidth={2} />, titulo: "Elegís un plan", texto: "Cada uno es un recorrido de varios días con un objetivo: pies, giros, fuerza." },
              { icono: <CalendarDays size={18} strokeWidth={2} />, titulo: "Cada día te toca una clase", texto: "No tenés que elegir: abrís el plan y ves qué hacer hoy." },
              { icono: <Check size={18} strokeWidth={2.4} />, titulo: "Tu avance se guarda solo", texto: "Si lo dejás, retomás desde el día en que quedaste." },
            ]}
            cta={<AdminBoton href="/dashboard/library" lleno>Mientras tanto, ver clases <ArrowRight size={16} strokeWidth={2.2} aria-hidden="true" /></AdminBoton>}
          />
        ) : (
          <>
          <AdminBuscador
            action="/dashboard/programs"
            q={q}
            placeholder="Buscar un plan: pies, giros, flexibilidad…"
            total={programs.length}
            mostrando={filtrados.length}
            filtros={[
              { name: "ver", valor: fAcceso, etiqueta: "Mostrar", opciones: [{ key: "", label: "Todos" }, { key: "mios", label: "Los de mi plan" }, { key: "en-curso", label: "En curso" }, { key: "bloqueados", label: "Con candado" }] },
              { name: "nivel", valor: fNivel, etiqueta: "Nivel", opciones: [{ key: "", label: "Todos los niveles" }, { key: "principiante", label: "Inicial" }, { key: "intermedio", label: "Intermedio" }, { key: "avanzado", label: "Avanzado" }] },
            ]}
          />
          {filtrados.length === 0 && (
            <div className="ad-vacio">
              <p className="ad-vacio-titulo">Ningún plan coincide.</p>
              <p>Probá con otra palabra o sacá algún filtro.</p>
              <Link href="/dashboard/programs" className="ad-btn">Ver todos</Link>
            </div>
          )}
          <ul className="sp-grilla">
            {enPagina.map((program) => {
              const cerrado = bloqueado(program.id);
              const progress = progressByProgram.get(program.id);
              const totalDays = daysByProgram.get(program.id) ?? 0;
              const completedDays = progress?.completedDays ?? 0;
              const progressPercent = safePercent(
                totalDays > 0 ? Math.round((completedDays / totalDays) * 100) : progress?.maxPercent ?? 0
              );
              const nivel = nivelPorPrograma.get(program.id);
              const foco = focoDe(program.id);
              const terminado = totalDays > 0 && completedDays >= totalDays;

              return (
                <li key={program.id}>
                  <Link
                    className={"sp-card" + (cerrado ? " es-cerrado" : "")}
                    href={(cerrado ? "/dashboard/plan" : `/dashboard/programs/${program.slug}`) as never}
                  >
                    <div className="sp-portada">
                      {program.cover_image_url && <img src={program.cover_image_url} alt="" />}
                      <span className="sp-dias"><strong>{totalDays || program.duration_days}</strong> días</span>
                      {program.is_featured && !cerrado && (
                        <span className="sp-dest"><Star size={12} strokeWidth={2.4} fill="currentColor" aria-hidden="true" /> Destacado</span>
                      )}
                      {cerrado && (
                        <span className="sp-candado"><Lock size={12} strokeWidth={2.4} aria-hidden="true" /> Desde {membershipTierLabel(program.membership_tier_required)}</span>
                      )}
                    </div>

                    <div className="sp-cuerpo">
                      {(nivel || foco) && (
                        <div className="sp-chips">
                          {/* El mismo valor dos veces: aca no hay un rango, hay UN
                              nivel -- el mas alto entre las clases del plan. Con
                              `null` de maximo, rangoANivel lo leeria como un rango
                              abierto y diria "Todos los niveles". */}
                          {nivel && <span className="sp-chip">{nivelEnTexto(nivel, nivel)}</span>}
                          {foco && <span className="sp-chip">{foco}</span>}
                        </div>
                      )}
                      <h2 className="sp-titulo">{resolveI18nText(program.title_i18n)}</h2>
                      <p className="sp-desc">{resolveI18nText(program.description_i18n) || "Un recorrido de varios días, en orden."}</p>

                      <div className="sp-pie">
                        {cerrado ? (
                          <span className="sp-ver-plan">Disponible desde {membershipTierLabel(program.membership_tier_required)} <ArrowRight size={15} strokeWidth={2.2} aria-hidden="true" /></span>
                        ) : (
                          <>
                            <div className="sp-progreso">
                              <span className="sp-progreso-txt">
                                {terminado ? <><Check size={13} strokeWidth={2.8} aria-hidden="true" /> Completado</> : <><strong>{completedDays}</strong> de {totalDays} días</>}
                              </span>
                              <span className="sp-progreso-pct">{progressPercent}%</span>
                            </div>
                            <span className="sp-barra"><span style={{ width: `${progressPercent}%` }} /></span>
                            <span className="sp-seguir">
                              {completedDays === 0 ? "Empezar" : terminado ? "Repasar" : "Seguir"} <ArrowRight size={15} strokeWidth={2.2} aria-hidden="true" />
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
          {totalPaginas > 1 && (
            <nav className="sp-paginas" aria-label="Páginas">
              {paginaReal > 0 ? <Link href={conPagina(paginaReal - 1) as never} className="ad-btn">← Anteriores</Link> : <span />}
              <span className="sp-paginas-txt">Página {paginaReal + 1} de {totalPaginas}</span>
              {paginaReal < totalPaginas - 1 ? <Link href={conPagina(paginaReal + 1) as never} className="ad-btn">Siguientes →</Link> : <span />}
            </nav>
          )}
          </>
        )}
      </section>
    </main>
  );
}

const CSS = `
.sp-paginas { display: flex; align-items: center; justify-content: space-between; gap: 14px; margin-top: 8px; }
.sp-paginas-txt { font-size: 13px; font-weight: 700; color: var(--muted); padding: 8px 14px; border-radius: 99px; background: var(--rubor); }
.sp { padding-bottom: 80px; }
.sp-shell { max-width: 1320px; margin: 0 auto; padding: clamp(20px, 3vw, 40px) clamp(16px, 3.4vw, 48px) 0; display: flex; flex-direction: column; gap: 18px; }
.sp .ad-mast { padding-bottom: 4px; }

/* Invitacion a subir de plan: tarjeta tibia, no un cartel de error. */
.sp-subir {
  position: relative; overflow: hidden; isolation: isolate;
  display: flex; align-items: center; gap: 20px; flex-wrap: wrap; padding: 24px 26px; border-radius: 30px; text-decoration: none;
  background: linear-gradient(120deg, #FFF1EC 0%, #FFF7F3 55%, #FFEFE6 100%); border: 1px solid var(--linea);
  transition: border-color .2s, transform .35s var(--curva), box-shadow .35s;
}
.sp-subir::after { content: ""; position: absolute; z-index: -1; width: 260px; height: 260px; right: -60px; top: -130px; border-radius: 50%; background: radial-gradient(circle, rgba(255,205,185,.7), transparent 68%); }
.sp-subir:hover { border-color: var(--pink-line); transform: translateY(-3px); box-shadow: var(--sombra-alta); }
.sp-subir-ico { width: 56px; height: 56px; border-radius: 18px; flex-shrink: 0; display: grid; place-items: center; background: #fff; color: var(--pink-deep); box-shadow: var(--sombra); transition: transform .5s var(--curva); }
.sp-subir:hover .sp-subir-ico { transform: rotate(-8deg) scale(1.06); }
.sp-subir-txt { flex: 1; min-width: 220px; display: flex; flex-direction: column; align-items: flex-start; gap: 4px; }
.sp-subir-eyebrow { display: inline-flex; padding: 4px 11px; border-radius: 99px; background: #fff; font-size: 12.5px; font-weight: 800; color: var(--pink-deep); }
.sp-subir-titulo { margin-top: 4px; font-weight: 900; font-size: 23px; letter-spacing: -0.02em; color: var(--ink); }
.sp-subir-sub { font-size: 14px; line-height: 1.6; color: var(--muted); max-width: 70ch; }
.sp-subir-btn { display: inline-flex; align-items: center; gap: 8px; height: 48px; padding: 0 24px; border-radius: 99px; background: var(--pink); color: #fff; font-weight: 800; font-size: 14.5px; box-shadow: 0 14px 26px -14px rgba(230,79,85,.85); }

/* Rejilla de planes */
.sp-grilla { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(min(320px, 100%), 1fr)); gap: 22px; }
@keyframes sp-entra { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }
.sp-grilla > li { animation: sp-entra .7s var(--curva) backwards; }
.sp-grilla > li:nth-child(2) { animation-delay: .06s; }
.sp-grilla > li:nth-child(3) { animation-delay: .12s; }
.sp-grilla > li:nth-child(n+4) { animation-delay: .18s; }
.sp-card {
  display: flex; flex-direction: column; height: 100%; padding: 10px; border: 1px solid var(--linea); border-radius: 30px; background: #fff;
  box-shadow: var(--sombra); text-decoration: none; color: inherit;
  transition: transform .35s var(--curva), box-shadow .35s, border-color .25s;
}
.sp-card:hover { transform: translateY(-4px); border-color: var(--linea-fuerte); box-shadow: var(--sombra-alta); }

/* Portada: redondeada y metida adentro de la tarjeta, como una foto en un marco. */
.sp-portada { position: relative; aspect-ratio: 16 / 9; overflow: hidden; border-radius: 22px; background: linear-gradient(135deg, #FFE9DE 0%, #FFDADA 60%, #F7EBFA 130%); }
.sp-grilla > li:nth-child(3n+2) .sp-portada { background: linear-gradient(135deg, #FFE4E4 0%, #FFE9DE 60%, #FFF4E8 130%); }
.sp-grilla > li:nth-child(3n+3) .sp-portada { background: linear-gradient(135deg, #FFF4E8 0%, #FFE9DE 70%, #FFDADA 130%); }
.sp-portada img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; transition: transform .9s var(--curva), filter .4s; }
.sp-card:hover .sp-portada img { transform: scale(1.05); }

/* Cerrado: velo crema en vez de gris. Se ve que existe, se ve que espera. */
.sp-card.es-cerrado .sp-portada img { filter: saturate(.55) brightness(1.04); }
.sp-card.es-cerrado .sp-portada::after { content: ""; position: absolute; inset: 0; background: linear-gradient(180deg, rgba(255,250,246,.15) 0%, rgba(255,242,238,.55) 100%); }
.sp-card.es-cerrado:hover .sp-portada img { filter: saturate(.8) brightness(1.02); }

.sp-dias {
  position: absolute; z-index: 1; left: 12px; bottom: 12px; display: inline-flex; align-items: baseline; gap: 5px; padding: 5px 13px; border-radius: 99px;
  background: rgba(255,255,255,0.94); font-size: 13px; font-weight: 800; color: var(--pink-deep); box-shadow: 0 8px 18px -12px rgba(176,70,70,.5);
}
.sp-dias strong { font-weight: 900; font-size: 18px; letter-spacing: -0.02em; color: var(--ink); }
.sp-dest, .sp-candado {
  position: absolute; z-index: 1; top: 12px; display: inline-flex; align-items: center; gap: 6px; padding: 5px 12px 5px 6px; border-radius: 99px;
  font-size: 12.5px; font-weight: 800; background: rgba(255,255,255,.95); box-shadow: 0 8px 18px -12px rgba(176,70,70,.5);
}
.sp-dest svg, .sp-candado svg { box-sizing: content-box; padding: 5px; border-radius: 50%; }
.sp-dest { left: 12px; color: var(--melocoton-deep); }
.sp-dest svg { background: var(--melocoton); }
.sp-candado { right: 12px; color: var(--pink-deep); }
.sp-candado svg { background: var(--rubor); }
.sp-card.es-cerrado:hover .sp-candado svg { animation: sp-menea .6s var(--curva); }
@keyframes sp-menea { 0%, 100% { transform: rotate(0); } 30% { transform: rotate(-14deg); } 65% { transform: rotate(10deg); } }

.sp-cuerpo { display: flex; flex-direction: column; flex: 1; padding: 16px 12px 12px; }
.sp-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px; }
.sp-chip { padding: 4px 11px; border-radius: 99px; font-size: 12.5px; font-weight: 800; color: var(--pink-deep); background: var(--rubor); }
.sp-chip + .sp-chip { color: var(--melocoton-deep); background: #FFF4E8; }
.sp-titulo { font-weight: 900; font-size: 22px; line-height: 1.15; letter-spacing: -0.02em; color: var(--ink); transition: color .2s; }
.sp-card:hover .sp-titulo { color: var(--pink-deep); }
.sp-desc { margin-top: 6px; font-size: 14px; line-height: 1.6; color: var(--muted); display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.sp-pie { margin-top: auto; padding-top: 18px; display: flex; flex-direction: column; gap: 9px; }
.sp-progreso { display: flex; align-items: center; justify-content: space-between; font-size: 13px; font-weight: 600; color: var(--muted); }
.sp-progreso-txt { display: inline-flex; align-items: center; gap: 5px; }
.sp-progreso-txt strong { color: var(--ink); font-weight: 900; }
.sp-progreso-pct { padding: 2px 9px; border-radius: 99px; background: var(--rubor); font-weight: 900; font-size: 12.5px; color: var(--pink-deep); }
.sp-barra { display: block; height: 10px; border-radius: 99px; background: var(--rubor); overflow: hidden; }
.sp-barra span { display: block; height: 100%; border-radius: 99px; background: linear-gradient(90deg, #F38A6C, var(--pink)); animation: sp-llena 1.2s var(--curva) both .2s; transform-origin: left; }
@keyframes sp-llena { from { transform: scaleX(0); } to { transform: none; } }
.sp-seguir, .sp-ver-plan {
  display: inline-flex; align-items: center; justify-content: center; gap: 7px; height: 46px; margin-top: 6px; border-radius: 99px;
  font-size: 14px; font-weight: 800; transition: gap .25s var(--curva), background .2s, box-shadow .3s;
}
.sp-seguir { background: var(--pink); color: #fff; box-shadow: 0 14px 26px -14px rgba(230,79,85,.85); }
.sp-card:hover .sp-seguir { background: var(--pink-mid); gap: 11px; }
.sp-ver-plan { background: var(--rubor); color: var(--pink-deep); border: 1.5px solid var(--pink-line); }
.sp-card:hover .sp-ver-plan { background: #fff; gap: 11px; }

/* Ejemplo de la guia vacia */
.sp-ej-dias { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 12px; }
.sp-ej-dia { width: 16px; height: 16px; border-radius: 50%; background: var(--pink-soft); animation: ad-entra .4s ease both; }
.sp-ej-dia.es-hecho { background: var(--pink); }
.sp-ej-dia.es-hoy { background: var(--pink); box-shadow: 0 0 0 3px #fff, 0 0 0 5px var(--pink-line); }
.sp-ej-hoy { display: flex; align-items: center; gap: 8px; margin-top: 12px; font-size: 13px; font-weight: 600; color: var(--muted); }
.sp-ej-hoy span { font-size: 12px; font-weight: 800; color: #fff; background: var(--pink); padding: 3px 10px; border-radius: 99px; }
.ad-guia-flota .sp-portada { border-radius: 20px; margin: 10px 10px 0; }
@media (max-width: 640px) {
  .sp-subir { padding: 20px; border-radius: 26px; }
  .sp-subir-btn { width: 100%; justify-content: center; }
}
@media (prefers-reduced-motion: reduce) { .sp-barra span, .sp-ej-dia, .sp-grilla > li, .sp-candado svg { animation: none !important; } }
`;
