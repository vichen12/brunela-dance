import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Sparkles } from "lucide-react";
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
  // ⚠️ NO SE PIERDE LO QUE VENIA ELIGIENDO.
  //
  //    Antes esto era `redirect("/dashboard")` a secas, y ahi moria la intencion:
  //    una alumna con sesion que tocaba "llevar este pack" en la portada
  //    aterrizaba en su dashboard sin compra y sin explicacion. Como no habia
  //    ningun otro camino, los packs directamente NO EXISTIAN para quien ya
  //    tenia cuenta -- que despues del lanzamiento son todas.
  if (hasSupabaseAuthEnv()) {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const q = new URLSearchParams();
      if (pack) q.set("pack", pack);
      else if (plan) {
        q.set("plan", plan);
        if (interval) q.set("interval", interval);
      }
      if (q.size > 0) {
        q.set("iniciar", "1");
        redirect(`/dashboard/plan?${q.toString()}` as never);
      }
      redirect("/dashboard" as never);
    }
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
    <main className="reg-page sistema">
      <span className="reg-mancha reg-mancha-1" aria-hidden />
      <span className="reg-mancha reg-mancha-2" aria-hidden />

      <div className="reg-top">
        <Link href="/" className="reg-top-volver">
          <ArrowLeft size={15} strokeWidth={2.4} aria-hidden />
          Volver
        </Link>
        <Link href="/sign-in">Ya tengo cuenta</Link>
      </div>

      <section className="reg-card">
        <div className="reg-cabeza">
          <span className="reg-burbuja" aria-hidden>
            <Image src="/brand/isologo-icon.png" alt="" width={34} height={34} />
          </span>
          <p className="reg-kicker">
            <Sparkles size={13} strokeWidth={2.4} aria-hidden />
            Crear cuenta
          </p>
        </div>
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
          Al crear la cuenta aceptás las{" "}
          <Link href="/legal/condiciones" target="_blank">Condiciones de contratación</Link>{" "}
          y leíste la{" "}
          <Link href="/legal/privacidad" target="_blank">Política de privacidad</Link>.
          El plan se cobra después de los 7 días de prueba, y podés cancelarlo
          cuando quieras.
        </p>
      </section>

      {/* Los estilos viven en app/estilos/acceso.css (bloque "Registro"). */}
    </main>
  );
}
