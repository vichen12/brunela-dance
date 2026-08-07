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

/**
 * Los enlaces del navbar y las secciones de la landing SON LA MISMA LISTA.
 *
 * ⚠️ Cada `id` de aca tiene que existir como `id=` en `app/page.tsx`. Un ancla
 *    rota no da error: el navegador se queda donde esta y parece que el enlace
 *    "no anda". Por eso la lista es una sola y el resaltado de seccion activa
 *    se calcula a partir de ella -- si alguien borra una seccion, el enlace
 *    deja de encenderse y se nota.
 */
const links = [
  { id: "metodo", href: "/#metodo", label: "nav.method" },
  { id: "clases", href: "/#clases", label: "nav.classes" },
  { id: "sobre", href: "/#sobre", label: "nav.about" },
  { id: "planes", href: "/#planes", label: "nav.plans" },
] as const;

/**
 * Escala de z-index con nombre.
 *
 * Antes esto era 9999 / 9998 / 9997 sueltos. El problema de los numeros magicos
 * no es que sean feos: es que el siguiente que necesite estar encima escribe
 * 10000, y a partir de ahi nadie sabe cual es el orden real.
 */
const Z = { velo: 60, cajon: 70, header: 80, flotante: 90 } as const;

export function Navbar() {
  const pathname = usePathname();
  const { t } = usePublicI18n();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activa, setActiva] = useState<string | null>(null);

  const isAuthPage = pathname?.startsWith("/sign-in");
  const enLanding = pathname === "/";

  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 40);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  /**
   * Resaltado de la seccion en la que esta la visitante.
   *
   * Se usa IntersectionObserver y no el evento de scroll porque el observador
   * no corre en el hilo principal en cada pixel: con el scroll a mano habria
   * que medir la posicion de cada seccion en cada cuadro.
   *
   * El `rootMargin` recorta la ventana a una franja: -45% arriba (para saltar
   * la altura del header) y -50% abajo. Asi la seccion "activa" es la que pasa
   * por el medio de la pantalla, no la que apenas asoma por el borde -- que era
   * lo que hacia parpadear el resaltado entre dos secciones vecinas.
   */
  useEffect(() => {
    if (!enLanding || typeof IntersectionObserver === "undefined") {
      setActiva(null);
      return;
    }

    const secciones = links
      .map((l) => document.getElementById(l.id))
      .filter((el): el is HTMLElement => el !== null);

    if (secciones.length === 0) return;

    /**
     * 🔴 HAY QUE APAGAR, NO SOLO ENCENDER.
     *
     *    La primera version hacia `if (e.isIntersecting) setActiva(e.target.id)`
     *    y nada mas. Eso enciende la seccion al entrar pero NUNCA la apaga: al
     *    volver arriba del todo -- hero, carrusel, video, que no son ninguna de
     *    las secciones observadas -- el ultimo enlace encendido se quedaba
     *    subrayado. Se veia "METODO" resaltado estando en el video, que esta
     *    antes que Metodo.
     *
     *    Por eso se lleva el conjunto de las que estan dentro de la franja y se
     *    recalcula entero en cada aviso: si el conjunto queda vacio, no hay
     *    seccion activa y no se resalta nada.
     */
    const dentro = new Set<string>();

    const observador = new IntersectionObserver(
      (entradas) => {
        for (const e of entradas) {
          if (e.isIntersecting) dentro.add(e.target.id);
          else dentro.delete(e.target.id);
        }
        // Si hay mas de una en la franja se elige la PRIMERA en orden de la
        // pagina, para que el resaltado avance igual que la lectura y no salte
        // hacia atras al cruzar el limite entre dos secciones.
        const activaAhora = links.find((l) => dentro.has(l.id))?.id ?? null;
        setActiva(activaAhora);
      },
      { rootMargin: "-45% 0px -50% 0px", threshold: 0 }
    );

    for (const s of secciones) observador.observe(s);
    return () => observador.disconnect();
  }, [enLanding]);

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
          zIndex: Z.header,
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
        <BrandLockup href="/" compact markOnly showWordmark className="navbar-brand" />

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
          {links.map((link) => {
            const esActiva = activa === link.id;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`brand-nav-link${esActiva ? " brand-nav-activa" : ""}`}
                // Se anuncia la seccion actual a los lectores de pantalla. Sin
                // esto el resaltado es puramente visual y no existe para quien
                // no lo ve.
                aria-current={esActiva ? "true" : undefined}
              >
                {t(link.label as PublicMessageKey)}
              </Link>
            );
          })}
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
            aria-expanded={menuOpen}
            aria-controls="menu-movil"
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
        aria-expanded={menuOpen}
        aria-controls="menu-movil"
      >
        {menuOpen ? <X size={18} /> : <Menu size={18} />}
      </button>

      {/*
        🔴 EL CAJON CERRADO TIENE QUE SALIR DEL ALCANCE DEL TABULADOR.

        Antes solo se corria con `translateY(-110%)`. Un elemento desplazado
        SIGUE existiendo: el lector de pantalla lee sus cuatro enlaces como si
        el menu estuviera abierto, y al tabular el foco se va a enlaces que no
        se ven -- la persona pulsa Tab y el foco desaparece de la pantalla.

        `visibility: hidden` lo saca del arbol de accesibilidad Y del orden de
        tabulacion, y ademas sigue siendo animable, asi que la transicion no se
        pierde. El `transition` la retrasa al cerrar para que no se corte.
      */}
      <div
        id="menu-movil"
        aria-hidden={!menuOpen}
        style={{
          position: "fixed",
          top: 66,
          left: 0,
          right: 0,
          zIndex: Z.cajon,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "1.05rem 1.5rem 2rem",
          background: "rgba(255,255,255,0.98)",
          backdropFilter: "blur(24px)",
          borderBottom: "1px solid #FFDADA",
          boxShadow: "0 12px 40px rgba(217,52,56,0.1)",
          transform: menuOpen ? "translateY(0)" : "translateY(-110%)",
          visibility: menuOpen ? "visible" : "hidden",
          transition: menuOpen
            ? "transform 300ms cubic-bezier(0.22,1,0.36,1), visibility 0s"
            : "transform 300ms cubic-bezier(0.22,1,0.36,1), visibility 0s 300ms",
        }}
      >
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            onClick={close}
            className="nav-link-movil"
            aria-current={activa === link.id ? "true" : undefined}
          >
            {t(link.label as PublicMessageKey)}
          </Link>
        ))}
        <Link
          href="/sign-in"
          onClick={close}
          className="nav-button nav-button-ghost mobile-drawer-signin"
          style={{ width: "min(100%, 340px)", marginTop: "1.25rem" }}
        >
          {t("nav.signIn")}
        </Link>
        <Link
          href="/#planes"
          onClick={close}
          className="nav-button nav-button-solid"
          style={{ width: "min(100%, 340px)", marginTop: "1.25rem" }}
        >
          {t("nav.viewPlans")}
        </Link>

        {/* El selector de idioma vive aca en movil: en la barra se comia el
            ancho que necesita "Ingresar". Ver la nota del CSS. */}
        <div className="menu-idiomas">
          <LanguageSwitcher />
        </div>
      </div>

      {menuOpen && (
        <div
          onClick={close}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: Z.velo,
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
        /*
          Variante compacta del sistema de botones de globals.css. La barra mide
          66px, asi que el alto de 46px no entra: se reescriben SOLO las tres
          variables de tamano y todo lo demas (curva, tracking, foco, hover) lo
          hereda del sistema. Antes esto repetia la geometria entera y por eso
          el navbar no se parecia al resto de la pagina.
        */
        .nav-button {
          --btn-min-h: 38px;
          --btn-pad-y: 0.48rem;
          --btn-pad-x: 1.15rem;
          --btn-size: 0.68rem;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: var(--btn-min-h);
          border-radius: var(--btn-radius);
          padding: var(--btn-pad-y) var(--btn-pad-x);
          font-size: var(--btn-size);
          font-weight: var(--btn-weight);
          letter-spacing: var(--btn-track);
          line-height: 1.2;
          text-transform: uppercase;
          text-decoration: none;
          white-space: nowrap;
          transition: background var(--btn-dur) ease,
                      border-color var(--btn-dur) ease,
                      color var(--btn-dur) ease,
                      box-shadow var(--btn-dur) ease,
                      transform var(--btn-dur) var(--btn-ease);
        }

        .nav-button:hover { transform: translateY(var(--btn-lift)); }

        .nav-button:focus-visible {
          outline: 2px solid var(--pink-deep);
          outline-offset: 3px;
        }

        .nav-button-solid:hover {
          background: var(--pink-mid);
          box-shadow: 0 12px 26px rgba(230, 79, 85, 0.32);
        }

        .nav-button-ghost:hover {
          border-color: var(--pink);
          background: var(--pink-wash);
        }

        @media (prefers-reduced-motion: reduce) {
          .nav-button { transition: none; }
          .nav-button:hover { transform: none; }
        }
        .nav-button-solid {
          background: var(--pink);
          color: #fff;
          box-shadow: 0 4px 16px rgba(230,79,85,0.28);
        }
        .nav-button-ghost {
          border: 1.5px solid #FFDADA;
          color: var(--pink-deep);
          background: transparent;
        }

        /*
          🔴 EL COLOR DE LOS ENLACES NO ES DECORATIVO.

          Estaban en --pink-mid (#D93438). Se midio el peor caso del texto sobre
          la cabecera translucida apoyada en la foto del hero:

              --pink-mid   sin scroll 3.94:1 · con scroll 4.46:1   ❌
              --pink-deep  sin scroll 5.04:1 · con scroll 5.70:1   ✅

          Son 11.2px en negrita, o sea texto NORMAL para WCAG (grande empieza en
          14pt ≈ 18.66px), asi que el minimo es 4.5:1 y --pink-mid no llegaba ni
          con la cabecera casi opaca. Ver la nota de contraste en CLAUDE.md:
          --pink para superficie glanceable, tono mas oscuro cuando hay que leer.
        */
        .brand-nav-link {
          position: relative;
          padding: 0.45rem 0.9rem;
          border-radius: 999px;
          color: var(--pink-deep);
          font-size: 0.7rem;
          font-weight: 800;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          text-decoration: none;
          transition: color 200ms ease, background-color 200ms ease;
        }

        .brand-nav-link:hover {
          background: var(--pink-wash);
        }

        /*
          El foco visible no es opcional: sin el, quien navega con teclado no
          tiene forma de saber en que enlace esta. Va con :focus-visible y no
          con :focus para no dibujarlo tambien al hacer clic con el raton.
        */
        .brand-nav-link:focus-visible,
        .nav-link-movil:focus-visible {
          outline: 2px solid var(--pink-deep);
          outline-offset: 2px;
        }

        /*
          Seccion activa. El subrayado es un pseudo-elemento y no un
          border-bottom para que se pueda animar el ancho sin mover el texto.
        */
        .brand-nav-activa {
          color: var(--pink);
        }

        .brand-nav-activa::after {
          content: "";
          position: absolute;
          left: 0.9rem;
          right: 0.9rem;
          bottom: 0.15rem;
          height: 2px;
          border-radius: 2px;
          background: var(--pink);
          animation: nav-subrayado 260ms cubic-bezier(0.16, 1, 0.3, 1) both;
        }

        @keyframes nav-subrayado {
          from { transform: scaleX(0); opacity: 0; }
          to   { transform: scaleX(1); opacity: 1; }
        }

        .nav-link-movil {
          display: block;
          width: min(100%, 340px);
          padding: 1rem 0.25rem;
          border-bottom: 1px solid #FFDADA;
          color: var(--pink-deep);
          font-size: 0.82rem;
          font-weight: 800;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          text-decoration: none;
          text-align: center;
        }

        .nav-link-movil[aria-current="true"] {
          color: var(--pink);
        }

        @media (prefers-reduced-motion: reduce) {
          .brand-nav-link,
          .brand-nav-activa::after {
            transition: none;
            animation: none;
          }
        }
        .mobile-floating-menu {
          display: none;
        }
        .mobile-language-selector {
          display: none;
        }
        @media (max-width: 639px) {
          /*
            🔴 EL SELECTOR DE IDIOMA SE VA DE LA BARRA EN MOVIL.

               Son cuatro botones (ES EN FR IT) y en una pantalla de telefono se
               comian el ancho: no quedaba sitio para "Ingresar", que a partir de
               520px desaparecia del todo. Cambiar de idioma es algo que se hace
               una vez; entrar a la cuenta, todos los dias.

               No se pierde: pasa al cajon del menu, con mas sitio y mas facil de
               acertar con el dedo.
          */
          .mobile-language-selector { display: none !important; }
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
            max-width: 168px;
            overflow: hidden;
            transform: none;
            transform-origin: left center;
            gap: 0.42rem !important;
          }
          .navbar-brand > div:first-child {
            width: 30px !important;
            height: 30px !important;
          }
          .navbar-brand > div:nth-child(2) {
            display: block !important;
            width: 106px !important;
            height: 31px !important;
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
            /* Era 10001 suelto. Va por encima de la cabecera a proposito
               (tiene que seguir pulsable con el cajon abierto), pero dentro de
               la escala con nombre. */
            z-index: ${Z.flotante};
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
        /* "Ingresar" ya NO se esconde a los 520px: al sacar el selector de
           idioma de la barra hay sitio de sobra, y era el unico acceso directo
           a la cuenta desde la barra. */
        @media (max-width: 400px) {
          .landing-mobile-nav .mobile-signin-button {
            --btn-pad-x: 0.7rem;
            font-size: 0.58rem;
          }
        }

        /* El selector de idioma, dentro del cajon. */
        .menu-idiomas {
          display: none;
          width: min(100%, 340px);
          justify-content: center;
          margin-top: 1.35rem;
          padding-top: 1.2rem;
          border-top: 1px solid #FFDADA;
        }

        @media (max-width: 639px) {
          .menu-idiomas { display: flex; }
        }
        @media (max-width: 390px) {
          .navbar-brand {
            max-width: 142px;
            gap: 0.34rem !important;
          }
          .navbar-brand > div:first-child {
            width: 27px !important;
            height: 27px !important;
          }
          .navbar-brand > div:nth-child(2) {
            width: 92px !important;
            height: 27px !important;
          }
        }
      `}</style>
    </>
  );
}
