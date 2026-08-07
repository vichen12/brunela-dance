"use client";

import Link from "next/link";

import Image from "next/image";
import { Mail, Sparkle } from "lucide-react";
import {
  FaFacebookF,
  FaInstagram,
  FaTiktok,
  FaYoutube,
} from "react-icons/fa";
import { usePublicI18n } from "@/components/language-provider";
import type { PublicMessageKey } from "@/src/i18n/public";

/**
 * Correo de contacto del estudio.
 *
 * ⚠️ EN UN SOLO SITIO A PROPOSITO. Lo usan el enlace "Contacto" del menu y el
 *    correo visible de abajo. Escritos por separado, el dia que cambie uno se
 *    queda el otro y nadie se entera: un mailto roto no da error, simplemente
 *    abre el cliente de correo con una direccion a la que no llega nada.
 *
 * Hasta el 2026-08-07 decia `hola@brunela.com` -- un dominio que no es del
 * estudio (el suyo es bruneladance.com), asi que ese correo no llegaba a nadie.
 */
const EMAIL = "info@bruneladance.com";

const navLinks = [
  { label: "footer.nav.home", href: "/" },
  { label: "footer.nav.classes", href: "/#clases" },
  { label: "footer.nav.studio", href: "/#planes" },
  { label: "footer.nav.contact", href: `mailto:${EMAIL}` },
] as const;

const socialLinks = [
  { label: "Instagram", href: "https://www.instagram.com/brunela.dance/", icon: FaInstagram },
  { label: "TikTok",    href: "https://www.tiktok.com/@brunela.dance",     icon: FaTiktok   },
  { label: "YouTube",   href: "https://www.youtube.com/@brunela.dancetrainer", icon: FaYoutube },
  { label: "Facebook",  href: "https://www.facebook.com/brunela.dance",    icon: FaFacebookF },
] as const;

export function BrunelaFooter() {
  const { t } = usePublicI18n();

  return (
    <footer className="brand-footer">
      {/* ── Layered wave transition ── */}
      <div className="footer-waves" aria-hidden>
        {/* Wave 3 — lightest, lowest, behind */}
        <svg
          className="fw fw3"
          viewBox="0 0 1440 160"
          preserveAspectRatio="none"
        >
          <path d="M0 0 L1440 0 L1440 136 C1200 108 960 150 720 128 C480 106 240 148 0 132 Z" />
        </svg>
        {/* Wave 2 — medium tone */}
        <svg
          className="fw fw2"
          viewBox="0 0 1440 160"
          preserveAspectRatio="none"
        >
          <path d="M0 0 L1440 0 L1440 96 C1200 70 960 112 720 88 C480 64 240 106 0 92 Z" />
        </svg>
        {/* Wave 1 — darkest, shortest, in front */}
        <svg
          className="fw fw1"
          viewBox="0 0 1440 160"
          preserveAspectRatio="none"
        >
          <path d="M0 0 L1440 0 L1440 58 C1200 35 960 72 720 50 C480 28 240 66 0 55 Z" />
        </svg>
      </div>

      <div className="footer-main">
        <div className="footer-logo">
          <Image
            src="/brand/brunela-dance-trainer-wordmark.png"
            alt="Brunela Dance Trainer"
            fill
            sizes="(max-width: 720px) 78vw, 720px"
            style={{ objectFit: "contain" }}
          />
        </div>
        {/* Disciplinas y lugar en una sola linea: son dos datos cortos y en dos
            renglones separados competian con el logo que va justo encima. */}
        <p className="footer-services">
          {t("footer.services")}
          <span className="footer-sep" aria-hidden>
            ·
          </span>
          {t("footer.place")}
        </p>

        <nav className="footer-nav" aria-label="Footer navigation">
          {navLinks.map((link) => (
            <Link href={link.href} key={link.label} suppressHydrationWarning>
              {t(link.label as PublicMessageKey)}
            </Link>
          ))}
        </nav>

        {/* Filete con destello, como en la maqueta. Decorativo: separa la
            navegacion de las redes sin meter otro bloque de texto. */}
        <div className="footer-regla" aria-hidden>
          <span className="footer-regla-linea" />
          <Sparkle size={13} strokeWidth={0} fill="currentColor" />
          <span className="footer-regla-linea" />
        </div>

        {/* El correo, VISIBLE y no solo detras del enlace "Contacto": alguien
            que quiere escribir desde el movil suele copiarlo, no pulsar un
            mailto. Va antes de las redes porque es el canal directo. */}
        <a className="footer-mail" href={`mailto:${EMAIL}`}>
          <Mail size={15} strokeWidth={1.9} aria-hidden />
          {EMAIL}
        </a>

        <div className="footer-socials">
          {socialLinks.map(({ label, href, icon: Icon }) => (
            <Link
              href={href}
              key={label}
              target="_blank"
              rel="noreferrer"
              aria-label={label}
              suppressHydrationWarning
            >
              <Icon />
            </Link>
          ))}
        </div>
      </div>

      <div className="footer-bottom">
        <span>{t("footer.copyright")}</span>
        <a
          href="https://www.linkedin.com/in/vincenzo-dallape/"
          target="_blank"
          rel="noreferrer"
          suppressHydrationWarning
        >
          {t("footer.designed")} <strong>Vincenzo Dallape</strong>
        </a>
      </div>


      <style>{`
        /* ── Footer shell ── */
        .brand-footer {
          position: relative;
          overflow: hidden;
          background: #FFF0F6;
          color: #8F6672;
          padding: 0;
        }

        /* ── Wave stack ── */
        .footer-waves {
          position: relative;
          width: 100%;
          height: 160px;
          /* Container bg = lightest (shows below all waves) */
          background: #FFF0F6;
        }

        .fw {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
        }

        /* Dark → medium → light, front to back */
        .fw1 { fill: #E8728C; z-index: 3; }
        .fw2 { fill: var(--rose); z-index: 2; }
        .fw3 { fill: #F8CFDA; z-index: 1; }

        /* ── Main content ── */
        .footer-main {
          position: relative;
          z-index: 2;
          display: grid;
          justify-items: center;
          max-width: 880px;
          margin: 0 auto;
          padding: 2rem 1.25rem 0;
          text-align: center;
        }

        .footer-logo {
          position: relative;
          width: min(720px, 82vw);
          aspect-ratio: 1060 / 306;
          margin: 0 0 1.2rem;
        }

        .footer-services {
          margin: 0;
          /* Era #9A6B77: 4.02:1 sobre el rosa del footer, por debajo del 4.5:1
             que exige un texto de 14.4px. --pink-muted pasa. */
          color: var(--pink-muted);
          font-size: 0.9rem;
          line-height: 1.5;
        }

        .footer-sep {
          margin: 0 0.5rem;
          opacity: 0.55;
        }

        /* Filete con destello entre la navegacion y las redes. */
        .footer-regla {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.9rem;
          width: min(760px, 82%);
          margin: 2.1rem auto 0;
          color: var(--pink);
        }

        .footer-regla-linea {
          flex: 1;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(230, 79, 85, 0.34), transparent);
        }

        .footer-place {
          margin: 0.3rem 0 0;
          color: var(--pink-muted);
          font-size: 0.82rem;
        }

        /* ── Nav ── */
        .footer-nav {
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: clamp(1.2rem, 3vw, 2.2rem);
          margin-top: 2.4rem;
        }

        .footer-nav a {
          color: var(--pink-muted);
          font-size: 0.72rem;
          font-weight: 900;
          letter-spacing: 0.2em;
          text-decoration: none;
          text-transform: uppercase;
          transition: color 160ms, transform 160ms;
        }

        .footer-nav a:hover {
          color: var(--pink-deep);
          transform: translateY(-1px);
        }

        /* ── Socials ── */
        .footer-mail {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          margin-top: 1.5rem;
          border: 1px solid rgba(230, 79, 85, 0.24);
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.6);
          padding: 0.5rem 1.05rem;
          /* --pink-deep sobre el rosa del footer: 5.66:1. --pink se quedaba en
             3.47:1 y esto son 13.6px, texto normal. */
          color: var(--pink-deep);
          font-size: 0.85rem;
          font-weight: 700;
          letter-spacing: 0.01em;
          text-decoration: none;
          transition: background 200ms ease, border-color 200ms ease;
        }

        .footer-mail:hover {
          border-color: var(--pink);
          background: #fff;
        }

        .footer-mail:focus-visible {
          outline: 2px solid var(--pink-deep);
          outline-offset: 3px;
        }

        @media (prefers-reduced-motion: reduce) {
          .footer-mail { transition: none; }
        }

        /* Separadores verticales entre iconos, como en la maqueta. */
        .footer-socials a + a::before {
          content: "";
          position: absolute;
          left: calc(-0.6rem - 1px);
          top: 50%;
          width: 1px;
          height: 18px;
          background: rgba(230, 79, 85, 0.28);
          transform: translateY(-50%);
        }

        .footer-socials a { position: relative; }

        .footer-socials {
          display: flex;
          justify-content: center;
          gap: 1.2rem;
          margin-top: 1.75rem;
        }

        .footer-socials a {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 30px;
          height: 30px;
          color: #D96882;
          font-size: 1.2rem;
          text-decoration: none;
          transition: color 160ms, transform 160ms;
        }

        .footer-socials a:hover {
          color: var(--pink-deep);
          transform: translateY(-2px);
        }

        /* ── Bottom bar ── */
        .footer-bottom {
          position: relative;
          z-index: 2;
          width: min(1080px, 100%);
          margin: 2rem auto 0;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 1rem;
          border-top: 1px solid rgba(208, 102, 124, 0.18);
          padding: 1.35rem 1.25rem 1.75rem;
          color: #A97784;
          font-size: 0.76rem;
        }

        .footer-bottom a {
          color: #A97784;
          text-decoration: none;
        }

        .footer-bottom strong {
          color: var(--pink-deep);
          font-weight: 900;
        }

        /* ── Floating buttons ── */
        .footer-floating {
          position: fixed;
          right: 1rem;
          bottom: 1rem;
          z-index: 60;
          display: grid;
          gap: 0.9rem;
          justify-items: center;
        }

        .footer-floating a {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 999px;
          color: #fff;
          text-decoration: none;
          box-shadow: 0 14px 34px rgba(200, 48, 80, 0.28);
          transition: transform 160ms, box-shadow 160ms;
        }

        .footer-floating a:hover {
          transform: translateY(-2px);
          box-shadow: 0 18px 40px rgba(200, 48, 80, 0.36);
        }

        .footer-float-whatsapp {
          width: 58px;
          height: 58px;
          border: 5px solid rgba(255,255,255,0.62);
          background: linear-gradient(135deg, #E15672, #C83054);
          font-size: 1.8rem;
        }

        /* ── Responsive ── */
        @media (max-width: 720px) {
          .footer-waves {
            height: 110px;
          }

          .footer-logo {
            width: min(86vw, 520px);
            margin-bottom: 0.9rem;
          }

          .footer-nav {
            gap: 0.8rem 1rem;
            margin-top: 1.7rem;
          }

          /* Separadores verticales entre iconos, como en la maqueta. */
        .footer-socials a + a::before {
          content: "";
          position: absolute;
          left: calc(-0.6rem - 1px);
          top: 50%;
          width: 1px;
          height: 18px;
          background: rgba(230, 79, 85, 0.28);
          transform: translateY(-50%);
        }

        .footer-socials a { position: relative; }

        .footer-socials {
            margin-top: 1.3rem;
          }

          .footer-bottom {
            display: grid;
            justify-items: center;
            text-align: center;
            margin-top: 1.4rem;
            padding: 1rem 0.9rem 1.4rem;
            font-size: 0.68rem;
          }

          .footer-floating {
            right: 0.75rem;
            bottom: 0.75rem;
          }
        }

        @media (max-width: 480px) {
          .footer-logo {
            width: min(88vw, 390px);
          }

          .footer-services {
            max-width: 28ch;
            font-size: 0.78rem;
          }

          .footer-nav a {
            font-size: 0.64rem;
            letter-spacing: 0.14em;
          }
        }
      `}</style>
    </footer>
  );
}
