"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { ChevronRight, Gem, Globe, Heart, Menu, PlayCircle, Sparkles, X } from "lucide-react";
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
const Z = { velo: 60, cajon: 70, header: 80 } as const;

/** Icono de cada seccion en la hoja movil, en el mismo orden que `links`. */
function IconoSeccion({ indice }: { indice: number }) {
  if (indice === 0) return <Sparkles size={19} strokeWidth={2.1} />;
  if (indice === 1) return <PlayCircle size={19} strokeWidth={2.1} />;
  if (indice === 2) return <Heart size={19} strokeWidth={2.1} />;
  return <Gem size={19} strokeWidth={2.1} />;
}

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

  // El overflow del body se suelta ACA, sincronico, y no solo en el efecto:
  // si el Link salta al ancla mientras el body sigue en overflow hidden, el
  // navegador a veces no se mueve (pasaba en el celular con Metodo/Clases).
  const close = () => {
    document.body.style.overflow = "";
    setMenuOpen(false);
  };

  // Escape cierra el menu, como cualquier panel.
  useEffect(() => {
    if (!menuOpen) return;
    const alTeclear = (e: KeyboardEvent) => { if (e.key === "Escape") setMenuOpen(false); };
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [menuOpen]);

  if (isAuthPage) {
    return null;
  }

  return (
    <>
      {/*
        Rediseño "suave y calido" (2026-10-08): la barra deja de ser una franja
        de borde a borde y pasa a ser una pildora blanca translucida que flota,
        igual que la navegacion movil del sistema. El contenedor fijo es
        transparente; la pildora es .nv-barra. Estilos en app/estilos/acceso.css
        (bloque "Barra de la landing").
      */}
      <header
        className={`site-header nv${scrolled ? " nv--bajo" : ""}${menuOpen ? " nv--abierto" : ""}`}
        style={{ zIndex: Z.header }}
      >
        <div className="nv-barra">
          <Link href="/" className="nv-marca" aria-label="Brunela Dance Trainer" suppressHydrationWarning>
            {/* El logo de la marca (el mismo del hero y del pie), no el nombre
                retipografiado: pedido de la duena. */}
            <Image src="/brand/isologo-icon.png" alt="" width={34} height={34} priority className="nv-marca-iso" />
            <Image src="/brand/brunela-dance-trainer-wordmark.png" alt="" width={1060} height={306} priority className="nv-marca-wm" />
          </Link>

          <nav className="nv-links">
            {links.map((link) => {
              const esActiva = activa === link.id;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`nv-link${esActiva ? " es-activa" : ""}`}
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

          <div className="nv-acciones">
            <LanguageSwitcher compact />
            <Link href="/sign-in" className="nv-btn nv-btn--sec">
              {t("nav.signIn")}
            </Link>
            <Link href="/#planes" className="nv-btn nv-btn--coral">
              {t("nav.viewPlans")}
            </Link>
          </div>

          {/*
            En movil quedan dos cosas: "Ingresar" (lo que se usa todos los
            dias) y el boton del menu. El selector de idioma pasa a la hoja:
            cuatro botones en la barra se comian el ancho que necesita
            "Ingresar", y cambiar de idioma se hace una sola vez.

            El boton del menu vive DENTRO de la barra y la barra esta por
            encima de la hoja (Z.header > Z.cajon), asi que sigue pulsable con
            la hoja abierta sin necesitar un boton flotante aparte.
          */}
          <div className="nv-movil">
            <Link href="/sign-in" className="nv-btn nv-btn--coral nv-btn--chico">
              {t("nav.signIn")}
            </Link>
            <button
              type="button"
              className="nv-menu-btn"
              onClick={() => setMenuOpen((open) => !open)}
              aria-label={menuOpen ? t("nav.closeMenu") : t("nav.openMenu")}
              aria-expanded={menuOpen}
              aria-controls="menu-movil"
            >
              {menuOpen ? <X size={19} strokeWidth={2.4} /> : <Menu size={19} strokeWidth={2.4} />}
            </button>
          </div>
        </div>
      </header>

      {/*
        🔴 LA HOJA CERRADA TIENE QUE SALIR DEL ALCANCE DEL TABULADOR.

        Un elemento desplazado o transparente SIGUE existiendo: el lector de
        pantalla lee sus enlaces como si el menu estuviera abierto, y al tabular
        el foco se va a enlaces que no se ven -- la persona pulsa Tab y el foco
        desaparece de la pantalla.

        `visibility: hidden` lo saca del arbol de accesibilidad Y del orden de
        tabulacion, y ademas sigue siendo animable, asi que la transicion no se
        pierde. El CSS la retrasa al cerrar para que no se corte.
      */}
      <div
        id="menu-movil"
        className={`nv-hoja${menuOpen ? " es-abierta" : ""}`}
        aria-hidden={!menuOpen}
        style={{ zIndex: Z.cajon }}
      >
        <nav className="nv-hoja-links">
          {links.map((link, indice) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={close}
              className="nv-hoja-link"
              aria-current={activa === link.id ? "true" : undefined}
            >
              <span className="nv-hoja-ico" aria-hidden>
                <IconoSeccion indice={indice} />
              </span>
              <span className="nv-hoja-txt">{t(link.label as PublicMessageKey)}</span>
              <ChevronRight className="nv-hoja-flecha" size={18} strokeWidth={2.4} aria-hidden />
            </Link>
          ))}
        </nav>

        <div className="nv-hoja-acciones">
          <Link href="/sign-in" onClick={close} className="nv-btn nv-btn--sec nv-btn--grande">
            {t("nav.signIn")}
          </Link>
          <Link href="/#planes" onClick={close} className="nv-btn nv-btn--coral nv-btn--grande">
            {t("nav.viewPlans")}
          </Link>
        </div>

        {/* El selector de idioma vive aca en movil: en la barra se comia el
            ancho que necesita "Ingresar". */}
        <div className="menu-idiomas">
          <Globe size={16} strokeWidth={2.2} aria-hidden />
          <LanguageSwitcher />
        </div>
      </div>

      {menuOpen && <div className="nv-velo" onClick={close} style={{ zIndex: Z.velo }} />}
    </>
  );
}
