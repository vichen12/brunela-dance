import Link from "next/link";
import { notFound } from "next/navigation";
import {
  formatDurationLabel,
  membershipTierLabel,
  resolveI18nText,
  type MembershipTier
} from "@/src/features/studio/helpers";
import { requireUser } from "@/src/features/auth/guards";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";
import { createSupabaseAdminClient } from "@/src/lib/supabase/admin";

/**
 * Un plan de trabajo, dia por dia.
 *
 * QUE TIENE QUE CONTESTAR ESTA PANTALLA, EN ESTE ORDEN
 *   1. ¿Que me toca HOY?           -> la tarjeta grande de arriba
 *   2. ¿Por donde voy?             -> "Día 3 de 14" y la barra
 *   3. ¿Cuanto me falta?           -> "faltan 11 días"
 *   4. ¿Que viene despues?         -> la lista, con el dia de hoy marcado
 *
 *   Antes contestaba solo la cuarta, y mal: los catorce dias se veian todos
 *   iguales -- el que ya hizo, el de hoy y los que faltan -- con un porcentaje
 *   chiquito a la derecha como unica diferencia. Entrabas y no sabias por donde
 *   ibas.
 *
 * LOS DIAS QUE FALTAN SE VEN, APAGADOS
 *   Decidido el 2026-09-21. Se pueden abrir: si alguien se va de viaje y quiere
 *   adelantar dos dias, puede. Bloquearlos forzaria el orden, pero castiga
 *   justo a la que mas engancha.
 */

type Params = Promise<{ slug: string }>;

type ProgramRecord = {
  id: string;
  slug: string;
  title_i18n: Record<string, string>;
  description_i18n: Record<string, string>;
  membership_tier_required: MembershipTier;
  duration_days: number;
  cover_image_url: string | null;
};

type ClaseDelDia = {
  slug: string;
  title_i18n: Record<string, string>;
  duration_seconds: number;
};

type ProgramDayRecord = {
  day_number: number;
  video_id: string;
  // PostgREST tipa el embed como arreglo aunque la relacion sea a-uno.
  videos: ClaseDelDia | ClaseDelDia[] | null;
};

type ProgressRecord = {
  video_id: string;
  program_day_number: number | null;
  is_completed: boolean;
  completion_percent: number;
};

const claseDe = (videos: ProgramDayRecord["videos"]): ClaseDelDia | null =>
  !videos ? null : Array.isArray(videos) ? videos[0] ?? null : videos;

export default async function DashboardProgramDetailPage({ params }: { params: Params }) {
  const { user } = await requireUser();
  const supabase = await createSupabaseServerClient();
  const { slug } = await params;

  const { data: program } = await supabase
    .from("programs")
    .select("id, slug, title_i18n, description_i18n, membership_tier_required, duration_days, cover_image_url")
    .eq("slug", slug)
    .maybeSingle<ProgramRecord>();

  /**
   * No lo ve: puede ser que no exista, o que exista y sea de otro plan.
   *
   * Antes las dos cosas eran un 404. Para quien guardo el enlace de un plan que
   * todavia no tiene, eso es un callejon sin salida donde deberia haber una
   * pagina que le explique que le falta. La diferencia se resuelve con
   * service_role, y solo en este camino.
   */
  if (!program) {
    return <PlanBloqueado slug={slug} />;
  }

  const [{ data: daysData }, { data: progressData }] = await Promise.all([
    supabase
      .from("program_days")
      .select("day_number, video_id, videos(slug, title_i18n, duration_seconds)")
      .eq("program_id", program.id)
      .order("day_number", { ascending: true }),
    supabase
      .from("user_progress")
      .select("video_id, program_day_number, is_completed, completion_percent")
      .eq("user_id", user.id)
      .eq("program_id", program.id)
  ]);

  const days = (daysData ?? []) as ProgramDayRecord[];
  const progressMap = new Map<number, ProgressRecord>();
  for (const item of (progressData ?? []) as ProgressRecord[]) {
    if (item.program_day_number) progressMap.set(item.program_day_number, item);
  }

  /**
   * El total son los dias CARGADOS, no `duration_days`.
   *
   * `duration_days` es lo que el plan promete; los dias cargados son lo que se
   * puede hacer. Un plan que dice 14 y tiene 3 mostraba "0/3 días" al lado de un
   * chip que decia "14 días", y las dos cifras eran ciertas y se contradecian.
   * Para la alumna manda lo que existe.
   */
  const total = days.length;
  const completos = days.filter((d) => progressMap.get(d.day_number)?.is_completed).length;
  const porcentaje = total > 0 ? Math.round((completos / total) * 100) : 0;
  const faltan = Math.max(0, total - completos);

  /** El primero sin terminar. Es "lo que te toca hoy". */
  const hoy = days.find((d) => !progressMap.get(d.day_number)?.is_completed) ?? null;
  const claseDeHoy = hoy ? claseDe(hoy.videos) : null;
  const terminado = total > 0 && completos === total;

  const titulo = resolveI18nText(program.title_i18n);

  return (
    <main className="pb-20 pt-6 md:pb-28 md:pt-10">
      <section className="page-shell space-y-6">

        <Link className="button-secondary" href="/dashboard/programs">
          Volver a planes de trabajo
        </Link>

        <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <article className="hero-stage">
            <div
              className="min-h-[18rem] rounded-[2rem] border border-[rgba(var(--border-rgb),0.32)] bg-cover bg-center"
              style={{
                backgroundColor: "rgba(238, 225, 228, 0.85)",
                backgroundImage: program.cover_image_url ? `url(${program.cover_image_url})` : undefined
              }}
            />

            <div className="mt-8 flex flex-wrap gap-2">
              <span className="studio-chip">{membershipTierLabel(program.membership_tier_required)}</span>
              <span className="studio-chip">{total} días</span>
            </div>

            <h1 className="display mt-6 text-5xl leading-none md:text-7xl">{titulo}</h1>
            <p className="mt-6 max-w-3xl text-base leading-8 text-[color:var(--ink-soft)] md:text-lg">
              {resolveI18nText(program.description_i18n) || "Un recorrido de varios días, en orden."}
            </p>

            {/* Por donde va — arriba de todo, no al final */}
            {total > 0 && (
              <div className="mt-8">
                <div className="mb-3 flex items-baseline justify-between gap-4">
                  <span className="text-sm font-bold" style={{ color: "var(--ink)" }}>
                    {terminado
                      ? "Completaste el plan"
                      : `Día ${Math.min(completos + 1, total)} de ${total}`}
                  </span>
                  <span className="text-xs font-bold uppercase tracking-[0.08em] text-[color:var(--ink-soft)]">
                    {terminado ? "100%" : `Faltan ${faltan} ${faltan === 1 ? "día" : "días"}`}
                  </span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full" style={{ background: "var(--pink-wash)" }}>
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${porcentaje}%`, background: "var(--pink)" }}
                  />
                </div>
              </div>
            )}
          </article>

          <aside className="space-y-6">
            <article className="panel rounded-[2.4rem] p-7 md:p-9">
              {claseDeHoy && hoy ? (
                <>
                  <p className="eyebrow">{completos === 0 ? "Empezá por acá" : "Seguí por acá"}</p>
                  <h2 className="display mt-4 text-4xl">Día {hoy.day_number}</h2>
                  <p className="mt-4 text-lg font-semibold leading-8" style={{ color: "var(--ink)" }}>
                    {resolveI18nText(claseDeHoy.title_i18n)}
                  </p>
                  <p className="mt-2 text-sm leading-7 text-[color:var(--ink-soft)]">
                    {formatDurationLabel(claseDeHoy.duration_seconds)}
                  </p>
                  <Link
                    className="button-primary mt-6"
                    href={`/dashboard/library/${claseDeHoy.slug}?programId=${program.id}&day=${hoy.day_number}`}
                  >
                    {completos === 0 ? "Empezar" : "Continuar"}
                  </Link>
                </>
              ) : terminado ? (
                <>
                  <p className="eyebrow">Terminado</p>
                  <h2 className="display mt-4 text-4xl">Hiciste los {total} días</h2>
                  <p className="mt-4 text-sm leading-7 text-[color:var(--ink-soft)]">
                    Podés repetir cualquier día desde la lista de abajo.
                  </p>
                </>
              ) : (
                <>
                  <p className="eyebrow">En preparación</p>
                  <h2 className="display mt-4 text-4xl">Todavía sin días</h2>
                  <p className="mt-4 text-sm leading-7 text-[color:var(--ink-soft)]">
                    Brunela está armando este plan. Mientras tanto podés entrenar con las clases sueltas.
                  </p>
                  <Link className="button-secondary mt-6 inline-flex" href="/dashboard/library">
                    Ir a las clases
                  </Link>
                </>
              )}
            </article>
          </aside>
        </section>

        <section className="panel rounded-[2.4rem] p-7 md:p-9">
          <p className="eyebrow">El recorrido</p>
          <h2 className="display mt-4 text-4xl">Día por día</h2>

          <div className="mt-8 grid gap-3">
            {days.length === 0 ? (
              <div className="rounded-[2rem] border border-dashed border-[rgba(118,92,113,0.14)] bg-[rgba(255,255,255,0.52)] p-6 text-sm leading-7 text-[color:var(--ink-soft)]">
                Este plan todavía no tiene días armados.
              </div>
            ) : null}

            {days.map((day) => {
              const clase = claseDe(day.videos);
              if (!clase) return null;

              const progreso = progressMap.get(day.day_number);
              const completado = progreso?.is_completed ?? false;
              const esHoy = hoy?.day_number === day.day_number;
              const porciento = Math.max(0, Math.min(100, Number(progreso?.completion_percent ?? 0)));
              // Empezado pero sin terminar: el numero dice algo. En un dia sin
              // tocar, "0%" es ruido.
              const empezado = !completado && porciento > 0;

              return (
                <Link
                  key={`${day.day_number}-${day.video_id}`}
                  className="feature-tile block"
                  href={`/dashboard/library/${clase.slug}?programId=${program.id}&day=${day.day_number}`}
                  style={{
                    // Tres estados, tres pesos visuales. El de hoy tiene el
                    // borde de la marca; el futuro se apaga pero se abre igual.
                    border: esHoy ? "1.5px solid var(--pink)" : undefined,
                    background: esHoy ? "var(--pink-wash)" : undefined,
                    opacity: !esHoy && !completado && !empezado ? 0.62 : 1
                  }}
                >
                  <div className="flex items-center gap-4">
                    {/* La marca de estado, en una columna fija: asi los titulos
                        arrancan todos a la misma altura y la lista se recorre
                        con la vista. */}
                    <span
                      aria-hidden
                      style={{
                        width: 30, height: 30, borderRadius: "50%", flexShrink: 0,
                        display: "inline-flex", alignItems: "center", justifyContent: "center",
                        fontSize: 11, fontWeight: 800,
                        background: completado ? "var(--pink)" : esHoy ? "#fff" : "var(--pink-wash)",
                        color: completado ? "#fff" : esHoy ? "var(--pink)" : "var(--ink-soft)",
                        border: esHoy ? "1.5px solid var(--pink)" : "1px solid transparent"
                      }}
                    >
                      {completado ? (
                        <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                          <path d="M2.5 7.2l3 3L11.5 4" stroke="currentColor" strokeWidth="2"
                            strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      ) : (
                        day.day_number
                      )}
                    </span>

                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold uppercase tracking-[0.08em]"
                        style={{ color: esHoy ? "var(--pink-deep)" : "var(--ink-soft)" }}>
                        Día {day.day_number}
                        {esHoy && " · Te toca ahora"}
                        {completado && " · Completado"}
                        {empezado && ` · Empezado (${porciento}%)`}
                      </p>
                      <h3 className="mt-1.5 truncate text-lg font-semibold" style={{ color: "var(--ink)" }}>
                        {resolveI18nText(clase.title_i18n)}
                      </h3>
                    </div>

                    <span className="studio-chip flex-shrink-0">
                      {formatDurationLabel(clase.duration_seconds)}
                    </span>
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

/**
 * El plan existe pero no es de su plan de membresia.
 *
 * ⚠️ Lee con service_role, asi que la lista de columnas es CORTA Y EXPLICITA:
 *    lo justo para nombrar el plan y decir que hace falta. Nada de
 *    `program_days`: que clase va cada dia es lo que se paga.
 *
 *    Si el slug no existe, 404 de verdad -- no hay que inventar una pagina de
 *    venta para algo que no esta.
 */
async function PlanBloqueado({ slug }: { slug: string }) {
  const admin = createSupabaseAdminClient();

  const { data: plan } = await admin
    .from("programs")
    .select("title_i18n, description_i18n, membership_tier_required, duration_days, cover_image_url")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle<{
      title_i18n: Record<string, string>;
      description_i18n: Record<string, string>;
      membership_tier_required: MembershipTier;
      duration_days: number;
      cover_image_url: string | null;
    }>();

  if (!plan) notFound();

  const tier = membershipTierLabel(plan.membership_tier_required);

  return (
    <main className="pb-20 pt-6 md:pb-28 md:pt-10">
      <section className="page-shell space-y-6">
        <Link className="button-secondary" href="/dashboard/programs">
          Volver a planes de trabajo
        </Link>

        <section className="hero-stage">
          <div
            className="min-h-[14rem] rounded-[2rem] border border-[rgba(var(--border-rgb),0.32)] bg-cover bg-center"
            style={{
              backgroundColor: "rgba(238, 225, 228, 0.85)",
              backgroundImage: plan.cover_image_url ? `url(${plan.cover_image_url})` : undefined,
              filter: "grayscale(0.55)",
              opacity: 0.72
            }}
          />

          <div className="mt-8 flex flex-wrap gap-2">
            <span className="studio-chip" style={{ color: "var(--pink-deep)" }}>
              Desde {tier}
            </span>
            <span className="studio-chip">{plan.duration_days} días</span>
          </div>

          <h1 className="display mt-6 text-5xl leading-none md:text-7xl">
            {resolveI18nText(plan.title_i18n)}
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-8 text-[color:var(--ink-soft)] md:text-lg">
            {resolveI18nText(plan.description_i18n) || "Un recorrido de varios días, en orden."}
          </p>

          <div className="mt-8 rounded-[2rem] border p-6 md:p-7"
            style={{ borderColor: "var(--pink-line)", background: "rgba(255,255,255,0.72)" }}>
            <p className="eyebrow">Te falta {tier}</p>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-[color:var(--ink-soft)]">
              Este plan de trabajo está armado día por día: qué clase hacer, en qué orden y con qué
              objetivo. Se abre con {tier}, junto con todos los demás planes.
            </p>
            <Link className="button-primary mt-6 inline-flex" href="/dashboard/plan">
              Ver planes
            </Link>
          </div>
        </section>
      </section>
    </main>
  );
}
