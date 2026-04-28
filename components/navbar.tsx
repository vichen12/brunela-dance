"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { BrandLockup } from "@/components/brand-lockup";
import {
  LanguageSwitcher,
  usePublicI18n,
} from "@/components/language-provider";
import type { PublicMessageKey } from "@/src/i18n/public";

const links = [
  { href: "/#clases", label: "nav.classes" },
  { href: "/#sobre", label: "nav.about" },
  { href: "/#planes", label: "nav.plans" },
] as const;

export function Navbar() {
  const pathname = usePathname();
  const { t } = usePublicI18n();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const isAuthPage = pathname?.startsWith("/sign-in");

  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 40);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  const close = () => setMenuOpen(false);

  if (isAuthPage) {
    return null;
  }

  return (
    <>
      <header
        className="site-header"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 9999,
          height: 66,
          display: "flex",
          alignItems: "center",
          padding: "0 clamp(0.75rem, 4vw, 2.5rem)",
          background: menuOpen
            ? "rgba(255,255,255,0.98)"
            : scrolled
              ? "rgba(255,255,255,0.94)"
              : "rgba(255,255,255,0.78)",
          backdropFilter: "blur(22px)",
          borderBottom: scrolled
            ? "1px solid #FFDADA"
            : "1px solid rgba(255,218,218,0.7)",
          boxShadow: scrolled ? "0 2px 24px rgba(217,52,56,0.08)" : "none",
          transition: "background 350ms, box-shadow 350ms, border-color 350ms",
        }}
      >
        <BrandLockup href="/" compact markOnly className="navbar-brand" />

        <nav
          className="landing-nav-links"
          style={{
            position: "absolute",
            left: "50%",
            transform: "translateX(-50%)",
            display: "flex",
            alignItems: "center",
            gap: "0.15rem",
          }}
        >
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              style={{
                padding: "0.45rem 0.9rem",
                borderRadius: 999,
                color: "#D93438",
                fontSize: "0.7rem",
                fontWeight: 800,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                textDecoration: "none",
              }}
            >
              {t(link.label as PublicMessageKey)}
            </Link>
          ))}
        </nav>

        <div
          className="landing-nav-links"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            marginLeft: "auto",
          }}
        >
          <LanguageSwitcher compact />
          <Link href="/sign-in" className="nav-button nav-button-ghost">
            {t("nav.signIn")}
          </Link>
          <Link href="/#planes" className="nav-button nav-button-solid">
            {t("nav.viewPlans")}
          </Link>
        </div>

        <div
          className="mobile-language-selector"
          style={{
            display: "none",
            alignItems: "center",
          }}
        >
          <LanguageSwitcher compact />
        </div>

        <div
          className="landing-mobile-nav"
          style={{
            display: "none",
            alignItems: "center",
            gap: "0.4rem",
            marginLeft: "auto",
            minWidth: 0,
          }}
        >
          <Link
            href="/sign-in"
            className="nav-button nav-button-solid mobile-signin-button"
          >
            {t("nav.signIn")}
          </Link>
          <button
            onClick={() => setMenuOpen((open) => !open)}
            aria-label={menuOpen ? t("nav.closeMenu") : t("nav.openMenu")}
            style={{
              width: 36,
              height: 36,
              border: "1px solid #EB7478",
              borderRadius: 8,
              background: "#FFDADA",
              color: "#D93438",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 0,
              cursor: "pointer",
            }}
          >
            {menuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </header>

      <button
        className="mobile-floating-menu"
        onClick={() => setMenuOpen((open) => !open)}
        aria-label={menuOpen ? t("nav.closeMenu") : t("nav.openMenu")}
      >
        {menuOpen ? <X size={18} /> : <Menu size={18} />}
      </button>

      <div
        style={{
          position: "fixed",
          top: 66,
          left: 0,
          right: 0,
          zIndex: 9998,
          display: "flex",
          flexDirection: "column",
          padding: "0.75rem 1.5rem 2rem",
          background: "rgba(255,255,255,0.98)",
          backdropFilter: "blur(24px)",
          borderBottom: "1px solid #FFDADA",
          boxShadow: "0 12px 40px rgba(217,52,56,0.1)",
          transform: menuOpen ? "translateY(0)" : "translateY(-110%)",
          transition: "transform 300ms cubic-bezier(0.22,1,0.36,1)",
        }}
      >
        <div className="mobile-drawer-language">
          <LanguageSwitcher compact />
        </div>
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            onClick={close}
            style={{
              display: "block",
              padding: "1rem 0.25rem",
              borderBottom: "1px solid #FFDADA",
              color: "#D93438",
              fontSize: "0.82rem",
              fontWeight: 800,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              textDecoration: "none",
            }}
          >
            {t(link.label as PublicMessageKey)}
          </Link>
        ))}
        <Link
          href="/sign-in"
          onClick={close}
          className="nav-button nav-button-ghost mobile-drawer-signin"
          style={{ marginTop: "1.25rem" }}
        >
          {t("nav.signIn")}
        </Link>
        <Link
          href="/#planes"
          onClick={close}
          className="nav-button nav-button-solid"
          style={{ marginTop: "1.25rem" }}
        >
          {t("nav.viewPlans")}
        </Link>
      </div>

      {menuOpen && (
        <div
          onClick={close}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9997,
            background: "rgba(217,52,56,0.12)",
          }}
        />
      )}

      <style>{`
        .site-header {
          max-width: 100vw;
          overflow: hidden;
          box-sizing: border-box;
        }
        .nav-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 38px;
          border-radius: 999px;
          padding: 0.48rem 1.05rem;
          font-size: 0.68rem;
          font-weight: 900;
          letter-spacing: 0.11em;
          text-transform: uppercase;
          text-decoration: none;
          white-space: nowrap;
        }
        .nav-button-solid {
          background: #E64F55;
          color: #fff;
          box-shadow: 0 4px 16px rgba(230,79,85,0.28);
        }
        .nav-button-ghost {
          border: 1.5px solid #FFDADA;
          color: #D93438;
          background: transparent;
        }
        .mobile-floating-menu {
          display: none;
        }
        .mobile-language-selector {
          display: none;
        }
        @media (max-width: 639px) {
          .mobile-language-selector {
            display: flex !important;
            margin-left: 0.4rem;
          }
          .landing-nav-links { display: none !important; }
          .landing-mobile-nav { display: flex !important; }
          .landing-mobile-nav {
            position: absolute;
            top: 50%;
            right: 0.58rem;
            margin-left: 0 !important;
            transform: translateY(-50%);
          }
          .site-header {
            padding-inline: 0.58rem !important;
          }
          .navbar-brand {
            max-width: 34px;
            overflow: hidden;
            transform: none;
            transform-origin: left center;
          }
          .navbar-brand > div:first-child {
            width: 34px !important;
            height: 34px !important;
          }
          .navbar-brand > div:nth-child(2) {
            display: none !important;
          }
          .landing-mobile-nav {
            flex-shrink: 0;
            min-width: max-content !important;
          }
          .landing-mobile-nav > button {
            display: none !important;
          }
          .mobile-floating-menu {
            position: fixed;
            top: 15px;
            right: 0.58rem;
            z-index: 10001;
            width: 36px;
            height: 36px;
            border: 1px solid #EB7478;
            border-radius: 8px;
            background: #FFDADA;
            color: #D93438;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 0;
            cursor: pointer;
          }
          .nav-button {
            min-height: 36px;
            padding: 0.46rem 0.82rem;
            font-size: 0.62rem;
            letter-spacing: 0.07em;
          }
        }
        @media (max-width: 520px) {
          .landing-mobile-nav .mobile-signin-button {
            display: none;
          }
        }
        @media (max-width: 390px) {
          .navbar-brand {
            max-width: 30px;
          }
          .navbar-brand > div:first-child {
            width: 30px !important;
            height: 30px !important;
          }
          .navbar-brand > div:nth-child(2) {
            display: none !important;
          }
        }
        .mobile-drawer-language {
          display: none;
        }
        @media (max-width: 639px) {
          .mobile-drawer-language {
            display: flex;
            justify-content: center;
            padding: 0.35rem 0 0.9rem;
            border-bottom: 1px solid #FFDADA;
          }
        }
      `}</style>
    </>
  );
}
