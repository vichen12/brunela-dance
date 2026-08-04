import { requireUser } from "@/src/features/auth/guards";
import { getCurrentProfile } from "@/src/features/auth/profile";
import { completarOnboardingAction } from "@/src/features/auth/registro";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

const NIVELES = [
  { key: "principiante", label: "Principiante", desc: "Estoy empezando o vuelvo después de un tiempo." },
  { key: "intermedio",   label: "Intermedio",   desc: "Entreno seguido y manejo la técnica básica." },
  { key: "avanzado",     label: "Avanzado",     desc: "Tengo años de práctica y busco precisión." },
  { key: "profesional",  label: "Profesional",  desc: "Bailo o enseño de manera profesional." },
  { key: "maestro",      label: "Maestro",      desc: "Formo a otras personas." },
] as const;

const OBJETIVOS = [
  { key: "movilidad",             label: "Movilidad" },
  { key: "fuerza_centro",         label: "Fuerza y centro" },
  { key: "flexibilidad",          label: "Flexibilidad" },
  { key: "recuperacion",          label: "Recuperación" },
  { key: "resistencia",           label: "Resistencia" },
  { key: "alineacion_postural",   label: "Alineación postural" },
  { key: "rendimiento_escenico",  label: "Rendimiento escénico" },
  { key: "bienestar_general",     label: "Bienestar general" },
] as const;

type Props = { searchParams?: Promise<Record<string, string | string[] | undefined>> };

export default async function OnboardingPage({ searchParams }: Props) {
  const { user } = await requireUser();
  const params = (await searchParams) ?? {};
  const str = (k: string) => (typeof params[k] === "string" ? (params[k] as string) : null);

  const profile = await getCurrentProfile(user.id);

  // Ya lo completo: no se le vuelve a pedir. Sin esto, la compuerta del layout
  // y esta pantalla podrian rebotarse entre si.
  if (profile?.onboarding_completed) redirect("/dashboard" as never);

  // El plan puede venir por URL (Google) o de la metadata del alta (correo).
  const meta = user.user_metadata as { pending_tier?: string | null; pending_interval?: string | null } | undefined;
  const plan = str("plan") ?? meta?.pending_tier ?? null;
  const interval = str("interval") ?? meta?.pending_interval ?? null;
  const error = str("error");

  const nombre = profile?.full_name?.split(" ")[0] ?? null;

  return (
    <main className="onb-page">
      <section className="onb-card">
        <p className="onb-kicker">Paso 2 de 2</p>
        <h1 className="onb-title">
          {nombre ? `${nombre}, contanos` : "Contanos"}<br />
          <span>cómo entrenás.</span>
        </h1>
        <p className="onb-sub">
          Sirve para ordenarte las clases. Podés cambiarlo cuando quieras.
        </p>

        {error && <p className="onb-error" role="alert">{error}</p>}

        <form action={completarOnboardingAction} className="onb-form">
          {plan && <input type="hidden" name="plan" value={plan} />}
          {interval && <input type="hidden" name="interval" value={interval} />}

          <fieldset className="onb-group">
            <legend className="onb-legend">Tu nivel</legend>
            <div className="onb-niveles">
              {NIVELES.map((n, i) => (
                <label key={n.key} className="onb-nivel">
                  <input
                    type="radio"
                    name="technicalLevel"
                    value={n.key}
                    defaultChecked={i === 0}
                    required
                  />
                  <span className="onb-nivel-body">
                    <span className="onb-nivel-label">{n.label}</span>
                    <span className="onb-nivel-desc">{n.desc}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="onb-group">
            <legend className="onb-legend">Qué buscás <small>elegí una o varias</small></legend>
            <div className="onb-objetivos">
              {OBJETIVOS.map((o) => (
                <label key={o.key} className="onb-obj">
                  <input type="checkbox" name="goals" value={o.key} defaultChecked={o.key === "bienestar_general"} />
                  <span>{o.label}</span>
                </label>
              ))}
            </div>
          </fieldset>

          {/* Consentimiento de marketing.
              SIN defaultChecked, y es lo unico que importa de este bloque: un
              consentimiento premarcado no es consentimiento. Tampoco es
              obligatorio -- no lleva `required` -- porque condicionar el alta a
              aceptar publicidad lo invalida. */}
          <fieldset className="onb-group">
            <legend className="onb-legend">Avisos</legend>
            <label className="onb-consent">
              <input type="checkbox" name="marketingOptIn" value="si" />
              <span>
                <strong>Quiero enterarme de las clases nuevas.</strong>
                <small>
                  Brunela te escribe cuando sube una clase. Podés darte de baja
                  desde cualquier correo, con un clic y sin iniciar sesión.
                </small>
              </span>
            </label>
          </fieldset>

          <button type="submit" className="onb-submit">
            {plan ? "Continuar al pago" : "Entrar al estudio"}
          </button>
        </form>
      </section>

      <style>{`
        .onb-page {
          min-height: 100vh; display: flex; align-items: center; justify-content: center;
          padding: 28px 20px 40px;
          background:
            radial-gradient(1100px 520px at 12% -8%, var(--pink-wash) 0%, transparent 60%),
            radial-gradient(900px 480px at 105% 108%, var(--pink-soft) 0%, transparent 62%),
            #fffdfd;
        }
        .onb-card {
          width: min(640px, 100%);
          background: rgba(255,255,255,0.94);
          border: 1.5px solid var(--pink-soft);
          border-radius: 28px; padding: 34px 32px 30px;
          box-shadow: 0 26px 70px rgba(28,25,23,0.09);
        }
        .onb-kicker {
          font-size: 10px; font-weight: 900; letter-spacing: 0.2em;
          text-transform: uppercase; color: var(--pink);
        }
        .onb-title {
          font-family: var(--font-display), sans-serif;
          font-size: 34px; line-height: 1.1; font-weight: 800;
          color: var(--ink); margin: 12px 0 0;
        }
        .onb-title span { color: var(--pink); font-style: italic; }
        .onb-sub { margin: 10px 0 0; font-size: 13.5px; color: var(--muted); line-height: 1.6; }
        .onb-error {
          margin-top: 16px; border-radius: 14px; padding: 0.85rem 1rem;
          font-size: 0.82rem; font-weight: 700; line-height: 1.4;
          border: 1px solid rgba(217, 105, 119, 0.3);
          background: rgba(255, 238, 242, 0.95); color: var(--pink-deep);
        }
        .onb-form { margin-top: 24px; display: grid; gap: 26px; }
        .onb-group { border: 0; padding: 0; margin: 0; }
        .onb-legend {
          font-size: 11px; font-weight: 900; letter-spacing: 0.14em;
          text-transform: uppercase; color: var(--pink); margin-bottom: 12px;
        }
        .onb-legend small {
          font-size: 10px; font-weight: 700; letter-spacing: 0.06em;
          text-transform: none; color: var(--pink-muted); margin-left: 8px;
        }

        .onb-niveles { display: grid; gap: 8px; }
        .onb-nivel {
          display: flex; align-items: flex-start; gap: 12px;
          padding: 13px 15px; border-radius: 15px;
          border: 1.5px solid var(--pink-line); background: #fff;
          cursor: pointer; min-height: 48px;
        }
        .onb-nivel:has(input:checked) {
          border-color: var(--pink); background: var(--pink-wash);
        }
        .onb-nivel input { margin-top: 3px; accent-color: var(--pink); width: 16px; height: 16px; }
        .onb-nivel-body { display: flex; flex-direction: column; gap: 2px; }
        .onb-nivel-label { font-size: 14px; font-weight: 800; color: var(--ink); }
        .onb-nivel-desc { font-size: 12px; color: var(--muted); line-height: 1.5; }

        .onb-objetivos { display: flex; flex-wrap: wrap; gap: 8px; }
        .onb-obj {
          display: inline-flex; align-items: center; gap: 8px;
          padding: 11px 15px; border-radius: 999px;
          border: 1.5px solid var(--pink-line); background: #fff;
          cursor: pointer; font-size: 13px; font-weight: 700; color: var(--ink);
          min-height: 44px;
        }
        .onb-obj:has(input:checked) {
          border-color: var(--pink); background: var(--pink-wash); color: var(--pink-deep);
        }
        .onb-obj input { accent-color: var(--pink); width: 15px; height: 15px; }

        .onb-consent {
          display: flex; align-items: flex-start; gap: 12px;
          padding: 14px 15px; border-radius: 15px;
          border: 1.5px solid var(--pink-line); background: #fff;
          cursor: pointer; min-height: 48px;
        }
        .onb-consent:has(input:checked) {
          border-color: var(--pink); background: var(--pink-wash);
        }
        .onb-consent input { margin-top: 3px; accent-color: var(--pink); width: 16px; height: 16px; }
        .onb-consent span { display: flex; flex-direction: column; gap: 3px; }
        .onb-consent strong { font-size: 13.5px; font-weight: 700; color: var(--ink); }
        .onb-consent small { font-size: 12px; color: var(--muted); line-height: 1.5; }

        .onb-submit {
          width: 100%; min-height: 52px; border: 0; border-radius: 999px;
          background: var(--pink); color: #fff; cursor: pointer;
          font-family: var(--font-body), sans-serif; font-size: 0.72rem;
          font-weight: 900; letter-spacing: 0.1em; text-transform: uppercase;
          box-shadow: 0 18px 34px rgba(230, 79, 85, 0.26);
        }

        @media (max-width: 520px) {
          .onb-card { padding: 26px 20px 24px; border-radius: 22px; }
          .onb-title { font-size: 28px; }
        }
      `}</style>
    </main>
  );
}
