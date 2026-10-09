import Link from "next/link";
import { ArrowRight, CalendarDays, Check, ListChecks, Lock, Sparkles, Star } from "lucide-react";
import { AdminBoton, AdminCabecera, AdminCifras, AdminGuia } from "@/components/admin-ui";
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

export default async function DashboardProgramsPage() {
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

      // La lista visible. Para una alumna, solo publicados; una admin ve
      // tambien los borradores, que es como ya funcionaba.
      (() => {
        const c = admin.from("programs").select(COLUMNAS);
        return (isAdmin ? c : c.eq("status", "published"))
          .order("is_featured", { ascending: false })
          .order("published_at", { ascending: false });
      })(),

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

  const accesibles = new Set((accesiblesData ?? []).map((p: { id: string }) => p.id));
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
          <ul className="sp-grilla">
            {programs.map((program) => {
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
        )}
      </section>
    </main>
  );
}

const CSS = `
.sp { padding-bottom: 80px; }
.sp-shell { max-width: 1320px; margin: 0 auto; padding: clamp(20px, 3vw, 40px) clamp(16px, 3.4vw, 48px) 0; display: flex; flex-direction: column; gap: 18px; }
.sp .ad-mast { padding-bottom: 4px; }

.sp-subir {
  display: flex; align-items: center; gap: 20px; flex-wrap: wrap; padding: 22px 24px; border-radius: 24px; text-decoration: none;
  background: radial-gradient(120% 160% at 0% 0%, var(--pink-wash) 0%, #fff 60%); border: 1.5px solid var(--pink-line);
  transition: border-color .2s, transform .3s cubic-bezier(.16,1,.3,1), box-shadow .3s;
}
.sp-subir:hover { border-color: var(--pink); transform: translateY(-2px); box-shadow: 0 22px 40px -26px rgba(176,58,62,0.55); }
.sp-subir-ico { width: 52px; height: 52px; border-radius: 16px; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; background: var(--pink); color: #fff; }
.sp-subir-txt { flex: 1; min-width: 240px; display: flex; flex-direction: column; gap: 3px; }
.sp-subir-eyebrow { font-size: 11px; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; color: var(--pink-deep); }
.sp-subir-titulo { font-family: var(--font-display), sans-serif; font-weight: 800; font-size: 22px; letter-spacing: -0.03em; color: var(--ink); }
.sp-subir-sub { font-size: 14px; line-height: 1.6; color: #6E5550; max-width: 70ch; }
.sp-subir-btn { display: inline-flex; align-items: center; gap: 8px; height: 46px; padding: 0 22px; border-radius: 99px; background: var(--pink); color: #fff; font-weight: 700; font-size: 14px; box-shadow: 0 10px 22px -10px rgba(230,79,85,0.8); }

.sp-grilla { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 20px; }
.sp-card {
  display: flex; flex-direction: column; height: 100%; border: 1px solid #F0DED6; border-radius: 22px; background: #fff; overflow: hidden;
  text-decoration: none; color: inherit; transition: transform .35s cubic-bezier(.16,1,.3,1), box-shadow .35s, border-color .25s;
}
.sp-card:hover { transform: translateY(-4px); border-color: var(--pink-line); box-shadow: 0 24px 44px -26px rgba(176,58,62,0.55); }
.sp-portada { position: relative; aspect-ratio: 16 / 8; overflow: hidden; background: linear-gradient(135deg, var(--pink-wash) 0%, var(--pink-soft) 55%, var(--rose) 130%); }
.sp-portada img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; transition: transform .9s cubic-bezier(.16,1,.3,1); }
.sp-card:hover .sp-portada img { transform: scale(1.06); }
.sp-card.es-cerrado .sp-portada { filter: grayscale(0.55); opacity: 0.8; }
.sp-dias {
  position: absolute; left: 14px; bottom: 12px; display: inline-flex; align-items: baseline; gap: 5px; padding: 4px 12px; border-radius: 99px;
  background: rgba(255,255,255,0.92); font-size: 12.5px; font-weight: 700; color: var(--pink-deep);
}
.sp-dias strong { font-family: var(--font-display), sans-serif; font-weight: 800; font-size: 17px; letter-spacing: -0.03em; color: var(--ink); }
.sp-dest, .sp-candado {
  position: absolute; top: 12px; display: inline-flex; align-items: center; gap: 5px; padding: 5px 11px; border-radius: 99px;
  font-size: 10.5px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; background: #fff;
}
.sp-dest { left: 12px; color: #c2410c; }
.sp-candado { right: 12px; color: var(--pink-deep); border: 1px solid var(--pink-line); }
.sp-cuerpo { display: flex; flex-direction: column; flex: 1; padding: 18px 20px 20px; }
.sp-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px; }
.sp-chip { padding: 3px 10px; border-radius: 99px; font-size: 11.5px; font-weight: 700; color: #6E5550; background: #FBF0EB; }
.sp-titulo { font-family: var(--font-display), sans-serif; font-weight: 800; font-size: 22px; line-height: 1.15; letter-spacing: -0.03em; color: var(--ink); }
.sp-card:hover .sp-titulo { color: var(--pink-deep); }
.sp-desc { margin-top: 6px; font-size: 14px; line-height: 1.6; color: #6E5550; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.sp-pie { margin-top: auto; padding-top: 18px; display: flex; flex-direction: column; gap: 8px; }
.sp-progreso { display: flex; align-items: center; justify-content: space-between; font-size: 13px; color: #8A6F68; }
.sp-progreso-txt { display: inline-flex; align-items: center; gap: 5px; }
.sp-progreso-txt strong { color: var(--ink); }
.sp-progreso-pct { font-family: var(--font-display), sans-serif; font-weight: 800; color: var(--ink); }
.sp-barra { display: block; height: 6px; border-radius: 99px; background: var(--pink-wash); overflow: hidden; }
.sp-barra span { display: block; height: 100%; border-radius: 99px; background: var(--pink); animation: sp-llena 1.2s cubic-bezier(.16,1,.3,1) both .2s; transform-origin: left; }
@keyframes sp-llena { from { transform: scaleX(0); } to { transform: none; } }
.sp-seguir, .sp-ver-plan { display: inline-flex; align-items: center; gap: 6px; margin-top: 4px; font-size: 13.5px; font-weight: 800; color: var(--pink-deep); transition: gap .2s; }
.sp-card:hover .sp-seguir, .sp-card:hover .sp-ver-plan { gap: 10px; }
.sp-ej-dias { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 12px; }
.sp-ej-dia { width: 16px; height: 16px; border-radius: 4px; background: var(--pink-soft); animation: ad-entra .4s ease both; }
.sp-ej-dia.es-hecho { background: var(--pink); }
.sp-ej-dia.es-hoy { background: var(--pink); box-shadow: 0 0 0 3px var(--pink-wash), 0 0 0 4.5px var(--pink); }
.sp-ej-hoy { display: flex; align-items: center; gap: 8px; margin-top: 12px; font-size: 13px; font-weight: 600; color: #6E5550; }
.sp-ej-hoy span { font-size: 10px; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; color: #fff; background: var(--pink); padding: 3px 8px; border-radius: 99px; }
@media (prefers-reduced-motion: reduce) { .sp-barra span, .sp-ej-dia { animation: none; } }
`;
