"use client";

import Image from "next/image";
import Link from "next/link";

const studioLinks = [
  { label: "Clases", href: "/#clases" },
  { label: "Sobre mi", href: "/#sobre" },
  { label: "Planes", href: "/#planes" },
] as const;

const accessLinks = [
  { label: "Ingresar", href: "/sign-in" },
  { label: "Mi dashboard", href: "/dashboard" },
] as const;

const LINK_COLOR = "#D93438";
const LINK_HOVER = "#E64F55";
const MUTED = "#EB7478";

function FLink({ href, children, external }: { href: string; children: React.ReactNode; external?: boolean }) {
  return (
    <a
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noreferrer" : undefined}
      style={{ fontSize: "0.88rem", color: LINK_COLOR, textDecoration: "none", transition: "color 150ms" }}
      onMouseOver={(event) => {
        event.currentTarget.style.color = LINK_HOVER;
      }}
      onMouseOut={(event) => {
        event.currentTarget.style.color = LINK_COLOR;
      }}
    >
      {children}
    </a>
  );
}

export function BrunelaFooter() {
  return (
    <footer
      style={{
        background: "linear-gradient(180deg, #fff 0%, #FFDADA 100%)",
        borderTop: "1px solid #FFDADA",
        color: LINK_COLOR,
        padding: "clamp(3rem,6vw,5rem) clamp(1.25rem,5vw,3rem) 0",
      }}
    >
      <style>{`
        .footer-grid {
          display: grid;
          grid-template-columns: 2fr 1fr 1fr 1.2fr;
          gap: 3rem;
        }
        @media (max-width: 767px) {
          .footer-grid { grid-template-columns: 1fr 1fr; gap: 2rem 1.5rem; }
          .footer-brand { grid-column: 1 / -1; }
        }
        @media (max-width: 480px) {
          .footer-grid { grid-template-columns: 1fr; gap: 1.75rem; }
          .footer-brand { grid-column: auto; }
        }
      `}</style>

      <div
        className="footer-grid"
        style={{
          maxWidth: 1100,
          margin: "0 auto",
          paddingBottom: "3.5rem",
          borderBottom: "1px solid #EB7478",
        }}
      >
        <div className="footer-brand">
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: "0.65rem", textDecoration: "none", marginBottom: "1.25rem" }}>
            <Image src="/brand/isologo-icon.png" alt="Brunela Dance Trainer" width={46} height={46} style={{ objectFit: "contain" }} />
            <p style={{ fontFamily: "var(--font-display,sans-serif)", fontSize: "1.15rem", fontWeight: 900, lineHeight: 1.1, color: "#D93438", margin: 0, textTransform: "uppercase" }}>
              Brunela Dance Trainer
            </p>
          </Link>

          <p style={{ fontSize: "0.88rem", lineHeight: 1.8, maxWidth: "30ch", color: "#D93438" }}>
            Pilates y conditioning para bailarines. Estudio Online con clases, planes y sesiones en vivo.
          </p>

          <div style={{ marginTop: "1.5rem", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            {["PBT", "PCT", "Pilates", "RAD"].map((tag) => (
              <span
                key={tag}
                style={{
                  borderRadius: 999,
                  background: "#fff",
                  color: "#D93438",
                  border: "1px solid #EB7478",
                  fontSize: "0.58rem",
                  fontWeight: 900,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  padding: "0.3rem 0.72rem",
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        </div>

        <div>
          <p style={{ fontSize: "0.6rem", fontWeight: 900, letterSpacing: "0.22em", textTransform: "uppercase", color: MUTED, marginBottom: "1.4rem" }}>
            Estudio
          </p>
          <ul style={{ display: "grid", gap: "0.9rem", listStyle: "none", padding: 0, margin: 0 }}>
            {studioLinks.map((link) => (
              <li key={link.label}>
                <FLink href={link.href}>{link.label}</FLink>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p style={{ fontSize: "0.6rem", fontWeight: 900, letterSpacing: "0.22em", textTransform: "uppercase", color: MUTED, marginBottom: "1.4rem" }}>
            Acceso
          </p>
          <ul style={{ display: "grid", gap: "0.9rem", listStyle: "none", padding: 0, margin: 0 }}>
            {accessLinks.map((link) => (
              <li key={link.label}>
                <FLink href={link.href}>{link.label}</FLink>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p style={{ fontSize: "0.6rem", fontWeight: 900, letterSpacing: "0.22em", textTransform: "uppercase", color: MUTED, marginBottom: "1.4rem" }}>
            Contacto
          </p>
          <div style={{ display: "grid", gap: "1rem" }}>
            <FLink href="mailto:hola@brunela.com">hola@brunela.com</FLink>
            <FLink href="https://instagram.com/brunela.dance" external>
              @brunela.dance
            </FLink>
            <p style={{ fontSize: "0.88rem", color: MUTED, margin: 0 }}>Online</p>
          </div>
        </div>
      </div>

      <div
        style={{
          maxWidth: 1100,
          margin: "0 auto",
          paddingTop: "1.5rem",
          paddingBottom: "2rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "0.75rem",
        }}
      >
        <span style={{ fontSize: "0.75rem", color: MUTED }}>&copy; {new Date().getFullYear()} Brunela Dance Trainer</span>
        <a
          href="https://instagram.com/dallapesystems"
          target="_blank"
          rel="noreferrer"
          style={{ fontSize: "0.72rem", color: MUTED, textDecoration: "none", letterSpacing: "0.04em", transition: "color 150ms" }}
          onMouseOver={(event) => {
            event.currentTarget.style.color = "#E64F55";
          }}
          onMouseOut={(event) => {
            event.currentTarget.style.color = MUTED;
          }}
        >
          Hecho por DallapeSystems
        </a>
      </div>
    </footer>
  );
}
