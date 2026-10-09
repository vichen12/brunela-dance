import { requireUser } from "@/src/features/auth/guards";
import { getCurrentProfile } from "@/src/features/auth/profile";
import { completarOnboardingAction } from "@/src/features/auth/registro";
import { redirect } from "next/navigation";
import { fuenteSistema } from "@/src/lib/fuente-sistema";

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
  const meta = user.user_metadata as {
    pending_tier?: string | null;
    pending_interval?: string | null;
    pending_pack?: string | null;
  } | undefined;
  const plan = str("plan") ?? meta?.pending_tier ?? null;
  const interval = str("interval") ?? meta?.pending_interval ?? null;
  const pack = str("pack") ?? meta?.pending_pack ?? null;
  const error = str("error");

  const nombre = profile?.full_name?.split(" ")[0] ?? null;

  return (
    // `sistema` + la variable de Nunito: la misma piel suave que el panel. Esta
    // pantalla no vive bajo los layouts del sistema, asi que se la pone a mano.
    <main className={`onb-page sistema ${fuenteSistema.variable}`}>
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
          {pack && <input type="hidden" name="pack" value={pack} />}

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
            {plan || pack ? "Continuar al pago" : "Entrar al estudio"}
          </button>
        </form>
      </section>

      <style>{`
        .onb-page {
          position: relative; isolation: isolate; overflow: hidden;
          min-height: 100vh; display: flex; align-items: center; justify-content: center;
          padding: 28px 16px 40px;
        }
        /* Manchas tibias detras de la tarjeta: el fondo sigue siendo blanco. */
        .onb-page::before, .onb-page::after {
          content: ""; position: absolute; z-index: -1; border-radius: 50%; pointer-events: none;
        }
        .onb-page::before { width: 620px; height: 620px; left: -200px; top: -260px; background: radial-gradient(circle, rgba(255,226,211,.75), transparent 66%); }
        .onb-page::after { width: 560px; height: 560px; right: -200px; bottom: -240px; background: radial-gradient(circle, rgba(253,236,236,.9), transparent 66%); }
        .onb-card {
          width: min(640px, 100%);
          background: #fff;
          border: 1px solid var(--linea);
          border-radius: 32px; padding: 34px 32px 30px;
          box-shadow: var(--sombra-alta);
          animation: onb-entra .7s var(--curva) both;
        }
        @keyframes onb-entra { from { opacity: 0; transform: translateY(14px) scale(.985); } to { opacity: 1; transform: none; } }
        .onb-kicker {
          display: inline-flex; align-items: center; gap: 7px; padding: 5px 12px 5px 10px; border-radius: 99px;
          background: var(--rubor); font-size: 12.5px; font-weight: 800; color: var(--pink-deep);
        }
        .onb-kicker::before { content: ""; width: 7px; height: 7px; border-radius: 50%; background: var(--pink); }
        .onb-title {
          font-size: 36px; line-height: 1.08; font-weight: 900; letter-spacing: -0.025em;
          color: var(--ink); margin: 14px 0 0;
        }
        .onb-title span { color: var(--pink); }
        .onb-sub { margin: 10px 0 0; font-size: 14.5px; color: var(--muted); line-height: 1.6; }
        .onb-error {
          margin-top: 16px; border-radius: 18px; padding: 0.85rem 1rem;
          font-size: 0.86rem; font-weight: 700; line-height: 1.4;
          border: 1px solid var(--pink-line);
          background: var(--pink-wash); color: var(--pink-deep);
        }
        .onb-form { margin-top: 26px; display: grid; gap: 26px; }
        .onb-group { border: 0; padding: 0; margin: 0; }
        .onb-legend {
          font-size: 16px; font-weight: 900; letter-spacing: -0.01em; color: var(--ink); margin-bottom: 12px;
        }
        .onb-legend small {
          font-size: 12.5px; font-weight: 700; color: var(--muted); margin-left: 8px;
        }

        .onb-niveles { display: grid; gap: 8px; }
        .onb-nivel {
          display: flex; align-items: center; gap: 13px;
          padding: 13px 16px; border-radius: 20px;
          border: 1.5px solid var(--linea); background: #fff;
          cursor: pointer; min-height: 52px;
          transition: border-color .2s, background .2s, transform .3s var(--curva), box-shadow .3s;
        }
        .onb-nivel:hover { border-color: var(--linea-fuerte); background: var(--crema); }
        .onb-nivel:has(input:checked) {
          border-color: var(--pink-line); background: linear-gradient(100deg, #FFEDE8, #FFF7F4 70%); box-shadow: 0 0 0 4px rgba(230,79,85,.07);
        }
        .onb-nivel input { flex-shrink: 0; accent-color: var(--pink); width: 18px; height: 18px; }
        .onb-nivel-body { display: flex; flex-direction: column; gap: 2px; }
        .onb-nivel-label { font-size: 15px; font-weight: 800; color: var(--ink); }
        .onb-nivel-desc { font-size: 13px; color: var(--muted); line-height: 1.5; }

        .onb-objetivos { display: flex; flex-wrap: wrap; gap: 8px; }
        .onb-obj {
          display: inline-flex; align-items: center; gap: 8px;
          padding: 10px 16px 10px 13px; border-radius: 999px;
          border: 1.5px solid var(--linea); background: #fff;
          cursor: pointer; font-size: 14px; font-weight: 700; color: var(--ink);
          min-height: 44px; transition: border-color .2s, background .2s, color .2s;
        }
        .onb-obj:hover { border-color: var(--linea-fuerte); background: var(--crema); }
        .onb-obj:has(input:checked) {
          border-color: var(--pink-line); background: var(--rubor); color: var(--pink-deep);
        }
        .onb-obj input { accent-color: var(--pink); width: 16px; height: 16px; }

        .onb-consent {
          display: flex; align-items: flex-start; gap: 13px;
          padding: 15px 16px; border-radius: 20px;
          border: 1.5px solid var(--linea); background: var(--crema);
          cursor: pointer; min-height: 52px; transition: border-color .2s, background .2s;
        }
        .onb-consent:has(input:checked) {
          border-color: #CFE3C9; background: #F2F7EF;
        }
        .onb-consent input { flex-shrink: 0; margin-top: 2px; accent-color: var(--salvia-deep); width: 18px; height: 18px; }
        .onb-consent span { display: flex; flex-direction: column; gap: 3px; }
        .onb-consent strong { font-size: 14.5px; font-weight: 800; color: var(--ink); }
        .onb-consent small { font-size: 13px; color: var(--muted); line-height: 1.5; }

        .onb-submit {
          width: 100%; min-height: 54px; border: 0; border-radius: 999px;
          background: var(--pink); color: #fff; cursor: pointer;
          font-family: inherit; font-size: 15.5px; font-weight: 800;
          box-shadow: 0 14px 26px -14px rgba(230,79,85,.85);
          transition: background .2s, transform .3s var(--curva), box-shadow .3s;
        }
        .onb-submit:hover { background: var(--pink-mid); transform: translateY(-2px); box-shadow: 0 18px 30px -14px rgba(230,79,85,.9); }

        @media (max-width: 520px) {
          .onb-card { padding: 26px 20px 24px; border-radius: 26px; }
          .onb-title { font-size: 29px; }
        }
        @media (prefers-reduced-motion: reduce) { .onb-card { animation: none; } }
      `}</style>
    </main>
  );
}
