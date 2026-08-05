import Link from "next/link";
import { redirect } from "next/navigation";
import { RegistroForm } from "@/components/registro-form";
import { OAuthButtons } from "@/components/oauth-buttons";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";
import { hasSupabaseAuthEnv } from "@/src/lib/env";

export const dynamic = "force-dynamic";

const TIERS = ["corps_de_ballet", "solista", "principal"] as const;
type Tier = (typeof TIERS)[number];

const PLAN_LABEL: Record<Tier, { nombre: string; mensual: string; anual: string }> = {
  corps_de_ballet: { nombre: "Corps de Ballet", mensual: "16", anual: "154" },
  solista:         { nombre: "Solista",         mensual: "31", anual: "299" },
  principal:       { nombre: "Principal",       mensual: "59", anual: "559" },
};

type Props = { searchParams?: Promise<Record<string, string | string[] | undefined>> };

export default async function RegistroPage({ searchParams }: Props) {
  const params = (await searchParams) ?? {};
  const str = (k: string) => (typeof params[k] === "string" ? (params[k] as string) : null);

  const planCrudo = str("plan");
  const plan = planCrudo && (TIERS as readonly string[]).includes(planCrudo) ? (planCrudo as Tier) : null;
  const interval = str("interval") === "yearly" ? "yearly" : str("interval") === "monthly" ? "monthly" : null;
  const error = str("error");
  const email = str("email");
  // El slug del pack NO se valida aca contra la base: se valida en el checkout,
  // que es quien resuelve el precio. Aca solo se acota el largo.
  const packCrudo = str("pack");
  const pack = packCrudo && packCrudo.length <= 120 ? packCrudo : null;

  // Ya logueada: no tiene sentido mostrarle un alta. La compuerta del layout de
  // /dashboard la manda al onboarding si le falta.
  if (hasSupabaseAuthEnv()) {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) redirect("/dashboard" as never);
  }

  const elegido = plan ? PLAN_LABEL[plan] : null;
  const precio = elegido ? (interval === "yearly" ? elegido.anual : elegido.mensual) : null;

  // El plan viaja tambien por el camino de Google, donde no hay signUp en el
  // que meter metadata: se pasa por la URL de vuelta del callback.
  const partesGoogle = new URLSearchParams();
  if (plan) partesGoogle.set("plan", plan);
  if (interval) partesGoogle.set("interval", interval);
  if (pack) partesGoogle.set("pack", pack);
  const destinoGoogle = `/registro/onboarding${partesGoogle.size > 0 ? `?${partesGoogle.toString()}` : ""}`;

  return (
    <main className="reg-page">
      <div className="reg-top">
        <Link href="/">← Volver</Link>
        <Link href="/sign-in">Ya tengo cuenta</Link>
      </div>

      <section className="reg-card">
        <p className="reg-kicker">Crear cuenta</p>
        <h1 className="reg-title">
          Empezá a entrenar<br />
          <span>con Brunela.</span>
        </h1>

        {elegido ? (
          <div className="reg-plan" aria-live="polite">
            <span className="reg-plan-tag">Plan elegido</span>
            <span className="reg-plan-name">{elegido.nombre}</span>
            <span className="reg-plan-price">
              {precio} € <small>/ {interval === "yearly" ? "año" : "mes"}</small>
            </span>
            <Link href="/#planes" className="reg-plan-change">Cambiar</Link>
          </div>
        ) : (
          <p className="reg-note">
            Podés elegir tu plan al terminar, o <Link href="/#planes">verlos primero</Link>.
          </p>
        )}

        <RegistroForm error={error} plan={plan} interval={interval} pack={pack} email={email} />

        <div className="reg-divider"><div /><span>o</span><div /></div>

        {/* Mismo componente que el login: una sola implementacion de Google. */}
        <OAuthButtons callbackUrl={destinoGoogle} />

        <p className="reg-legal">
          Al crear la cuenta aceptás los términos del estudio. El plan se cobra
          después de los 7 días de prueba, y podés cancelarlo cuando quieras.
        </p>
      </section>

      <style>{`
        .reg-page {
          min-height: 100vh; display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          padding: 28px 20px 40px; gap: 18px;
          background:
            radial-gradient(1100px 520px at 12% -8%, var(--pink-wash) 0%, transparent 60%),
            radial-gradient(900px 480px at 105% 108%, var(--pink-soft) 0%, transparent 62%),
            #fffdfd;
        }
        .reg-top {
          width: min(560px, 100%); display: flex; justify-content: space-between;
          font-size: 12px; font-weight: 700; letter-spacing: 0.04em;
        }
        .reg-top a { color: var(--pink-deep); text-decoration: none; }
        .reg-top a:hover { text-decoration: underline; }

        .reg-card {
          width: min(560px, 100%);
          background: rgba(255,255,255,0.94);
          border: 1.5px solid var(--pink-soft);
          border-radius: 28px;
          padding: 34px 32px 28px;
          box-shadow: 0 26px 70px rgba(28,25,23,0.09);
          backdrop-filter: blur(10px);
        }
        .reg-kicker {
          font-size: 10px; font-weight: 900; letter-spacing: 0.2em;
          text-transform: uppercase; color: var(--pink);
        }
        .reg-title {
          font-family: var(--font-display), sans-serif;
          font-size: 38px; line-height: 1.08; font-weight: 800;
          color: var(--ink); margin: 12px 0 0; letter-spacing: -0.01em;
        }
        .reg-title span { color: var(--pink); font-style: italic; }

        .reg-plan {
          display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
          margin: 20px 0 4px; padding: 13px 16px;
          background: var(--pink-wash); border: 1.5px solid var(--pink-line);
          border-radius: 16px;
        }
        .reg-plan-tag {
          font-size: 9px; font-weight: 900; letter-spacing: 0.16em;
          text-transform: uppercase; color: var(--pink-deep);
        }
        .reg-plan-name { font-size: 15px; font-weight: 800; color: var(--ink); }
        .reg-plan-price { font-size: 14px; font-weight: 700; color: var(--pink-deep); margin-left: auto; }
        .reg-plan-price small { font-size: 11px; font-weight: 600; }
        .reg-plan-change {
          font-size: 11px; font-weight: 700; color: var(--pink-muted);
          text-decoration: underline; flex-basis: 100%;
        }
        .reg-note { margin: 18px 0 4px; font-size: 13px; color: var(--muted); line-height: 1.6; }
        .reg-note a { color: var(--pink-deep); font-weight: 700; }

        .reg-card :global(.auth-form) { margin-top: 18px; }

        .reg-divider { display: flex; align-items: center; gap: 14px; margin: 20px 0 16px; }
        .reg-divider div { flex: 1; height: 1px; background: var(--pink-line); }
        .reg-divider span {
          font-size: 10px; font-weight: 900; letter-spacing: 0.16em;
          text-transform: uppercase; color: var(--pink-muted);
        }

        .reg-legal {
          margin-top: 18px; font-size: 11.5px; line-height: 1.65;
          color: var(--pink-muted); text-align: center;
        }

        @media (max-width: 520px) {
          .reg-card { padding: 26px 20px 22px; border-radius: 22px; }
          .reg-title { font-size: 30px; }
        }
      `}</style>
    </main>
  );
}
