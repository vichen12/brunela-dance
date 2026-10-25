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
import { portadaDeClase } from "@/src/lib/video/portada";
import { NOTA_DESCANSO_POR_DEFECTO, avanceDelPlan, esFaltaDeColumnaDescanso } from "@/src/features/studio/dias-de-plan";
import { ArrowLeft, ArrowRight, CalendarDays, Check, Clock, ListChecks, Lock, Moon, Play, Sparkles } from "lucide-react";

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
 *
 * DIAS DE DESCANSO (2026-10-25)
 *   Un dia puede ser descanso en vez de clase: se ve en su lugar de la lista
 *   ("Día 4 · Descanso"), con una tarjeta tranquila y sin enlace a ninguna
 *   clase. Cuenta en el total. Como no tiene video no deja progreso: se da por
 *   hecho cuando ella ya avanzo a un dia posterior, o termino todas las clases
 *   (regla en src/features/studio/dias-de-plan.ts, probada en
 *   tests/sistema/dias-de-plan.test.ts).
 *
 *   Un numero de dia sin nada cargado NO se inventa como descanso: no aparece.
 *   El hueco se lo marca el panel a Brunela.
 *
 * LAS FOTOS
 *   Cada dia muestra la portada de su clase (portadaDeClase: la foto subida o
 *   el cuadro de Bunny firmado). Solo se llega aca si RLS devolvio el plan, o
 *   sea si lo tiene: la pagina de venta (PlanBloqueado) no consulta ningun dia.
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
  thumbnail_url: string | null;
  bunny_video_id: string | null;
  stream_playback_id: string | null;
};

type ProgramDayRecord = {
  day_number: number;
  /** null en un dia de descanso. */
  video_id: string | null;
  es_descanso?: boolean;
  nota?: string | null;
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

  const [days, { data: progressData }] = await Promise.all([
    diasDelPlan(supabase, program.id),
    supabase
      .from("user_progress")
      .select("video_id, program_day_number, is_completed, completion_percent")
      .eq("user_id", user.id)
      .eq("program_id", program.id)
  ]);

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
  const avance = avanceDelPlan(days, progressMap);
  const { total, completos, terminado } = avance;
  const porcentaje = total > 0 ? Math.round((completos / total) * 100) : 0;
  const faltan = Math.max(0, total - completos);

  /** El primero sin hacer. Es "lo que te toca hoy": una clase o un descanso. */
  const hoy = avance.hoy;
  const claseDeHoy = hoy && !hoy.es_descanso ? claseDe(hoy.videos) : null;
  const fotoDeHoy = claseDeHoy ? portadaDeClase(claseDeHoy) : null;
  const descansoDeHoy = hoy?.es_descanso ? hoy : null;
  const despuesDelDescanso = descansoDeHoy ? avance.siguienteClase : null;
  const claseDespues = despuesDelDescanso ? claseDe(despuesDelDescanso.videos) : null;

  const titulo = resolveI18nText(program.title_i18n);

  return (
    <main className="pd">
      <style>{CSS}</style>
      <section className="pd-shell">

        <Link className="pd-volver" href="/dashboard/programs">
          <ArrowLeft size={16} strokeWidth={2.2} aria-hidden="true" /> Volver a planes de trabajo
        </Link>

        <section className="pd-arriba">
          <article className="pd-hero">
            <div
              className="pd-portada"
              style={{ backgroundImage: program.cover_image_url ? `url(${program.cover_image_url})` : undefined }}
            />

            <div className="pd-hero-txt">
              <div className="pd-chips">
                <span className="pd-chip pd-chip--plan">{membershipTierLabel(program.membership_tier_required)}</span>
                <span className="pd-chip"><CalendarDays size={14} strokeWidth={2.2} aria-hidden="true" /> {total} días</span>
              </div>

              <h1 className="pd-titulo">{titulo}</h1>
              <p className="pd-desc">
                {resolveI18nText(program.description_i18n) || "Un recorrido de varios días, en orden."}
              </p>

              {/* Por donde va — arriba de todo, no al final */}
              {total > 0 && (
                <div className="pd-avance">
                  <div className="pd-avance-fila">
                    <span className="pd-avance-dia">
                      {terminado
                        ? "Completaste el plan"
                        : `Día ${Math.min(completos + 1, total)} de ${total}`}
                    </span>
                    <span className="pd-avance-falta">
                      {terminado ? "100%" : `Faltan ${faltan} ${faltan === 1 ? "día" : "días"}`}
                    </span>
                  </div>
                  <div className="pd-barra">
                    <div style={{ width: `${porcentaje}%` }} />
                  </div>
                </div>
              )}
            </div>
          </article>

          <aside className={"pd-hoy" + (descansoDeHoy ? " pd-hoy--descanso" : "")}>
            {descansoDeHoy ? (
              <>
                <span className="pd-hoy-eyebrow pd-hoy-eyebrow--calma">
                  <Moon size={14} strokeWidth={2.2} aria-hidden="true" /> Hoy te toca
                </span>
                <div className="pd-hoy-dia">
                  <span className="pd-hoy-rot">Día</span>
                  <span className="pd-hoy-num pd-hoy-num--calma">{descansoDeHoy.day_number}</span>
                </div>
                <h2 className="pd-hoy-titulo">Día de descanso</h2>
                <p className="pd-hoy-txt">{descansoDeHoy.nota?.trim() || NOTA_DESCANSO_POR_DEFECTO}</p>
                {despuesDelDescanso && claseDespues && (
                  <Link
                    className="pd-boton pd-boton--suave"
                    href={`/dashboard/library/${claseDespues.slug}?programId=${program.id}&day=${despuesDelDescanso.day_number}`}
                  >
                    Seguir con el día {despuesDelDescanso.day_number} <ArrowRight size={16} strokeWidth={2.2} aria-hidden="true" />
                  </Link>
                )}
              </>
            ) : claseDeHoy && hoy ? (
              <>
                {fotoDeHoy && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="pd-hoy-foto" src={fotoDeHoy} alt="" />
                )}
                <span className="pd-hoy-eyebrow">
                  <Sparkles size={14} strokeWidth={2.2} aria-hidden="true" />
                  {completos === 0 ? "Empezá por acá" : "Seguí por acá"}
                </span>
                <div className="pd-hoy-dia">
                  <span className="pd-hoy-rot">Día</span>
                  <span className="pd-hoy-num">{hoy.day_number}</span>
                </div>
                <p className="pd-hoy-clase">{resolveI18nText(claseDeHoy.title_i18n)}</p>
                <p className="pd-hoy-dur">
                  <Clock size={14} strokeWidth={2.2} aria-hidden="true" /> {formatDurationLabel(claseDeHoy.duration_seconds)}
                </p>
                <Link
                  className="pd-boton"
                  href={`/dashboard/library/${claseDeHoy.slug}?programId=${program.id}&day=${hoy.day_number}`}
                >
                  <Play size={16} strokeWidth={2.4} fill="currentColor" aria-hidden="true" />
                  {completos === 0 ? "Empezar" : "Continuar"}
                </Link>
              </>
            ) : terminado ? (
              <>
                <span className="pd-hoy-eyebrow pd-hoy-eyebrow--ok">
                  <Check size={14} strokeWidth={2.8} aria-hidden="true" /> Terminado
                </span>
                <h2 className="pd-hoy-titulo">Hiciste los {total} días</h2>
                <p className="pd-hoy-txt">
                  Podés repetir cualquier día desde la lista de abajo.
                </p>
              </>
            ) : (
              <>
                <span className="pd-hoy-eyebrow">En preparación</span>
                <h2 className="pd-hoy-titulo">Todavía sin días</h2>
                <p className="pd-hoy-txt">
                  Brunela está armando este plan. Mientras tanto podés entrenar con las clases sueltas.
                </p>
                <Link className="pd-boton pd-boton--suave" href="/dashboard/library">
                  Ir a las clases <ArrowRight size={16} strokeWidth={2.2} aria-hidden="true" />
                </Link>
              </>
            )}
          </aside>
        </section>

        <section className="pd-recorrido">
          <div className="pd-recorrido-cabeza">
            <span className="pd-recorrido-ico"><ListChecks size={20} strokeWidth={2} aria-hidden="true" /></span>
            <div>
              <p className="pd-recorrido-eyebrow">El recorrido</p>
              <h2 className="pd-recorrido-titulo">Día por día</h2>
            </div>
          </div>

          <div className="pd-dias">
            {days.length === 0 ? (
              <div className="pd-vacio">
                <span className="pd-vacio-ico"><CalendarDays size={20} strokeWidth={2} aria-hidden="true" /></span>
                Este plan todavía no tiene días armados.
              </div>
            ) : null}

            {days.map((day) => {
              if (day.es_descanso) {
                const hecho = avance.hecho.get(day.day_number) ?? false;
                const esHoyDescanso = hoy?.day_number === day.day_number;
                // Un div y no un Link: un descanso no lleva a ninguna clase.
                return (
                  <div
                    key={`descanso-${day.day_number}`}
                    className={"pd-dia pd-dia--descanso" + (esHoyDescanso ? " es-hoy" : hecho ? " es-hecho" : " es-futuro")}
                  >
                    <span aria-hidden className="pd-dia-marca">
                      {hecho ? (
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                          <path d="M2.5 7.2l3 3L11.5 4" stroke="currentColor" strokeWidth="2.2"
                            strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      ) : (
                        day.day_number
                      )}
                    </span>
                    <span aria-hidden className="pd-dia-foto pd-dia-foto--descanso">
                      <Moon size={20} strokeWidth={1.9} />
                    </span>
                    <div className="pd-dia-txt">
                      <p className="pd-dia-rot">
                        Día {day.day_number} · Descanso
                        {esHoyDescanso && " · Te toca ahora"}
                      </p>
                      <h3 className="pd-dia-titulo">Día de descanso</h3>
                      <p className="pd-dia-nota">{day.nota?.trim() || NOTA_DESCANSO_POR_DEFECTO}</p>
                    </div>
                  </div>
                );
              }

              const clase = claseDe(day.videos);
              if (!clase) return null;
              const foto = portadaDeClase(clase);

              const progreso = progressMap.get(day.day_number);
              const completado = progreso?.is_completed ?? false;
              const esHoy = hoy?.day_number === day.day_number;
              const porciento = Math.max(0, Math.min(100, Number(progreso?.completion_percent ?? 0)));
              // Empezado pero sin terminar: el numero dice algo. En un dia sin
              // tocar, "0%" es ruido.
              const empezado = !completado && porciento > 0;

              // Tres estados, tres pesos visuales. El de hoy tiene el borde de
              // la marca; el futuro se apaga pero se abre igual.
              const estado = esHoy ? " es-hoy" : completado ? " es-hecho" : empezado ? " es-empezado" : " es-futuro";

              return (
                <Link
                  key={`${day.day_number}-${day.video_id}`}
                  className={"pd-dia" + estado}
                  href={`/dashboard/library/${clase.slug}?programId=${program.id}&day=${day.day_number}`}
                >
                  {/* La marca de estado, en una columna fija: asi los titulos
                      arrancan todos a la misma altura y la lista se recorre
                      con la vista. */}
                  <span aria-hidden className="pd-dia-marca">
                    {completado ? (
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <path d="M2.5 7.2l3 3L11.5 4" stroke="currentColor" strokeWidth="2.2"
                          strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    ) : (
                      day.day_number
                    )}
                  </span>

                  <span aria-hidden className="pd-dia-foto">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {foto && <img src={foto} alt="" loading="lazy" />}
                  </span>

                  <div className="pd-dia-txt">
                    <p className="pd-dia-rot">
                      Día {day.day_number}
                      {esHoy && " · Te toca ahora"}
                      {completado && " · Completado"}
                      {empezado && ` · Empezado (${porciento}%)`}
                    </p>
                    <h3 className="pd-dia-titulo">
                      {resolveI18nText(clase.title_i18n)}
                    </h3>
                  </div>

                  <span className="pd-dia-dur">
                    {formatDurationLabel(clase.duration_seconds)}
                  </span>
                  <span className="pd-dia-flecha" aria-hidden="true"><ArrowRight size={16} strokeWidth={2.2} /></span>
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
 * Los dias del plan, con el CLIENTE DE LA ALUMNA (RLS decide).
 *
 * Pide las columnas del descanso; sin la migracion 20261025_dia_de_descanso.sql
 * el select da 42703 y se repite como antes, sin ellas: la ficha no cambia.
 */
async function diasDelPlan(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  programId: string
): Promise<ProgramDayRecord[]> {
  const CLASE = "videos(slug, title_i18n, duration_seconds, thumbnail_url, bunny_video_id, stream_playback_id)";
  const nuevo = await supabase
    .from("program_days")
    .select(`day_number, video_id, es_descanso, nota, ${CLASE}`)
    .eq("program_id", programId)
    .order("day_number", { ascending: true });
  if (!nuevo.error) return (nuevo.data ?? []) as unknown as ProgramDayRecord[];
  if (!esFaltaDeColumnaDescanso(nuevo.error)) {
    console.error("[programs/slug] program_days:", nuevo.error.message);
    return [];
  }
  const viejo = await supabase
    .from("program_days")
    .select(`day_number, video_id, ${CLASE}`)
    .eq("program_id", programId)
    .order("day_number", { ascending: true });
  return (viejo.data ?? []) as unknown as ProgramDayRecord[];
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
    <main className="pd">
      <style>{CSS}</style>
      <section className="pd-shell">
        <Link className="pd-volver" href="/dashboard/programs">
          <ArrowLeft size={16} strokeWidth={2.2} aria-hidden="true" /> Volver a planes de trabajo
        </Link>

        <section className="pd-hero pd-hero--cerrado">
          <div
            className="pd-portada pd-portada--cerrada"
            style={{ backgroundImage: plan.cover_image_url ? `url(${plan.cover_image_url})` : undefined }}
          >
            <span className="pd-candado"><Lock size={22} strokeWidth={2} aria-hidden="true" /></span>
          </div>

          <div className="pd-hero-txt">
            <div className="pd-chips">
              <span className="pd-chip pd-chip--plan">
                <Lock size={13} strokeWidth={2.4} aria-hidden="true" /> Desde {tier}
              </span>
              <span className="pd-chip"><CalendarDays size={14} strokeWidth={2.2} aria-hidden="true" /> {plan.duration_days} días</span>
            </div>

            <h1 className="pd-titulo">
              {resolveI18nText(plan.title_i18n)}
            </h1>
            <p className="pd-desc">
              {resolveI18nText(plan.description_i18n) || "Un recorrido de varios días, en orden."}
            </p>

            <div className="pd-venta">
              <span className="pd-venta-ico"><Sparkles size={22} strokeWidth={1.9} aria-hidden="true" /></span>
              <div className="pd-venta-txt">
                <span className="pd-hoy-eyebrow">Te falta {tier}</span>
                <p>
                  Este plan de trabajo está armado día por día: qué clase hacer, en qué orden y con qué
                  objetivo. Se abre con {tier}, junto con todos los demás planes.
                </p>
              </div>
              <Link className="pd-boton" href="/dashboard/plan">
                Ver planes <ArrowRight size={16} strokeWidth={2.2} aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}

const CSS = `
.pd { padding-bottom: 80px; }
.pd-shell { max-width: 1320px; margin: 0 auto; padding: clamp(20px, 3vw, 40px) clamp(16px, 3.4vw, 48px) 0; display: flex; flex-direction: column; gap: 20px; }

.pd-volver {
  align-self: flex-start; display: inline-flex; align-items: center; gap: 8px; height: 42px; padding: 0 18px 0 14px; border-radius: 99px;
  background: #fff; border: 1.5px solid var(--linea-fuerte); color: var(--ink); font-size: 14px; font-weight: 800; text-decoration: none;
  transition: background .2s, border-color .2s, transform .3s var(--curva);
}
.pd-volver:hover { background: var(--rubor); border-color: var(--pink-line); transform: translateX(-2px); }

.pd-arriba { display: grid; gap: 20px; grid-template-columns: minmax(0, 1.25fr) minmax(0, 0.75fr); align-items: stretch; }

.pd-hero {
  position: relative; overflow: hidden; isolation: isolate; padding: 12px; border-radius: 32px;
  background: linear-gradient(120deg, #FFF1EC 0%, #FFF7F3 55%, #FFEFE6 100%); border: 1px solid var(--linea);
}
.pd-hero::after { content: ""; position: absolute; z-index: -1; width: 340px; height: 340px; right: -110px; bottom: -170px; border-radius: 50%; background: radial-gradient(circle, rgba(255,205,185,.7), transparent 68%); }
.pd-portada {
  position: relative; min-height: 15rem; border-radius: 24px; background-size: cover; background-position: center;
  background-color: #FFE9DE; background-image: linear-gradient(135deg, #FFE9DE 0%, #FFDADA 60%, #F7EBFA 130%);
}
.pd-portada--cerrada { min-height: 13rem; filter: saturate(.55) brightness(1.04); }
.pd-candado {
  position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); width: 64px; height: 64px; border-radius: 22px;
  display: grid; place-items: center; background: rgba(255,255,255,.94); color: var(--pink-deep); box-shadow: var(--sombra-alta);
}
.pd-hero-txt { padding: 22px clamp(12px, 2.4vw, 26px) clamp(14px, 2.4vw, 22px); }
.pd-chips { display: flex; flex-wrap: wrap; gap: 8px; }
.pd-chip { display: inline-flex; align-items: center; gap: 6px; padding: 6px 13px; border-radius: 99px; background: #fff; color: var(--ink); font-size: 13px; font-weight: 800; box-shadow: 0 6px 14px -10px rgba(176,70,70,.5); }
.pd-chip svg { color: var(--pink-deep); }
.pd-chip--plan { background: var(--pink); color: #fff; }
.pd-chip--plan svg { color: #fff; }
.pd-titulo { margin-top: 16px; font-weight: 900; font-size: clamp(34px, 4.6vw, 58px); line-height: 1.04; letter-spacing: -0.03em; color: var(--ink); }
.pd-desc { margin-top: 12px; max-width: 62ch; font-size: 15.5px; line-height: 1.7; color: var(--muted); }

.pd-avance { margin-top: 22px; padding: 16px 18px; border-radius: 22px; background: rgba(255,255,255,.8); border: 1px solid var(--linea); }
.pd-avance-fila { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 10px; }
.pd-avance-dia { font-size: 15px; font-weight: 900; color: var(--ink); }
.pd-avance-falta { padding: 3px 10px; border-radius: 99px; background: var(--rubor); font-size: 12.5px; font-weight: 800; color: var(--pink-deep); }
.pd-barra { height: 12px; border-radius: 99px; background: var(--rubor); overflow: hidden; }
.pd-barra > div { height: 100%; border-radius: 99px; background: linear-gradient(90deg, #F38A6C, var(--pink)); transform-origin: left; animation: pd-llena 1.2s var(--curva) both .2s; }
@keyframes pd-llena { from { transform: scaleX(0); } to { transform: none; } }

/* Lo de hoy: tarjeta blanca con el numero del dia en una burbuja grande. */
.pd-hoy {
  display: flex; flex-direction: column; align-items: flex-start; gap: 10px; padding: clamp(22px, 2.6vw, 32px);
  border-radius: 32px; background: #fff; border: 1px solid var(--linea); box-shadow: var(--sombra);
}
.pd-hoy-eyebrow { display: inline-flex; align-items: center; gap: 6px; padding: 5px 12px 5px 10px; border-radius: 99px; background: var(--rubor); color: var(--pink-deep); font-size: 12.5px; font-weight: 800; }
.pd-hoy-eyebrow--ok { background: var(--salvia); color: var(--salvia-deep); }
.pd-hoy-dia { display: flex; align-items: center; gap: 10px; margin-top: 8px; }
.pd-hoy-num {
  width: 84px; height: 84px; border-radius: 28px; display: grid; place-items: center;
  background: linear-gradient(160deg, #FFE9DE 0%, #FFDADA 100%); color: var(--ink); font-size: 44px; font-weight: 900; letter-spacing: -0.03em;
}
.pd-hoy-rot { font-size: 15px; font-weight: 800; color: var(--muted); }
.pd-hoy-clase { margin-top: 6px; font-size: 21px; font-weight: 900; line-height: 1.25; letter-spacing: -0.015em; color: var(--ink); }
.pd-hoy-dur { display: inline-flex; align-items: center; gap: 6px; font-size: 13.5px; font-weight: 700; color: var(--muted); }
.pd-hoy-dur svg { color: var(--pink-deep); }
.pd-hoy-titulo { margin-top: 6px; font-size: 28px; font-weight: 900; line-height: 1.12; letter-spacing: -0.02em; color: var(--ink); }
.pd-hoy-txt { font-size: 14.5px; line-height: 1.65; color: var(--muted); }
.pd-boton {
  margin-top: auto; display: inline-flex; align-items: center; justify-content: center; gap: 8px; height: 50px; padding: 0 26px; border-radius: 99px;
  background: var(--pink); color: #fff; font-size: 15px; font-weight: 800; text-decoration: none; box-shadow: 0 14px 26px -14px rgba(230,79,85,.85);
  transition: background .2s, transform .3s var(--curva), box-shadow .3s;
}
.pd-hoy .pd-boton { align-self: stretch; margin-top: auto; }
.pd-boton:hover { background: var(--pink-mid); transform: translateY(-2px); box-shadow: 0 18px 30px -14px rgba(230,79,85,.9); }
.pd-boton--suave { background: #fff; color: var(--ink); border: 1.5px solid var(--linea-fuerte); box-shadow: none; }
.pd-boton--suave:hover { background: var(--rubor); border-color: var(--pink-line); box-shadow: none; }

/* El recorrido */
.pd-recorrido { padding: clamp(20px, 2.6vw, 32px); border-radius: 32px; background: #fff; border: 1px solid var(--linea); box-shadow: var(--sombra); }
.pd-recorrido-cabeza { display: flex; align-items: center; gap: 14px; }
.pd-recorrido-ico { width: 46px; height: 46px; border-radius: 16px; flex-shrink: 0; display: grid; place-items: center; background: var(--rubor); color: var(--pink-deep); }
.pd-recorrido-eyebrow { font-size: 13px; font-weight: 800; color: var(--muted); }
.pd-recorrido-titulo { font-size: 26px; font-weight: 900; letter-spacing: -0.02em; line-height: 1.1; color: var(--ink); }
.pd-dias { margin-top: 20px; display: flex; flex-direction: column; gap: 10px; }
.pd-vacio { display: flex; align-items: center; gap: 12px; padding: 18px 20px; border-radius: 22px; background: var(--crema); border: 1.5px dashed var(--linea-fuerte); font-size: 14px; color: var(--muted); }
.pd-vacio-ico { width: 40px; height: 40px; border-radius: 14px; flex-shrink: 0; display: grid; place-items: center; background: #fff; color: var(--pink-deep); }

.pd-dia {
  display: flex; align-items: center; gap: 14px; padding: 12px 16px 12px 12px; border-radius: 22px; text-decoration: none;
  background: #fff; border: 1px solid var(--linea); transition: transform .3s var(--curva), box-shadow .3s, border-color .2s, background .2s, opacity .2s;
}
.pd-dia:hover { transform: translateY(-2px); border-color: var(--linea-fuerte); box-shadow: var(--sombra); opacity: 1; }
.pd-dia-marca {
  width: 42px; height: 42px; border-radius: 15px; flex-shrink: 0; display: grid; place-items: center;
  background: var(--crema); color: var(--muted); font-size: 15px; font-weight: 900; border: 1px solid var(--linea);
}
.pd-dia-txt { flex: 1; min-width: 0; }
.pd-dia-rot { font-size: 12.5px; font-weight: 800; color: var(--muted); }
.pd-dia-titulo { margin-top: 2px; font-size: 16.5px; font-weight: 800; color: var(--ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pd-dia-dur { flex-shrink: 0; padding: 5px 11px; border-radius: 99px; background: var(--crema); font-size: 12.5px; font-weight: 800; color: var(--muted); }
.pd-dia-flecha { flex-shrink: 0; width: 34px; height: 34px; border-radius: 50%; display: grid; place-items: center; color: var(--pink-deep); background: transparent; transition: background .2s, transform .3s var(--curva); }
.pd-dia:hover .pd-dia-flecha { background: var(--rubor); transform: translateX(2px); }

.pd-dia.es-hoy { background: linear-gradient(100deg, #FFEDE8 0%, #FFF7F4 70%); border: 1.5px solid var(--pink); box-shadow: 0 0 0 4px rgba(230,79,85,.08); }
.pd-dia.es-hoy .pd-dia-marca { background: var(--pink); color: #fff; border-color: var(--pink); box-shadow: 0 8px 16px -8px rgba(230,79,85,.8); }
.pd-dia.es-hoy .pd-dia-rot { color: var(--pink-deep); }
.pd-dia.es-hoy .pd-dia-dur { background: #fff; color: var(--pink-deep); }
.pd-dia.es-hecho .pd-dia-marca { background: var(--salvia); color: var(--salvia-deep); border-color: #CFE3C9; }
.pd-dia.es-hecho .pd-dia-rot { color: var(--salvia-deep); }
.pd-dia.es-empezado .pd-dia-marca { background: #FFF4E8; color: var(--melocoton-deep); border-color: var(--melocoton); }
.pd-dia.es-empezado .pd-dia-rot { color: var(--melocoton-deep); }
.pd-dia.es-futuro { opacity: .62; }

/* Foto de la clase en cada fila. */
.pd-dia-foto {
  width: 76px; aspect-ratio: 16 / 10; border-radius: 14px; flex-shrink: 0; overflow: hidden; position: relative;
  background: linear-gradient(135deg, #FFE9DE 0%, #FFDADA 100%);
}
.pd-dia-foto img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }

/* Descanso: la misma fila, en crema y melocoton, sin flecha ni enlace. */
.pd-dia--descanso { background: linear-gradient(100deg, #FFF6EF 0%, #FFFAF6 80%); border-style: dashed; border-color: #F3D9C8; }
.pd-dia--descanso:hover { transform: none; box-shadow: none; border-color: #F3D9C8; }
.pd-dia--descanso .pd-dia-rot { color: var(--melocoton-deep); }
.pd-dia-foto--descanso { display: grid; place-items: center; color: var(--melocoton-deep); background: radial-gradient(60px 40px at 70% 20%, #FFE2D3, transparent 70%), #FFF1E6; }
.pd-dia-nota { margin-top: 3px; font-size: 13px; line-height: 1.5; color: var(--muted); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.pd-dia--descanso.es-hoy { background: linear-gradient(100deg, #FFEFE3 0%, #FFF8F2 70%); border: 1.5px solid var(--melocoton); box-shadow: 0 0 0 4px rgba(255,170,120,.12); }
.pd-dia--descanso.es-hoy .pd-dia-marca { background: var(--melocoton); color: var(--melocoton-deep); border-color: var(--melocoton); box-shadow: none; }
.pd-dia--descanso.es-hecho .pd-dia-marca { background: #FFEBDF; color: var(--melocoton-deep); border-color: #F3D9C8; }

/* Tarjeta de hoy: con la foto de la clase arriba, o tranquila si es descanso. */
.pd-hoy-foto { width: 100%; aspect-ratio: 16 / 9; object-fit: cover; border-radius: 22px; margin-bottom: 4px; box-shadow: 0 18px 30px -22px rgba(120,50,40,.55); }
.pd-hoy--descanso { background: linear-gradient(160deg, #FFF6EF 0%, #FFFDFB 70%); }
.pd-hoy-eyebrow--calma { background: #FFEBDF; color: var(--melocoton-deep); }
.pd-hoy-num--calma { background: linear-gradient(160deg, #FFF1E6 0%, #FFE2D3 100%); color: var(--melocoton-deep); }

/* Venta del plan cerrado */
.pd-hero--cerrado { max-width: 980px; }
.pd-venta {
  margin-top: 22px; display: flex; align-items: center; gap: 16px; flex-wrap: wrap; padding: 18px 20px; border-radius: 24px;
  background: rgba(255,255,255,.85); border: 1px solid var(--pink-line);
}
.pd-venta-ico { width: 50px; height: 50px; border-radius: 17px; flex-shrink: 0; display: grid; place-items: center; background: var(--rubor); color: var(--pink-deep); }
.pd-venta-txt { flex: 1; min-width: 220px; display: flex; flex-direction: column; align-items: flex-start; gap: 8px; }
.pd-venta-txt p { font-size: 14px; line-height: 1.65; color: var(--muted); }
.pd-venta .pd-boton { margin-top: 0; }

@media (max-width: 960px) { .pd-arriba { grid-template-columns: 1fr; } }
@media (max-width: 640px) {
  .pd-hero, .pd-hoy, .pd-recorrido { border-radius: 26px; }
  .pd-portada { min-height: 11rem; }
  .pd-dia { gap: 10px; padding: 10px 12px 10px 10px; }
  .pd-dia-flecha { display: none; }
  .pd-dia-titulo { font-size: 15px; }
  .pd-dia-foto { width: 56px; border-radius: 11px; }
  .pd-venta .pd-boton { width: 100%; }
}
@media (prefers-reduced-motion: reduce) { .pd-barra > div { animation: none; } }
`;
