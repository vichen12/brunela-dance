import { requireUser } from "@/src/features/auth/guards";
import { getCurrentProfile } from "@/src/features/auth/profile";
import { completarOnboardingAction } from "@/src/features/auth/registro";
import { redirect } from "next/navigation";
import { fuenteSistema } from "@/src/lib/fuente-sistema";
import {
  Activity,
  Bell,
  Check,
  Crown,
  Dumbbell,
  Feather,
  Flame,
  GraduationCap,
  HeartPulse,
  Move,
  Sparkles,
  Sprout,
  Star,
  StretchHorizontal,
  Sun,
} from "lucide-react";

export const dynamic = "force-dynamic";

/*
 * Los iconos se renderizan ACA, dentro del server component, y nunca viajan
 * como prop a un componente de cliente (CLAUDE.md, trampa 6).
 */
const NIVELES = [
  { key: "principiante", label: "Principiante", desc: "Estoy empezando o vuelvo después de un tiempo.", Icono: Sprout },
  { key: "intermedio",   label: "Intermedio",   desc: "Entreno seguido y manejo la técnica básica.",   Icono: Feather },
  { key: "avanzado",     label: "Avanzado",     desc: "Tengo años de práctica y busco precisión.",     Icono: Star },
  { key: "profesional",  label: "Profesional",  desc: "Bailo o enseño de manera profesional.",          Icono: Crown },
  { key: "maestro",      label: "Maestro",      desc: "Formo a otras personas.",                        Icono: GraduationCap },
] as const;

const OBJETIVOS = [
  { key: "movilidad",            label: "Movilidad",            Icono: Move },
  { key: "fuerza_centro",        label: "Fuerza y centro",      Icono: Dumbbell },
  { key: "flexibilidad",         label: "Flexibilidad",         Icono: StretchHorizontal },
  { key: "recuperacion",         label: "Recuperación",         Icono: HeartPulse },
  { key: "resistencia",          label: "Resistencia",          Icono: Flame },
  { key: "alineacion_postural",  label: "Alineación postural",  Icono: Activity },
  { key: "rendimiento_escenico", label: "Rendimiento escénico", Icono: Sparkles },
  { key: "bienestar_general",    label: "Bienestar general",    Icono: Sun },
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
        <div className="onb-pasos" aria-hidden="true">
          <span className="hecho" />
          <span className="activo" />
        </div>
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

          {/*
            Los controles son inputs NATIVOS de verdad (radio y checkbox), solo
            que escondidos visualmente: siguen funcionando con teclado, lector
            de pantalla y sin JavaScript. Lo que se ve es la tarjeta, que
            reacciona con :has(input:checked) y :has(input:focus-visible).
          */}
          <fieldset className="onb-group">
            <legend className="onb-legend">
              <span className="onb-num">1</span> Tu nivel
            </legend>
            <div className="onb-niveles">
              {NIVELES.map((n, i) => (
                <label key={n.key} className="onb-nivel">
                  <input
                    className="onb-oculto"
                    type="radio"
                    name="technicalLevel"
                    value={n.key}
                    defaultChecked={i === 0}
                    required
                  />
                  <span className="onb-nivel-ico" aria-hidden="true">
                    <n.Icono size={20} strokeWidth={2} />
                  </span>
                  <span className="onb-nivel-body">
                    <span className="onb-nivel-label">{n.label}</span>
                    <span className="onb-nivel-desc">{n.desc}</span>
                  </span>
                  <span className="onb-escala" aria-hidden="true">
                    {NIVELES.map((_, j) => <span key={j} className={j <= i ? "lleno" : ""} />)}
                  </span>
                  <span className="onb-marca onb-marca--radio" aria-hidden="true">
                    <Check size={13} strokeWidth={3.2} />
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="onb-group">
            <legend className="onb-legend">
              <span className="onb-num">2</span> Qué buscás <small>elegí una o varias</small>
            </legend>
            <div className="onb-objetivos">
              {OBJETIVOS.map((o) => (
                <label key={o.key} className="onb-obj">
                  <input
                    className="onb-oculto"
                    type="checkbox"
                    name="goals"
                    value={o.key}
                    defaultChecked={o.key === "bienestar_general"}
                  />
                  <span className="onb-obj-ico" aria-hidden="true">
                    <o.Icono size={18} strokeWidth={2} />
                  </span>
                  <span className="onb-obj-label">{o.label}</span>
                  <span className="onb-marca" aria-hidden="true">
                    <Check size={12} strokeWidth={3.2} />
                  </span>
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
            <legend className="onb-legend">
              <span className="onb-num">3</span> Avisos <small>opcional</small>
            </legend>
            <label className="onb-consent">
              <input className="onb-oculto" type="checkbox" name="marketingOptIn" value="si" />
              <span className="onb-consent-ico" aria-hidden="true">
                <Bell size={19} strokeWidth={2} />
              </span>
              <span className="onb-consent-txt">
                <strong>Quiero enterarme de las clases nuevas.</strong>
                <small>
                  Brunela te escribe cuando sube una clase. Podés darte de baja
                  desde cualquier correo, con un clic y sin iniciar sesión.
                </small>
              </span>
              <span className="onb-switch" aria-hidden="true"><span /></span>
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
          width: min(680px, 100%);
          background: #fff;
          border: 1px solid var(--linea);
          border-radius: 32px; padding: 30px 32px 30px;
          box-shadow: var(--sombra-alta);
          animation: onb-entra .7s var(--curva) both;
        }
        @keyframes onb-entra { from { opacity: 0; transform: translateY(14px) scale(.985); } to { opacity: 1; transform: none; } }

        .onb-pasos { display: flex; gap: 6px; margin-bottom: 18px; }
        .onb-pasos span { height: 5px; flex: 1; border-radius: 99px; background: var(--linea); }
        .onb-pasos .hecho { background: #F6BDB6; }
        .onb-pasos .activo { background: var(--pink); }

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
        .onb-form { margin-top: 26px; display: grid; gap: 28px; }
        .onb-group { border: 0; padding: 0; margin: 0; min-width: 0; }
        .onb-legend {
          display: flex; align-items: center; gap: 10px;
          font-size: 16.5px; font-weight: 900; letter-spacing: -0.01em; color: var(--ink); margin-bottom: 12px;
        }
        .onb-legend small { font-size: 12.5px; font-weight: 700; color: var(--muted); }
        .onb-num {
          width: 26px; height: 26px; border-radius: 50%; display: inline-grid; place-items: center;
          background: var(--rubor); color: var(--pink-deep); font-size: 13px; font-weight: 900;
        }

        /* El input real, invisible pero vivo (teclado y lectores de pantalla). */
        .onb-oculto {
          position: absolute; opacity: 0; width: 1px; height: 1px; margin: 0; pointer-events: none;
        }

        /* Marca de elegido: circulo vacio que se llena de coral con el tilde. */
        .onb-marca {
          flex-shrink: 0; width: 24px; height: 24px; border-radius: 8px;
          display: grid; place-items: center;
          border: 1.5px solid var(--linea-fuerte); background: #fff; color: transparent;
          transition: background .2s, border-color .2s, color .2s, transform .35s var(--curva);
        }
        .onb-marca--radio { border-radius: 50%; }

        /* ── Nivel: tarjetas en lista, con escala de 5 ── */
        .onb-niveles { display: grid; gap: 10px; }
        .onb-nivel {
          position: relative;
          display: flex; align-items: center; gap: 14px;
          padding: 14px 16px 14px 14px; border-radius: 22px;
          border: 1.5px solid var(--linea); background: #fff;
          cursor: pointer;
          transition: border-color .2s, background .25s, transform .35s var(--curva), box-shadow .35s;
        }
        .onb-nivel:hover { border-color: var(--linea-fuerte); background: var(--crema); transform: translateY(-1px); }
        .onb-nivel-ico {
          flex-shrink: 0; width: 44px; height: 44px; border-radius: 15px;
          display: grid; place-items: center; background: var(--crema); color: #C25E3A;
          transition: background .25s, color .25s;
        }
        .onb-nivel-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
        .onb-nivel-label { font-size: 15.5px; font-weight: 900; color: var(--ink); letter-spacing: -0.01em; }
        .onb-nivel-desc { font-size: 13px; color: var(--muted); line-height: 1.45; }
        .onb-escala { display: flex; gap: 3px; flex-shrink: 0; }
        .onb-escala span { width: 6px; height: 16px; border-radius: 99px; background: var(--linea); transition: background .25s; }
        .onb-escala span.lleno { background: #F6BDB6; }

        .onb-nivel:has(input:checked) {
          border-color: var(--pink); background: linear-gradient(100deg, #FFEDE8, #FFF8F5 75%);
          box-shadow: 0 12px 26px -18px rgba(230,79,85,.7);
        }
        .onb-nivel:has(input:checked) .onb-nivel-ico { background: var(--pink); color: #fff; }
        .onb-nivel:has(input:checked) .onb-escala span.lleno { background: var(--pink); }
        .onb-nivel:has(input:checked) .onb-marca,
        .onb-obj:has(input:checked) .onb-marca {
          background: var(--pink); border-color: var(--pink); color: #fff; transform: scale(1.06);
        }

        /* ── Objetivos: grilla de fichas ── */
        .onb-objetivos { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
        .onb-obj {
          position: relative;
          display: flex; align-items: center; gap: 11px;
          padding: 11px 12px 11px 11px; border-radius: 18px;
          border: 1.5px solid var(--linea); background: #fff;
          cursor: pointer; min-height: 56px;
          transition: border-color .2s, background .25s, transform .35s var(--curva);
        }
        .onb-obj:hover { border-color: var(--linea-fuerte); background: var(--crema); transform: translateY(-1px); }
        .onb-obj-ico {
          flex-shrink: 0; width: 34px; height: 34px; border-radius: 12px;
          display: grid; place-items: center; background: var(--crema); color: #C25E3A;
          transition: background .25s, color .25s;
        }
        .onb-obj-label { flex: 1; min-width: 0; font-size: 14.5px; font-weight: 800; color: var(--ink); line-height: 1.3; }
        .onb-obj:has(input:checked) { border-color: var(--pink); background: var(--rubor); }
        .onb-obj:has(input:checked) .onb-obj-ico { background: #fff; color: var(--pink-deep); }

        /* ── Avisos: fila con interruptor ── */
        .onb-consent {
          position: relative;
          display: flex; align-items: center; gap: 14px;
          padding: 15px 16px 15px 14px; border-radius: 22px;
          border: 1.5px solid var(--linea); background: var(--crema);
          cursor: pointer; transition: border-color .2s, background .25s;
        }
        .onb-consent:hover { border-color: var(--linea-fuerte); }
        .onb-consent-ico {
          flex-shrink: 0; width: 44px; height: 44px; border-radius: 15px;
          display: grid; place-items: center; background: #fff; color: #C25E3A;
          transition: background .25s, color .25s;
        }
        .onb-consent-txt { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
        .onb-consent strong { font-size: 14.5px; font-weight: 900; color: var(--ink); }
        .onb-consent small { font-size: 13px; color: var(--muted); line-height: 1.5; }
        .onb-switch {
          flex-shrink: 0; width: 46px; height: 28px; border-radius: 99px; padding: 3px;
          background: var(--linea-fuerte); transition: background .25s;
        }
        .onb-switch span {
          display: block; width: 22px; height: 22px; border-radius: 50%; background: #fff;
          box-shadow: 0 2px 6px rgba(120,60,50,.25); transition: transform .35s var(--curva);
        }
        .onb-consent:has(input:checked) { border-color: var(--pink); background: var(--rubor); }
        .onb-consent:has(input:checked) .onb-consent-ico { background: var(--pink); color: #fff; }
        .onb-consent:has(input:checked) .onb-switch { background: var(--pink); }
        .onb-consent:has(input:checked) .onb-switch span { transform: translateX(18px); }

        /* Foco de teclado visible en la TARJETA, que es lo que se ve. */
        .onb-nivel:has(input:focus-visible),
        .onb-obj:has(input:focus-visible),
        .onb-consent:has(input:focus-visible) {
          outline: 3px solid rgba(230,79,85,.45); outline-offset: 2px;
        }

        .onb-submit {
          width: 100%; min-height: 56px; border: 0; border-radius: 999px;
          background: var(--pink); color: #fff; cursor: pointer;
          font-family: inherit; font-size: 16px; font-weight: 800;
          box-shadow: 0 14px 26px -14px rgba(230,79,85,.85);
          transition: background .2s, transform .3s var(--curva), box-shadow .3s;
        }
        .onb-submit:hover { background: var(--pink-mid); transform: translateY(-2px); box-shadow: 0 18px 30px -14px rgba(230,79,85,.9); }

        @media (max-width: 520px) {
          .onb-card { padding: 24px 18px 22px; border-radius: 26px; }
          .onb-title { font-size: 29px; }
          .onb-nivel { gap: 12px; padding: 12px 13px 12px 12px; }
          .onb-nivel-ico { width: 40px; height: 40px; }
          .onb-escala { display: none; }
          .onb-objetivos { grid-template-columns: minmax(0, 1fr); }
        }
        @media (prefers-reduced-motion: reduce) {
          .onb-card { animation: none; }
          .onb-nivel, .onb-obj, .onb-marca, .onb-switch span { transition: none; }
        }
      `}</style>
    </main>
  );
}
