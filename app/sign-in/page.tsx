import Image from "next/image";
import Link from "next/link";
import { SignInForm } from "@/components/sign-in-form";
import { LanguageSwitcher, T, TLines } from "@/components/language-provider";
import type { PublicMessageKey } from "@/src/i18n/public";

const authFeatures = [
  { label: "auth.feature1.label", desc: "auth.feature1.desc" },
  { label: "auth.feature2.label", desc: "auth.feature2.desc" },
  { label: "auth.feature3.label", desc: "auth.feature3.desc" },
] as const;

type SignInPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const params = (await searchParams) ?? {};
  const error = typeof params.error === "string" ? params.error : null;
  const success = typeof params.success === "string" ? params.success : null;
  const callbackUrl = typeof params.callbackUrl === "string" ? params.callbackUrl : null;

  return (
    <main className="auth-page">
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
        <div className="auth-logo-figure" aria-hidden>
          <Image src="/brand/isologo-icon.png" alt="" fill priority sizes="44vw" style={{ objectFit: "contain" }} />
        </div>

        <div className="auth-left-copy">
          <h1>
            <TLines id="auth.left.title" />
          </h1>
          <p>
            <T id="auth.left.description" />
          </p>

          <div className="auth-feature-list">
            {authFeatures.map((feature) => (
              <div key={feature.label}>
                <span />
                <strong>
                  <T id={feature.label as PublicMessageKey} />
                </strong>
                <small>
                  <T id={feature.desc as PublicMessageKey} />
                </small>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="auth-right" aria-label="Formulario de ingreso">
        <div className="auth-card">
          <p className="auth-kicker">
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

      <style>{`
        .auth-page {
          position: fixed;
          inset: 0;
          width: 100%;
          height: 100dvh;
          max-height: 100dvh;
          overflow: hidden;
          display: grid;
          grid-template-columns: minmax(0, 0.9fr) minmax(420px, 1.1fr);
          background: #fff;
        }

        html:has(.auth-page),
        body:has(.auth-page) {
          height: 100%;
          overflow: hidden !important;
        }

        .auth-top-links {
          position: fixed;
          top: 1rem;
          right: 1rem;
          z-index: 5;
          display: flex;
          flex-wrap: wrap;
          justify-content: flex-end;
          gap: 0.55rem;
          max-width: min(92vw, 420px);
        }

        .auth-top-links a {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 36px;
          border: 1px solid #F4D5DF;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.86);
          color: #D92E72;
          padding: 0.45rem 0.85rem;
          font-size: 0.68rem;
          font-weight: 900;
          letter-spacing: 0.08em;
          text-decoration: none;
          text-transform: uppercase;
          box-shadow: 0 10px 26px rgba(217, 52, 56, 0.08);
          backdrop-filter: blur(12px);
        }

        .auth-top-links a:first-child {
          color: #9B8790;
        }

        .auth-left {
          position: relative;
          display: grid;
          place-items: center;
          overflow: hidden;
          border-right: 1px solid rgba(255, 218, 218, 0.95);
          background:
            radial-gradient(circle at 18% 9%, rgba(255, 255, 255, 0.75), transparent 30%),
            linear-gradient(145deg, #FCE8F0 0%, #FFF6FA 64%, #FFFDFE 100%);
          padding: clamp(2rem, 5vw, 5rem);
        }

        .auth-logo-figure {
          position: absolute;
          inset: 4% -9% -2% 18%;
          opacity: 0.2;
          filter: blur(1.2px);
          pointer-events: none;
        }

        .auth-left-copy {
          position: relative;
          z-index: 1;
          display: grid;
          justify-items: center;
          width: min(520px, 100%);
          text-align: center;
        }

        .auth-left h1 {
          margin: 0 0 1.55rem;
          color: #191417;
          font-family: var(--font-display), sans-serif;
          font-size: clamp(4rem, 7vw, 5.5rem);
          font-style: italic;
          font-weight: 700;
          letter-spacing: -0.055em;
          line-height: 0.86;
        }

        .auth-left p {
          max-width: 44ch;
          margin: 0;
          color: #7D6A72;
          font-size: 0.94rem;
          line-height: 1.9;
        }

        .auth-feature-list {
          display: grid;
          gap: 1rem;
          width: min(420px, 100%);
          margin-top: 2.5rem;
          text-align: left;
        }

        .auth-feature-list div {
          display: grid;
          grid-template-columns: auto auto 1fr;
          gap: 0.75rem;
          align-items: center;
        }

        .auth-feature-list span {
          width: 5px;
          height: 5px;
          border-radius: 999px;
          background: #E64F88;
        }

        .auth-feature-list strong {
          color: #1F1A1D;
          font-size: 0.76rem;
          font-weight: 900;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }

        .auth-feature-list small {
          color: #9B8790;
          font-size: 0.78rem;
          line-height: 1.35;
        }

        .auth-right {
          display: grid;
          place-items: center;
          overflow: hidden;
          background: rgba(255, 255, 255, 0.96);
          padding: clamp(1.1rem, 3vw, 3rem);
        }

        .auth-card {
          width: min(400px, 100%);
          max-height: calc(100dvh - 3rem);
        }

        .auth-kicker {
          margin: 0 0 0.8rem;
          color: #D92E72;
          font-size: 0.65rem;
          font-weight: 900;
          letter-spacing: 0.3em;
          text-transform: uppercase;
        }

        .auth-card h2 {
          margin: 0 0 0.85rem;
          color: #191417;
          font-family: var(--font-display), sans-serif;
          font-size: clamp(2.7rem, 5vw, 3.45rem);
          font-style: italic;
          font-weight: 700;
          letter-spacing: -0.045em;
          line-height: 0.96;
        }

        .auth-description {
          margin: 0 0 1.45rem;
          color: #9B8790;
          font-size: 0.88rem;
          line-height: 1.68;
        }

        .auth-links {
          display: flex;
          flex-wrap: wrap;
          gap: 0.2rem 0.55rem;
          align-items: center;
          margin-top: 1.05rem;
        }

        .auth-links span,
        .auth-links a {
          color: #B39EAA;
          font-size: 0.76rem;
          text-decoration: none;
        }

        .auth-links a:first-of-type {
          color: #D92E72;
          font-weight: 800;
        }

        @media (max-height: 760px) and (min-width: 901px) {
          .auth-left h1 {
            font-size: clamp(3.5rem, 6vw, 4.55rem);
            margin-bottom: 1rem;
          }

          .auth-left p {
            line-height: 1.65;
          }

          .auth-feature-list {
            margin-top: 1.25rem;
            gap: 0.65rem;
          }

          .auth-description {
            margin-bottom: 1.35rem;
            line-height: 1.55;
          }

          .auth-card h2 {
            font-size: clamp(2.35rem, 4vw, 3rem);
          }
        }

        @media (max-width: 900px) {
          .auth-page {
            grid-template-columns: 1fr;
          }

          .auth-left {
            display: none;
          }

          .auth-right {
            height: 100dvh;
            align-items: start;
            padding: 4.9rem 1rem 1rem;
            background:
              radial-gradient(circle at 50% 10%, rgba(252, 231, 243, 0.85), transparent 34%),
              #fff;
          }

          .auth-card {
            width: 100%;
            max-width: 390px;
            max-height: none;
            margin: 0 auto;
          }
        }

        @media (max-width: 520px) {
          .auth-top-links {
            left: 0.65rem;
            right: 0.65rem;
            justify-content: center;
            gap: 0.38rem;
          }

          .auth-top-links a {
            min-height: 32px;
            padding: 0.38rem 0.62rem;
            font-size: 0.58rem;
            letter-spacing: 0.06em;
          }

          .auth-card h2 {
            font-size: clamp(2.15rem, 11vw, 2.85rem);
          }

          .auth-description {
            font-size: 0.82rem;
          }
        }

        @media (max-height: 680px) {
          .auth-top-links {
            top: 0.65rem;
            right: 0.65rem;
          }

          .auth-card h2 {
            margin-bottom: 0.55rem;
            font-size: clamp(2.1rem, 4vw, 2.6rem);
          }

          .auth-kicker {
            margin-bottom: 0.5rem;
          }

          .auth-description {
            margin-bottom: 0.9rem;
            font-size: 0.82rem;
            line-height: 1.48;
          }

          .auth-links {
            margin-top: 0.75rem;
          }
        }
      `}</style>
    </main>
  );
}
