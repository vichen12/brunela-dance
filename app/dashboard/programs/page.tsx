import Link from "next/link";
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

  return (
    <main className="pb-20 pt-6 md:pb-28 md:pt-10">
      <section className="page-shell space-y-6">

        <header className="hero-stage">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <span className="studio-chip">Planes de trabajo</span>
              <h1 className="display mt-8 text-5xl leading-none md:text-7xl">
                Entrená con{" "}
                <span style={{ color: "var(--pink)", fontStyle: "italic" }}>un orden.</span>
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-8 text-[color:var(--ink-soft)] md:text-lg">
                Un plan de trabajo es una serie de días pensados en orden — «Trabajo de pies, 14 días».
                En vez de elegir una clase suelta cada vez, ya sabés qué te toca hoy. Cada plan recuerda
                por dónde vas.
              </p>
            </div>

            <div className="soft-stat min-w-[16rem] p-5">
              <p className="eyebrow">{hayBloqueados ? "Disponibles para vos" : "Activos"}</p>
              <p className="display mt-4 text-4xl leading-none">
                {mios}
                {hayBloqueados && (
                  <span className="text-2xl text-[color:var(--ink-soft)]"> / {programs.length}</span>
                )}
              </p>
              <p className="mt-4 text-sm leading-7 text-[color:var(--ink-soft)]">
                {hayBloqueados
                  ? "Los demás se abren al subir de plan."
                  : "Listos para continuar desde tu inicio."}
              </p>
            </div>
          </div>
        </header>

        {/* El aviso va ARRIBA de la rejilla y no dentro de cada tarjeta: repetido
            doce veces se vuelve ruido, y una sola vez explica los doce candados. */}
        {hayBloqueados && mios === 0 && (
          <Link
            href="/dashboard/plan"
            className="panel block rounded-[2.4rem] p-7 md:p-9"
            style={{ textDecoration: "none", border: "1px solid var(--pink-line)" }}
          >
            <p className="eyebrow">Los planes de trabajo son de Solista</p>
            <h2 className="display mt-4 text-4xl">Esto es lo que suma Solista</h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-[color:var(--ink-soft)]">
              Con Corps de Ballet tenés todas las clases y elegís cuál hacer. Con Solista, Brunela te
              arma el recorrido: qué clase cada día, en qué orden y con qué objetivo.
            </p>
            <span className="button-primary mt-6 inline-flex">Ver planes</span>
          </Link>
        )}

        <section className="panel rounded-[2.4rem] p-7 md:p-9">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="eyebrow">Secuencias</p>
              <h2 className="display mt-4 text-4xl">Entrená sin perder el hilo</h2>
            </div>
            <span className="studio-chip">Día a día</span>
          </div>

          <div className="mt-10 grid gap-4 lg:grid-cols-2">
            {programs.length === 0 ? (
              <div className="rounded-[2rem] border border-dashed border-[rgba(118,92,113,0.14)] bg-[rgba(255,255,255,0.52)] p-6 text-sm leading-7 text-[color:var(--ink-soft)]">
                Todavía no hay planes de trabajo publicados.
              </div>
            ) : null}

            {programs.map((program) => {
              const cerrado = bloqueado(program.id);
              const progress = progressByProgram.get(program.id);
              const totalDays = daysByProgram.get(program.id) ?? 0;
              const completedDays = progress?.completedDays ?? 0;
              const progressPercent =
                totalDays > 0 ? Math.round((completedDays / totalDays) * 100) : progress?.maxPercent ?? 0;

              return (
                <Link
                  key={program.id}
                  className="feature-tile flex h-full flex-col gap-5 rounded-[2rem] border border-[rgba(var(--border-rgb),0.42)] bg-[rgba(255,255,255,0.88)] p-5"
                  href={cerrado ? "/dashboard/plan" : `/dashboard/programs/${program.slug}`}
                  style={{ position: "relative" }}
                >
                  <div
                    className="relative min-h-[12rem] overflow-hidden rounded-[1.7rem] border border-[rgba(var(--border-rgb),0.3)] bg-cover bg-center"
                    style={{
                      backgroundColor: "rgba(238, 225, 228, 0.85)",
                      backgroundImage: program.cover_image_url ? `url(${program.cover_image_url})` : undefined,
                      // Apagada, no escondida: se tiene que ver que hay algo bueno ahi.
                      filter: cerrado ? "grayscale(0.55)" : undefined,
                      opacity: cerrado ? 0.72 : 1
                    }}
                  >
                    {program.is_featured && !cerrado && (
                      <span style={{
                        position: "absolute", top: 14, left: 14,
                        display: "inline-flex", alignItems: "center", gap: 6,
                        background: "#fff", color: "var(--pink)",
                        fontSize: 10, fontWeight: 700, letterSpacing: "0.1em",
                        padding: "6px 12px", borderRadius: 99, textTransform: "uppercase",
                      }}>
                        <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor">
                          <path d="M8 1.6l1.9 4 4.4.6-3.2 3.1.8 4.4L8 11.6l-3.9 2.1.8-4.4L1.7 6.2l4.4-.6L8 1.6z" />
                        </svg>
                        Destacado
                      </span>
                    )}

                    {cerrado && (
                      <span style={{
                        position: "absolute", top: 14, right: 14,
                        display: "inline-flex", alignItems: "center", gap: 6,
                        background: "rgba(255,255,255,0.94)", color: "var(--pink-deep)",
                        border: "1px solid var(--pink-line)",
                        fontSize: 10, fontWeight: 800, letterSpacing: "0.08em",
                        padding: "6px 12px", borderRadius: 99, textTransform: "uppercase",
                        boxShadow: "0 4px 14px rgba(28,25,23,0.12)",
                      }}>
                        <svg width="11" height="11" viewBox="0 0 16 16" fill="none" aria-hidden>
                          <path d="M4.5 7V5a3.5 3.5 0 1 1 7 0v2M3.5 7h9v6h-9V7Z"
                            stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
                        </svg>
                        Desde {membershipTierLabel(program.membership_tier_required)}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {/* El mismo valor dos veces: aca no hay un rango, hay UN nivel
                        -- el mas alto entre las clases del plan. Con `null` de
                        maximo, rangoANivel lo leeria como un rango abierto y
                        diria "Todos los niveles". */}
                    {nivelPorPrograma.get(program.id) && (
                      <span className="studio-chip">
                        {nivelEnTexto(
                          nivelPorPrograma.get(program.id)!,
                          nivelPorPrograma.get(program.id)!
                        )}
                      </span>
                    )}
                    <span className="studio-chip">{totalDays || program.duration_days} días</span>
                    {focoDe(program.id) && <span className="studio-chip">{focoDe(program.id)}</span>}
                  </div>

                  <div>
                    <h3 className="display text-3xl">{resolveI18nText(program.title_i18n)}</h3>
                    <p className="mt-3 text-sm leading-7 text-[color:var(--ink-soft)]">
                      {resolveI18nText(program.description_i18n) ||
                        "Un recorrido de varios días, en orden."}
                    </p>
                  </div>

                  <div className="mt-auto">
                    {cerrado ? (
                      <span
                        className="text-xs font-bold uppercase tracking-[0.08em]"
                        style={{ color: "var(--pink-deep)" }}
                      >
                        Disponible desde {membershipTierLabel(program.membership_tier_required)} →
                      </span>
                    ) : (
                      <>
                        <div className="mb-2 flex items-center justify-between text-xs font-bold uppercase tracking-[0.08em] text-[color:var(--ink-soft)]">
                          <span>
                            {completedDays}/{Math.max(totalDays, 0)} días completos
                          </span>
                          <span>{safePercent(progressPercent)}%</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full" style={{ background: "var(--pink-wash)" }}>
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${safePercent(progressPercent)}%`, background: "var(--pink)" }}
                          />
                        </div>
                      </>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      </section>
    </main>
  );
}
