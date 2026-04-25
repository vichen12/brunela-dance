"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";

const links = [
  { href: "/#clases", label: "Clases" },
  { href: "/#sobre", label: "Sobre mi" },
  { href: "/#planes", label: "Planes" },
] as const;

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

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

  return (
    <>
      <header
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
          background: menuOpen ? "rgba(255,255,255,0.98)" : scrolled ? "rgba(255,255,255,0.94)" : "rgba(255,255,255,0.78)",
          backdropFilter: "blur(22px)",
          borderBottom: scrolled ? "1px solid #FFDADA" : "1px solid rgba(255,218,218,0.7)",
          boxShadow: scrolled ? "0 2px 24px rgba(217,52,56,0.08)" : "none",
          transition: "background 350ms, box-shadow 350ms, border-color 350ms",
        }}
      >
        <Link href="/" onClick={close} aria-label="Brunela Dance Trainer" style={{ display: "flex", alignItems: "center", textDecoration: "none", flexShrink: 0 }}>
          <div style={{ width: 34, height: 48, position: "relative", flexShrink: 0 }}>
            <Image src="/brand/isologo-color.png" alt="Brunela Dance Trainer" fill priority style={{ objectFit: "contain", objectPosition: "center" }} />
          </div>
        </Link>

        <nav className="landing-nav-links" style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", display: "flex", alignItems: "center", gap: "0.15rem" }}>
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
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="landing-nav-links" style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginLeft: "auto" }}>
          <Link href="/sign-in" className="nav-button nav-button-ghost">
            Ingresar
          </Link>
          <Link href="/#planes" className="nav-button nav-button-solid">
            Ver planes
          </Link>
        </div>

        <div className="landing-mobile-nav" style={{ display: "none", alignItems: "center", gap: "0.4rem", marginLeft: "auto", minWidth: 0 }}>
          <Link href="/sign-in" className="nav-button nav-button-solid">
            Ingresar
          </Link>
          <button
            onClick={() => setMenuOpen((open) => !open)}
            aria-label={menuOpen ? "Cerrar menu" : "Abrir menu"}
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
            {link.label}
          </Link>
        ))}
        <Link href="/#planes" onClick={close} className="nav-button nav-button-solid" style={{ marginTop: "1.25rem" }}>
          Ver planes
        </Link>
      </div>

      {menuOpen && <div onClick={close} style={{ position: "fixed", inset: 0, zIndex: 9997, background: "rgba(217,52,56,0.12)" }} />}

      <style>{`
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
        @media (max-width: 639px) {
          .landing-nav-links { display: none !important; }
          .landing-mobile-nav { display: flex !important; }
          .nav-button {
            min-height: 36px;
            padding: 0.46rem 0.82rem;
            font-size: 0.62rem;
            letter-spacing: 0.07em;
          }
        }
        @media (max-width: 360px) {
          .landing-mobile-nav .nav-button {
            display: none;
          }
        }
      `}</style>
    </>
  );
}
