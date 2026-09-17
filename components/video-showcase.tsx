"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ExternalLink, Play, Volume2, VolumeX } from "lucide-react";
import { T } from "@/components/language-provider";

/**
 * El trailer de la portada, servido desde YouTube.
 *
 * POR QUE YOUTUBE Y NO UN ARCHIVO PROPIO
 *   Antes esto era un <video> apuntando a /videos/brunela-trailer.mp4, un
 *   archivo que NO EXISTE en el repo: la landing pedia un 404 en cada visita y
 *   la seccion se sostenia sola con su `poster`. Ademas, servir un mp4 desde
 *   Vercel lo paga el proyecto en ancho de banda cada vez que alguien entra.
 *   YouTube lo aloja, lo transcodifica a varias calidades y lo sirve gratis.
 *
 * 🔴 TRES COSAS QUE NO SON OPCIONALES, Y POR QUE
 *
 *   1. SE CARGA TARDE, NO AL ENTRAR.
 *      Un iframe de YouTube arrastra cerca de un mega de JavaScript y abre
 *      conexiones a varios dominios. Esta seccion esta BAJO EL PLIEGUE: montarlo
 *      en la carga inicial le cobra ese peso al LCP de la portada a todo el
 *      mundo, incluido quien nunca baja hasta aca. Se monta cuando la seccion
 *      se acerca a la pantalla (IntersectionObserver, 300px de margen).
 *
 *   2. VA POR youtube-nocookie.com.
 *      El dominio normal escribe cookies de seguimiento apenas carga el iframe,
 *      sin que nadie haya tocado nada. Este proyecto movio la base a Frankfurt
 *      POR RESIDENCIA DE DATOS: plantar cookies de Google en la portada antes de
 *      cualquier consentimiento seria incoherente con esa decision. El dominio
 *      -nocookie no las escribe hasta que hay reproduccion deliberada.
 *
 *   3. CON prefers-reduced-motion NO ARRANCA SOLO.
 *      Un video en bucle a pantalla completa es exactamente el tipo de
 *      movimiento que esa preferencia pide evitar, y para quien tiene
 *      sensibilidad vestibular no es un detalle estetico. En ese caso se queda
 *      la foto fija y un boton para reproducir a voluntad.
 *
 * ⚠️ LA FOTO NO SE VA NUNCA.
 *    Queda de fondo del marco, debajo del iframe. Cubre los tres huecos en que
 *    el video no aparece -- mientras carga, si YouTube esta bloqueado por una
 *    extension o una red corporativa, y si el video se borra del canal -- y en
 *    los tres la seccion se ve como se ve hoy en vez de quedar en negro.
 */

const VIDEO_ID = "XFt3nFx8-4g";
const ORIGEN_YT = "https://www.youtube-nocookie.com";

export function VideoShowcase() {
  const seccionRef = useRef<HTMLElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const [montar, setMontar] = useState(false);
  const [listo, setListo] = useState(false);
  const [muted, setMuted] = useState(true);
  const [menosMovimiento, setMenosMovimiento] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setMenosMovimiento(mq.matches);

    const alCambiar = (e: MediaQueryListEvent) => setMenosMovimiento(e.matches);
    mq.addEventListener("change", alCambiar);
    return () => mq.removeEventListener("change", alCambiar);
  }, []);

  // Se monta al acercarse a la pantalla. Con reduced-motion no se monta solo:
  // espera a que la persona lo pida.
  useEffect(() => {
    if (menosMovimiento || montar) return;

    const nodo = seccionRef.current;
    if (!nodo) return;

    // Sin IntersectionObserver (navegador viejo) se monta y ya: mejor el peso
    // que una seccion muerta.
    if (typeof IntersectionObserver === "undefined") {
      setMontar(true);
      return;
    }

    const obs = new IntersectionObserver(
      (entradas) => {
        if (entradas.some((e) => e.isIntersecting)) {
          setMontar(true);
          obs.disconnect();
        }
      },
      { rootMargin: "300px" }
    );

    obs.observe(nodo);
    return () => obs.disconnect();
  }, [menosMovimiento, montar]);

  /**
   * Los comandos viajan por postMessage.
   *
   * Es la API de iframe de YouTube sin cargar su script: alcanza con
   * `enablejsapi=1` en la URL y mandar el mensaje al origen exacto. Mandarlo a
   * "*" funcionaria igual y seria peor: cualquier otro marco de la pagina podria
   * leerlo.
   */
  const comando = useCallback((func: string, args: unknown[] = []) => {
    iframeRef.current?.contentWindow?.postMessage(
      JSON.stringify({ event: "command", func, args }),
      ORIGEN_YT
    );
  }, []);

  function alternarSonido() {
    if (!montar) {
      // Con reduced-motion el primer toque es "reproducir", no "activar sonido".
      setMontar(true);
      return;
    }
    const siguiente = !muted;
    comando(siguiente ? "mute" : "unMute");
    if (!siguiente) comando("setVolume", [100]);
    setMuted(siguiente);
  }

  /**
   * `playlist` con el MISMO id no es redundante: sin ese parametro `loop=1` no
   * hace nada en un video suelto. Es una rareza vieja de la API y no esta
   * documentada donde uno la busca.
   *
   * `playsinline=1` evita que iOS se lo lleve a pantalla completa solo, que
   * arruinaria la portada en el telefono.
   */
  const src =
    `${ORIGEN_YT}/embed/${VIDEO_ID}` +
    `?autoplay=1&mute=1&loop=1&playlist=${VIDEO_ID}` +
    `&controls=0&modestbranding=1&rel=0&iv_load_policy=3&disablekb=1` +
    `&playsinline=1&fs=0&enablejsapi=1` +
    (typeof window !== "undefined" ? `&origin=${encodeURIComponent(window.location.origin)}` : "");

  return (
    // El id ya no lo usa ningun boton de la pagina -- el "Ver trailer" de la
    // seccion Metodo se quito el 2026-09-17. Se conserva porque es un ancla
    // publica: bruneladance.com/#video-trailer sigue llevando aca, y eso puede
    // estar pegado en una biografia de Instagram o en un mensaje.
    <section
      ref={seccionRef}
      id="video-trailer"
      className="video-showcase-section"
      aria-label="Tráiler de Brunela Dance Trainer"
    >
      <div className="video-showcase-frame" data-listo={listo ? "si" : "no"}>
        <div className="video-showcase-video">
          {montar && (
            <iframe
              ref={iframeRef}
              src={src}
              title="Tráiler de Brunela Dance Trainer"
              /* `autoplay` en allow es lo que permite que arranque en muted;
                 sin el, Chrome lo frena y queda la foto para siempre. */
              allow="autoplay; encrypted-media; picture-in-picture"
              /* El fondo no se toca: los controles son los de abajo. Sin esto,
                 un clic distraido abre YouTube encima de la portada. */
              tabIndex={-1}
              aria-hidden
              onLoad={() => setListo(true)}
            />
          )}
        </div>

        <div className="video-showcase-scrim" />

        <div className="video-showcase-content">
          <p className="section-kicker">
            <T id="video.kicker" />
          </p>
          <h2>
            <T id="video.title" />
          </h2>
          <p>
            <T id="video.lead" />
          </p>

          <div className="video-showcase-acciones">
            <button className="video-sound-button" type="button" onClick={alternarSonido}>
              {!montar ? <Play size={17} /> : muted ? <VolumeX size={17} /> : <Volume2 size={17} />}
              <span>
                {!montar ? <T id="method.cta" /> : muted ? <T id="video.soundOn" /> : <T id="video.soundOff" />}
              </span>
            </button>

            {/*
              El fondo no es clicable a proposito (pointer-events: none en el
              iframe), asi que este enlace es la UNICA forma de llegar al video
              entero. Va como enlace de verdad y no como boton: se puede abrir en
              otra pestaña con el medio del mouse, copiar la direccion, y un
              lector de pantalla lo anuncia como enlace, que es lo que es.

              `noopener` no es decorativo: sin el, la pestaña que se abre puede
              tocar `window.opener` y redirigir esta.
            */}
            <a
              className="video-yt-link"
              href={`https://youtu.be/${VIDEO_ID}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Ver en YouTube
              <ExternalLink size={14} aria-hidden />
              <span className="sr-only"> (se abre en una pestaña nueva)</span>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
