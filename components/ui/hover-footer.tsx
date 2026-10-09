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

  /*
   * Rediseño "suave y calido" (2026-10-08): fuera las olas de rosa fuerte. El
   * pie es una tarjeta grande crema/rubor con manchas melocoton, la marca en
   * burbuja como en la barra de arriba, la navegacion en pildoras y las redes
   * en burbujas. Estilos en app/estilos/acceso.css (bloque "Pie").
   */
  return (
    <footer className="brand-footer">
      <span className="footer-mancha footer-mancha-1" aria-hidden />
      <span className="footer-mancha footer-mancha-2" aria-hidden />

      <div className="footer-tarjeta">
        <div className="footer-main">
          <Link href="/" className="footer-marca" aria-label="Brunela Dance Trainer" suppressHydrationWarning>
            <span className="footer-marca-ico" aria-hidden>
              <Image src="/brand/isologo-icon.png" alt="" width={40} height={40} />
            </span>
            <span className="footer-marca-txt" aria-hidden>
              <strong>Brunela</strong>
              <small>{t("footer.subtitle")}</small>
            </span>
          </Link>

          {/* Disciplinas y lugar en una sola linea: son dos datos cortos y en
              dos renglones separados competian con la marca de arriba. */}
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

          <div className="footer-regla" aria-hidden>
            <span className="footer-regla-linea" />
            <Sparkle size={13} strokeWidth={0} fill="currentColor" />
            <span className="footer-regla-linea" />
          </div>

          {/* El correo, VISIBLE y no solo detras del enlace "Contacto": alguien
              que quiere escribir desde el movil suele copiarlo, no pulsar un
              mailto. Va antes de las redes porque es el canal directo. */}
          <a className="footer-mail" href={`mailto:${EMAIL}`}>
            <span className="footer-mail-ico" aria-hidden>
              <Mail size={15} strokeWidth={2} />
            </span>
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
      </div>

      <div className="footer-bottom">
        <span>{t("footer.copyright")}</span>
      </div>
    </footer>
  );
}
