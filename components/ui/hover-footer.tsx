"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
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

/**
 * Una ola PERIODICA: cuatro periodos identicos de 720 en un SVG de 2880. El
 * SVG mide el doble que la pantalla (dos olas por pantalla) y se corre -50%
 * en bucle; como la mitad son exactamente dos periodos, el final del
 * recorrido coincide con el principio y no se ve el salto.
 *
 * `y` es la altura media de la linea y `a` la amplitud: cada capa usa valores
 * distintos para que no ondulen al unisono.
 */
function caminoDeOla(y: number, a: number) {
  let d = `M0 ${y} `;
  for (let x = 0; x < 2880; x += 720) {
    d +=
      `C ${x + 180} ${y - a}, ${x + 180} ${y - a}, ${x + 360} ${y - a} ` +
      `S ${x + 540} ${y + a}, ${x + 720} ${y} `;
  }
  return `${d}L2880 200 L0 200 Z`;
}

const OLAS = [
  { clase: "fw3", d: caminoDeOla(70, 46), degrade: "ola-coral" },
  { clase: "fw2", d: caminoDeOla(108, 36), degrade: "ola-melocoton" },
  { clase: "fw1", d: caminoDeOla(146, 26), degrade: "ola-rubor" },
] as const;

export function BrunelaFooter() {
  const { t } = usePublicI18n();

  /*
   * Revelado del wordmark al entrar en pantalla.
   *
   * ⚠️ EL ESTADO BASE ES VISIBLE. Solo se esconde si JavaScript corrio Y el
   *    wordmark todavia no esta a la vista; el observador lo revela despues.
   *    Al reves (oculto por defecto en el CSS) un fallo de JS o una captura
   *    headless publicarian un pie sin marca.
   */
  const marcaRef = useRef<HTMLDivElement>(null);
  const [revelado, setRevelado] = useState<"base" | "esperando" | "visible">("base");

  useEffect(() => {
    const el = marcaRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const r = el.getBoundingClientRect();
    if (r.top < window.innerHeight && r.bottom > 0) return; // ya se ve: no esconder
    setRevelado("esperando");
    const obs = new IntersectionObserver(
      (entradas) => {
        if (entradas.some((e) => e.isIntersecting)) {
          setRevelado("visible");
          obs.disconnect();
        }
      },
      { threshold: 0.25 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  /*
   * Rediseño "suave y calido" (2026-10-09), sobre la composicion ORIGINAL que
   * pidio la dueña: ondas arriba, wordmark gigante, disciplinas, enlaces,
   * filete con destello, correo, redes y copyright. Las ondas pasan a capas en
   * degradé rubor / melocoton / coral palido que se mueven lento; el wordmark
   * es texto con degradé coral (no la imagen) para poder revelarlo y que
   * escale nitido. Estilos en app/estilos/acceso.css (bloque "Pie").
   */
  return (
    <footer className="brand-footer">
      <div className="footer-waves" aria-hidden>
        <svg width="0" height="0" className="footer-defs">
          <defs>
            <linearGradient id="ola-coral" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#F9CFC8" />
              <stop offset=".5" stopColor="#F6BDB6" />
              <stop offset="1" stopColor="#F9CFC8" />
            </linearGradient>
            <linearGradient id="ola-melocoton" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#FFE2D3" />
              <stop offset=".5" stopColor="#FFD6C4" />
              <stop offset="1" stopColor="#FFE2D3" />
            </linearGradient>
            <linearGradient id="ola-rubor" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#FFEDE7" />
              <stop offset="1" stopColor="#FFF4EF" />
            </linearGradient>
          </defs>
        </svg>
        {OLAS.map((ola) => (
          <svg key={ola.clase} className={`fw ${ola.clase}`} viewBox="0 0 2880 200" preserveAspectRatio="none">
            <path d={ola.d} fill={`url(#${ola.degrade})`} />
          </svg>
        ))}
      </div>

      <div className="footer-cuerpo">
        <span className="footer-mancha footer-mancha-1" aria-hidden />
        <span className="footer-mancha footer-mancha-2" aria-hidden />
        <span className="footer-mancha footer-mancha-3" aria-hidden />

        <div className="footer-main">
          <div
            ref={marcaRef}
            className="footer-wordmark"
            data-revelado={revelado}
            role="img"
            aria-label="Brunela Dance Trainer"
          >
            <span className="footer-wm-bailarina" aria-hidden>
              <Image src="/brand/isologo-icon.png" alt="" width={120} height={120} />
            </span>
            {/* El MISMO wordmark que el hero: es el logo enviado de la marca,
                retipografiarlo en CSS lo cambiaba (pedido de la duena). */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="footer-wm-nombre footer-wm-img" src="/brand/brunela-dance-trainer-wordmark.png" alt="" draggable={false} />
          </div>

          {/* Disciplinas y lugar en una sola linea: son dos datos cortos y en
              dos renglones separados competian con la marca de arriba. */}
          {/* Las disciplinas vienen de i18n separadas por guiones; se muestran
              con puntos medios, como el lugar. El texto traducido no cambia. */}
          <p className="footer-services">
            {[...t("footer.services").split(" - "), t("footer.place")].map((parte, i) => (
              <span key={i} className="footer-servicio">
                {i > 0 && (
                  <span className="footer-sep" aria-hidden>
                    ·
                  </span>
                )}
                {parte}
              </span>
            ))}
          </p>

          <nav className="footer-nav" aria-label="Footer navigation">
            {navLinks.map((link) => (
              <Link href={link.href} key={link.label} suppressHydrationWarning>
                {t(link.label as PublicMessageKey)}
              </Link>
            ))}
          </nav>

          {/* Filete con destello. Decorativo: separa la navegacion de las
              redes sin meter otro bloque de texto. */}
          <div className="footer-regla" aria-hidden>
            <span className="footer-regla-linea" />
            <Sparkle size={14} strokeWidth={0} fill="currentColor" />
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

        <div className="footer-bottom">
          <span>{t("footer.copyright")}</span>
        </div>
      </div>
    </footer>
  );
}
