import Image from "next/image";
import Link from "next/link";
import { BookOpen, Radio, Sparkles, TrendingUp } from "lucide-react";
import { SignInForm } from "@/components/sign-in-form";
import { LanguageSwitcher, T, TLines } from "@/components/language-provider";
import type { PublicMessageKey } from "@/src/i18n/public";
import { CuentaRegresiva, FechaDeApertura } from "@/components/cuenta-regresiva";
import { fechaDeApertura } from "@/src/lib/acceso-anticipado";

/*
 * El icono de cada rasgo se elige por indice y se dibuja ACA, en el servidor.
 * No viaja como prop a ningun componente de cliente (trampa 6 de CLAUDE.md).
 */
const authFeatures = [
  { label: "auth.feature1.label", desc: "auth.feature1.desc" },
  { label: "auth.feature2.label", desc: "auth.feature2.desc" },
  { label: "auth.feature3.label", desc: "auth.feature3.desc" },
] as const;

function IconoRasgo({ indice }: { indice: number }) {
  if (indice === 0) return <BookOpen size={18} strokeWidth={2.1} />;
  if (indice === 1) return <TrendingUp size={18} strokeWidth={2.1} />;
  return <Radio size={18} strokeWidth={2.1} />;
}

type SignInPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SignInPage({ searchParams }: SignInPageProps) {
  // Mientras el estudio no abra, el ingreso muestra cuanto falta (lo pidio la
  // duena: "falta el contador"). Pasada la fecha, desaparece solo.
  const apertura = fechaDeApertura();
  const faltaAbrir = apertura.getTime() > Date.now();
  const params = (await searchParams) ?? {};
  const error = typeof params.error === "string" ? params.error : null;
  const success = typeof params.success === "string" ? params.success : null;
  const callbackUrl = typeof params.callbackUrl === "string" ? params.callbackUrl : null;

  return (
    <main className="auth-page sistema">
      <div className="auth-top-links">
        <LanguageSwitcher compact />
        <Link href="/" suppressHydrationWarning>
          <T id="auth.top.home" />
        </Link>
        <Link href="/#planes" suppressHydrationWarning>
          <T id="auth.top.plans" />
        </Link>
      </div>

      <section className="auth-left" aria-label="Bienvenida al estudio">
        <span className="auth-mancha auth-mancha-1" aria-hidden />
        <span className="auth-mancha auth-mancha-2" aria-hidden />
        <div className="auth-logo-figure" aria-hidden>
          <Image src="/brand/isologo-icon.png" alt="" fill priority sizes="44vw" style={{ objectFit: "contain" }} />
        </div>

        <div className="auth-left-copy">
          <span className="auth-left-burbuja" aria-hidden>
            <Image src="/brand/isologo-icon.png" alt="" width={44} height={44} />
          </span>
          <h1>
            <TLines id="auth.left.title" />
          </h1>
          <p>
            <T id="auth.left.description" />
          </p>

          <div className="auth-feature-list">
            {authFeatures.map((feature, indice) => (
              <div key={feature.label}>
                <span aria-hidden>
                  <IconoRasgo indice={indice} />
                </span>
                <strong>
                  <T id={feature.label as PublicMessageKey} />
                </strong>
                <small>
                  <T id={feature.desc as PublicMessageKey} />
                </small>
              </div>
            ))}
          </div>

          {faltaAbrir && (
            <div className="auth-cuenta">
              <p className="auth-cuenta-titulo">
                <T id="puerta.title" />{" "}
                <span><FechaDeApertura objetivoISO={apertura.toISOString()} /></span>
              </p>
              <CuentaRegresiva objetivoISO={apertura.toISOString()} />
            </div>
          )}
        </div>
      </section>

      <section className="auth-right" aria-label="Formulario de ingreso">
        <div className="auth-card">
          {/* En pantallas chicas el panel de la izquierda no se ve: el contador
              va arriba del formulario. */}
          {faltaAbrir && (
            <div className="auth-cuenta auth-cuenta--movil">
              <p className="auth-cuenta-titulo">
                <T id="puerta.title" />{" "}
                <span><FechaDeApertura objetivoISO={apertura.toISOString()} /></span>
              </p>
              <CuentaRegresiva objetivoISO={apertura.toISOString()} />
            </div>
          )}
          <p className="auth-kicker">
            <Sparkles size={13} strokeWidth={2.4} aria-hidden />
            <T id="auth.kicker" />
          </p>
          <h2>
            <T id="auth.title" />
          </h2>
          <p className="auth-description">
            <T id="auth.description" />
          </p>

          <SignInForm error={error} success={success} callbackUrl={callbackUrl} />

          <div className="auth-links">
            <span>
              <T id="auth.notMember" />
            </span>
            <Link href="/#planes">
              <T id="auth.top.plans" />
            </Link>
            <span>&middot;</span>
            <Link href="/">
              <T id="auth.home" />
            </Link>
          </div>
        </div>
      </section>

      {/* Los estilos viven en app/estilos/acceso.css (bloque "Ingreso"). */}
    </main>
  );
}
