"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import { ControlesReproductor } from "@/components/reproductor-controles";

export type PlayerAudioTrack = {
  locale: string;
  label: string;
};

type Props = {
  /** HLS master playlist URL (Bunny .m3u8). */
  src: string;
  /** Poster shown before playback. */
  poster?: string | null;
  /** Languages the admin uploaded, for the selector labels. */
  audioTracks: PlayerAudioTrack[];
  /** Total length, used to compute completion %. */
  durationSeconds: number;
  /** Where to resume from (seconds). */
  initialPositionSeconds?: number;
  /** Lo mas lejos que llego antes: el porcentaje no baja si vuelve a empezar. */
  maxPrevioSeconds?: number;
  /** Preferred starting locale (e.g. the user's preferred_locale). */
  preferredLocale?: string;
  /**
   * Persists progress. Called periodically and on pause/unmount.
   * Receives last position and completion percent (0-100).
   */
  onProgress: (lastPositionSeconds: number, completionPercent: number) => void;
  /**
   * Registro de actividad (opcional). A diferencia de onProgress, que pisa
   * siempre la misma fila, esto deja historia: de aca salen frecuencia de uso,
   * franjas horarias y visualizaciones por clase.
   *
   * `secondsWatched` es tiempo REALMENTE reproducido desde el evento anterior,
   * medido con reloj de pared. No es diferencia de posicion: si adelanta diez
   * minutos con la barra, la posicion salta y esto suma cero.
   */
  /**
   * Idiomas extra como mp3 aparte y subtitulos .vtt (src/lib/audio/idiomas.ts),
   * con enlaces firmados. Opcionales: sin ellos, el reproductor es el de siempre.
   */
  audiosExternos?: { locale: string; url: string }[];
  subtitulosExternos?: { locale: string; url: string }[];
  onActivity?: (event: {
    type: "video_start" | "video_heartbeat" | "video_complete";
    positionSeconds: number;
    secondsWatched: number;
  }) => void;
};

/** Mirrors AUDIO_LOCALES in src/lib/audio/config.ts (plus the original, es). */
const LOCALE_LABELS: Record<string, string> = {
  es: "ES",
  en: "EN",
  fr: "FR",
  it: "IT"
};

/** Spoken out by screen readers and shown on hover; "FR" alone says nothing. */
const LOCALE_NAMES: Record<string, string> = {
  es: "Espanol",
  en: "English",
  fr: "Francais",
  it: "Italiano"
};

/**
 * Selector order, fixed instead of inherited from the stream. Bunny lists the
 * original first and the dubs in upload order, so re-muxing a class with a
 * different set of languages would silently reshuffle the buttons.
 */
const LOCALE_ORDER = ["es", "en", "fr", "it"];

/**
 * Bunny returns two-letter tags today (verified for es/en/fr/it), even though
 * ffmpeg writes ISO 639-2 into the file. This maps back if that ever changes,
 * so a regression shows the wrong-but-readable "FR" rather than a raw "FRA".
 */
const THREE_LETTER: Record<string, string> = {
  spa: "es",
  eng: "en",
  fra: "fr",
  fre: "fr",
  ita: "it"
};

function normalizeLocale(lang?: string): string {
  const value = (lang ?? "").toLowerCase().split(/[-_]/)[0];
  return THREE_LETTER[value] ?? value;
}

/** How many times we re-sign and resume before giving up. */
const MAX_RECOVERIES = 3;

/**
 * WebKit's non-standard AudioTrackList, the only way to enumerate or switch
 * audio tracks on Safari's native HLS engine. Not in lib.dom.
 */
type NativeAudioTrack = { id: string; label: string; language: string; enabled: boolean };
type NativeAudioTrackList = { length: number; [index: number]: NativeAudioTrack };

function nativeAudioTracks(video: HTMLVideoElement): NativeAudioTrackList | null {
  const list = (video as unknown as { audioTracks?: NativeAudioTrackList }).audioTracks;
  return list && typeof list.length === "number" ? list : null;
}

/**
 * Real HLS player with in-stream audio-track switching (no reload, no video
 * swap) and automatic progress tracking. Falls back to native HLS on Safari.
 */
export function VideoPlayer({
  src,
  poster,
  audioTracks,
  durationSeconds,
  initialPositionSeconds = 0,
  maxPrevioSeconds = 0,
  preferredLocale = "es",
  onProgress,
  onActivity,
  audiosExternos = [],
  subtitulosExternos = []
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const contenedorRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  // El idioma que ELIGIO la alumna. Al recuperarse de un corte el reproductor
  // vuelve a leer las pistas, y antes le ponia otra vez el idioma por defecto.
  const audioElegidoRef = useRef<string | null>(null);
  // Cuando fue la ultima recuperacion: despues de un rato sano el contador
  // vuelve a cero (antes, tres cortes en toda la clase y no andaba mas).
  const ultimaRecuperacionRef = useRef(0);
  const lastSavedRef = useRef(0);
  const maxVistoRef = useRef(maxPrevioSeconds);
  const recoveriesRef = useRef(0);

  // Contabilidad del tiempo reproducido. playingSinceRef guarda el instante en
  // que arranco el tramo actual; null significa pausado.
  const playingSinceRef = useRef<number | null>(null);
  const watchedRef = useRef(0);
  const startedRef = useRef(false);
  const completedRef = useRef(false);

  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Audio tracks reported by the stream itself (index + name).
  const [streamAudioTracks, setStreamAudioTracks] = useState<{ id: number; name: string; lang?: string }[]>([]);
  const [activeAudioId, setActiveAudioId] = useState<number>(-1);
  // Subtitulos: cada .vtt se baja una vez y se le da al <video> como pista
  // propia (una direccion "blob:" del mismo sitio, asi no hace falta permiso
  // de otro dominio, que en el iPhone rompia la reproduccion).
  const [pistasTexto, setPistasTexto] = useState<{ locale: string; src: string }[]>([]);
  const [subtituloActivo, setSubtituloActivo] = useState<string | null>(null);
  // Audio en otro idioma (mp3 aparte). null = el del video (español).
  const audioRef = useRef<HTMLAudioElement>(null);
  const [audioExterno, setAudioExterno] = useState<string | null>(null);

  const saveProgress = useCallback(
    (force = false, elemento?: HTMLVideoElement | null) => {
      // `elemento`: al desmontar, videoRef.current ya es null y el ultimo
      // guardado (el mas importante) no se hacia nunca.
      const video = elemento ?? videoRef.current;
      if (!video || !Number.isFinite(video.currentTime)) return;
      const position = Math.floor(video.currentTime);
      // Cada 30 segundos de avance, no cada 10 (fase C del plan de
      // escalabilidad). Es una reduccion de 3x en escrituras cambiando una
      // constante: una clase de 45 minutos pasa de 270 guardados a 90.
      //
      // No se pierde nada: `force` sigue guardando al pausar, al cerrar la
      // pestana y al desmontar, que son los momentos en los que la posicion
      // importa de verdad. Lo unico que cambia es cuanto se puede perder si el
      // navegador muere de golpe -- de 10 a 30 segundos de una clase.
      if (!force && Math.abs(position - lastSavedRef.current) < 30) return;
      lastSavedRef.current = position;
      const total = durationSeconds || video.duration || 0;
      // Sobre lo mas lejos que llego, no sobre donde esta: antes, volver a
      // mirar el principio de una clase terminada le bajaba el progreso.
      maxVistoRef.current = Math.max(maxVistoRef.current, position);
      const percent = total > 0 ? Math.min(100, Math.round((maxVistoRef.current / total) * 100)) : 0;
      onProgress(position, percent);
    },
    [durationSeconds, onProgress]
  );

  // Set up HLS (or native) once.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    // Una sola vez por fuente. En el iPhone (HLS nativo) `loadedmetadata`
    // puede volver a dispararse despues de que la alumna adelanto, y cada vez
    // la devolvia al punto guardado: arrastraba la barra, daba play y volvia
    // al mismo lugar.
    let resumed = false;
    function applyResume() {
      if (resumed) return;
      resumed = true;
      // Si la habia terminado (o le faltaba casi nada), arranca de cero: antes
      // volvia a abrirla en el ultimo segundo y parecia que no andaba.
      const total = durationSeconds || Infinity;
      if (video && initialPositionSeconds > 0 && initialPositionSeconds < total * 0.95 && total - initialPositionSeconds > 20) {
        video.currentTime = initialPositionSeconds;
      }
    }

    const alAvanzar = () => {
      if (recoveriesRef.current > 0 && Date.now() - ultimaRecuperacionRef.current > 30_000) recoveriesRef.current = 0;
    };
    video.addEventListener("timeupdate", alAvanzar);

    if (Hls.isSupported()) {
      const hls = new Hls({ enableWorker: true });
      hlsRef.current = hls;
      hls.loadSource(src);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setReady(true);
        applyResume();
      });

      hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, (_e, data) => {
        const tracks = data.audioTracks.map((t, id) => ({
          id,
          name: t.name || t.lang || `Track ${id + 1}`,
          lang: t.lang
        }));
        setStreamAudioTracks(tracks);
        // Default to the preferred locale if present.
        const quiere = audioElegidoRef.current ?? preferredLocale;
        const preferred = tracks.find((t) => normalizeLocale(t.lang) === quiere);
        if (preferred) {
          hls.audioTrack = preferred.id;
          setActiveAudioId(preferred.id);
        } else {
          setActiveAudioId(hls.audioTrack);
        }
      });

      hls.on(Hls.Events.ERROR, (_e, data) => {
        if (!data.fatal) return;

        // A Bunny token that ran out mid-class arrives here as a fatal network
        // error on a segment or playlist load. Reloading the source hits our
        // manifest route again, which mints fresh signed URLs. Resume where the
        // viewer was: silently restarting a 60 minute class would be worse than
        // the stall we are fixing.
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR && recoveriesRef.current < MAX_RECOVERIES) {
          recoveriesRef.current += 1;
          ultimaRecuperacionRef.current = Date.now();
          const resumeAt = video.currentTime;
          const wasPlaying = !video.paused;
          hls.once(Hls.Events.MANIFEST_PARSED, () => {
            video.currentTime = resumeAt;
            if (wasPlaying) void video.play().catch(() => {});
          });
          hls.loadSource(src);
          return;
        }

        // Un error de decodificacion se puede salvar sin recargar nada.
        if (data.type === Hls.ErrorTypes.MEDIA_ERROR && recoveriesRef.current < MAX_RECOVERIES) {
          recoveriesRef.current += 1;
          ultimaRecuperacionRef.current = Date.now();
          hls.recoverMediaError();
          return;
        }

        setError("No se pudo cargar el video. Recargá la página para seguir donde estabas.");
      });

      return () => {
        video.removeEventListener("timeupdate", alAvanzar);
        hls.destroy();
        hlsRef.current = null;
      };
    }

    // Safari / native HLS. This engine exposes no request hook at all, which is
    // why the token has to already be inside the manifest we serve it.
    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = src;

      const onLoaded = () => {
        setReady(true);
        applyResume();

        // hls.js reports tracks through AUDIO_TRACKS_UPDATED; here the only
        // source is WebKit's AudioTrackList. Without this the language selector
        // never appears on iPhone or iPad.
        const list = nativeAudioTracks(video);
        if (!list || list.length === 0) return;

        const tracks = Array.from({ length: list.length }, (_, id) => ({
          id,
          name: list[id].label || list[id].language || `Track ${id + 1}`,
          lang: list[id].language
        }));
        setStreamAudioTracks(tracks);

        const quiere = audioElegidoRef.current ?? preferredLocale;
        const preferred = tracks.find((t) => normalizeLocale(t.lang) === quiere);
        const target = preferred ?? tracks.find((_, id) => list[id].enabled) ?? tracks[0];
        for (let i = 0; i < list.length; i += 1) list[i].enabled = i === target.id;
        setActiveAudioId(target.id);
      };

      const onNativeError = () => {
        if (recoveriesRef.current >= MAX_RECOVERIES) {
          setError("No se pudo cargar el video. Recargá la página para seguir donde estabas.");
          return;
        }
        recoveriesRef.current += 1;
        ultimaRecuperacionRef.current = Date.now();
        const resumeAt = video.currentTime;
        const wasPlaying = !video.paused;

        const onReloaded = () => {
          video.currentTime = resumeAt;
          if (wasPlaying) void video.play().catch(() => {});
          video.removeEventListener("loadedmetadata", onReloaded);
        };
        video.addEventListener("loadedmetadata", onReloaded);

        video.src = src;
        video.load();
      };

      video.addEventListener("loadedmetadata", onLoaded);
      video.addEventListener("error", onNativeError);
      return () => {
        video.removeEventListener("timeupdate", alAvanzar);
        video.removeEventListener("loadedmetadata", onLoaded);
        video.removeEventListener("error", onNativeError);
      };
    }

    video.removeEventListener("timeupdate", alAvanzar);
    setError("Tu navegador no soporta este formato de video.");
  }, [src, initialPositionSeconds, durationSeconds, preferredLocale]);

  // Persist progress on pause / page hide / unmount.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onPause = () => saveProgress(true, video);
    const onTimeUpdate = () => saveProgress(false, video);
    const onBeforeUnload = () => saveProgress(true, video);
    // En el celular `beforeunload` casi nunca llega: se guarda tambien al
    // cambiar de app o de pestaña.
    const onOculta = () => { if (document.visibilityState === "hidden") saveProgress(true, video); };
    video.addEventListener("pause", onPause);
    video.addEventListener("timeupdate", onTimeUpdate);
    window.addEventListener("beforeunload", onBeforeUnload);
    window.addEventListener("pagehide", onBeforeUnload);
    document.addEventListener("visibilitychange", onOculta);
    return () => {
      video.removeEventListener("pause", onPause);
      video.removeEventListener("timeupdate", onTimeUpdate);
      window.removeEventListener("beforeunload", onBeforeUnload);
      window.removeEventListener("pagehide", onBeforeUnload);
      document.removeEventListener("visibilitychange", onOculta);
      saveProgress(true, video);
    };
  }, [saveProgress]);

  // ── Registro de actividad ────────────────────────────────────────────────
  // Efecto aparte del de progreso a proposito: si algun dia hay que apagar la
  // analitica, se saca este bloque entero sin tocar el guardado de posicion,
  // que es lo que la alumna nota si falla.
  useEffect(() => {
    if (!onActivity) return;
    const video = videoRef.current;
    if (!video) return;

    /** Cierra el tramo en curso y devuelve los segundos acumulados. */
    function corte(): number {
      if (playingSinceRef.current !== null) {
        watchedRef.current += (Date.now() - playingSinceRef.current) / 1000;
        playingSinceRef.current = Date.now();
      }
      const segundos = Math.round(watchedRef.current);
      watchedRef.current -= segundos; // conserva el resto decimal
      return segundos;
    }

    function posicion(): number {
      return video && Number.isFinite(video.currentTime) ? Math.floor(video.currentTime) : 0;
    }

    const onPlay = () => {
      playingSinceRef.current = Date.now();
      if (!startedRef.current) {
        startedRef.current = true;
        onActivity?.({ type: "video_start", positionSeconds: posicion(), secondsWatched: 0 });
      }
    };

    const onPause = () => {
      corte();
      playingSinceRef.current = null;
    };

    const onEnded = () => {
      const segundos = corte();
      playingSinceRef.current = null;
      if (!completedRef.current) {
        completedRef.current = true;
        onActivity?.({ type: "video_complete", positionSeconds: posicion(), secondsWatched: segundos });
      }
    };

    // Un latido por minuto, no cada 10 segundos como el progreso: son filas que
    // se guardan para siempre. Una clase de 40 minutos deja ~42 filas, no 240.
    const latido = window.setInterval(() => {
      if (playingSinceRef.current === null) return; // pausada: no se registra nada
      const segundos = corte();
      if (segundos <= 0) return;
      onActivity?.({ type: "video_heartbeat", positionSeconds: posicion(), secondsWatched: segundos });
    }, 60_000);

    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("ended", onEnded);

    return () => {
      window.clearInterval(latido);
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("ended", onEnded);
      // Al salir de la pantalla se manda lo que quedo suelto. Sin esto, quien
      // mira 40 segundos y cierra no aparece en ninguna metrica.
      const segundos = corte();
      if (segundos > 0) {
        onActivity?.({ type: "video_heartbeat", positionSeconds: posicion(), secondsWatched: segundos });
      }
    };
  }, [onActivity]);

  function switchAudio(id: number) {
    // Audios aparte: -1 = español (el del video), -2, -3... = cada mp3.
    if (audiosExternos.length > 0) {
      const locale = id === -1 ? null : audiosExternos[-id - 2]?.locale ?? null;
      audioElegidoRef.current = locale ?? "es";
      setAudioExterno(locale);
      // Se arranca DENTRO del toque: el iPhone no deja sonar un audio que no
      // empezo por un gesto de la alumna.
      const a = audioRef.current;
      const v = videoRef.current;
      if (locale && a && v) {
        const url = audiosExternos.find((x) => x.locale === locale)?.url;
        if (url && a.src !== url) a.src = url;
        a.currentTime = v.currentTime;
        if (!v.paused) void a.play().catch(() => {});
      }
      return;
    }
    const elegida = streamAudioTracks.find((t) => t.id === id);
    if (elegida) audioElegidoRef.current = normalizeLocale(elegida.lang);
    const hls = hlsRef.current;
    if (hls) {
      hls.audioTrack = id; // switches in-stream, no reload
      setActiveAudioId(id);
      return;
    }

    // Safari native: flip `enabled` on WebKit's AudioTrackList instead.
    const video = videoRef.current;
    const list = video ? nativeAudioTracks(video) : null;
    if (!list) return;
    for (let i = 0; i < list.length; i += 1) list[i].enabled = i === id;
    setActiveAudioId(id);
  }

  // Map stream tracks to the admin-provided labels when possible, then order
  // them the same way every time regardless of how the stream lists them.
  const selectorTracks = audiosExternos.length > 0
    ? [{ id: -1, locale: "es", label: "ES", name: "Espanol" }, ...audiosExternos.map((a, i) => ({ id: -i - 2, locale: a.locale, label: LOCALE_LABELS[a.locale] ?? a.locale.toUpperCase(), name: LOCALE_NAMES[a.locale] ?? a.locale }))]
    : streamAudioTracks
    .map((t) => {
      const locale = normalizeLocale(t.lang);
      const meta = audioTracks.find((a) => a.locale === locale);
      return {
        id: t.id,
        locale,
        label: LOCALE_LABELS[locale] ?? meta?.label ?? t.name,
        name: LOCALE_NAMES[locale] ?? meta?.label ?? t.name
      };
    })
    .sort((a, b) => {
      const rank = (locale: string) => {
        const index = LOCALE_ORDER.indexOf(locale);
        return index === -1 ? LOCALE_ORDER.length : index;
      };
      return rank(a.locale) - rank(b.locale);
    });

  function alternarSubtitulos() {
    const idiomas = pistasTexto.map((t) => t.locale);
    if (!idiomas.length) return;
    // Primero el de su idioma (o el del audio que eligio), despues los demas.
    const quiere = audioElegidoRef.current ?? preferredLocale;
    const orden = [...idiomas].sort((a, b) => Number(b === quiere) - Number(a === quiere));
    const siguiente = subtituloActivo === null ? orden[0] : orden[orden.indexOf(subtituloActivo) + 1] ?? null;
    setSubtituloActivo(siguiente);
  }

  // Aplica el subtitulo elegido a las pistas del <video>.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const aplicar = () => {
      for (const t of Array.from(v.textTracks)) {
        if (t.kind !== "subtitles" && t.kind !== "captions") continue;
        t.mode = subtituloActivo && t.language === subtituloActivo ? "showing" : "disabled";
        // Un poco mas arriba del borde: abajo de todo los tapaba la barra.
        for (const c of Array.from(t.cues ?? [])) { const cue = c as VTTCue; if (cue.line === "auto") cue.line = -4; }
      }
    };
    aplicar();
    // Las frases llegan despues de activar la pista: se acomodan cuando cargan.
    const pistas = Array.from(v.querySelectorAll("track"));
    pistas.forEach((el) => el.addEventListener("load", aplicar));
    v.textTracks.addEventListener?.("addtrack", aplicar);
    return () => {
      pistas.forEach((el) => el.removeEventListener("load", aplicar));
      v.textTracks.removeEventListener?.("addtrack", aplicar);
    };
  }, [subtituloActivo, pistasTexto]);

  // Baja los .vtt una sola vez.
  const clavesSubtitulos = subtitulosExternos.map((x) => x.locale).join(",");
  useEffect(() => {
    let vivo = true;
    const creadas: string[] = [];
    void Promise.all(subtitulosExternos.map(async (x) => {
      try {
        const r = await fetch(x.url);
        if (!r.ok) return null;
        const src = URL.createObjectURL(new Blob([await r.text()], { type: "text/vtt" }));
        creadas.push(src);
        return { locale: x.locale, src };
      } catch { return null; }
    })).then((lista) => { if (vivo) setPistasTexto(lista.filter((x): x is { locale: string; src: string } => !!x)); });
    return () => { vivo = false; creadas.forEach((u) => URL.revokeObjectURL(u)); };
    // Los enlaces firmados cambian en cada visita; los idiomas, no.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clavesSubtitulos]);

  // ── Audio en otro idioma, sincronizado con el video ─────────────────────
  // El video sigue mandando (barra, saltos, pausa); el mp3 lo sigue. Si se
  // corre mas de un tercio de segundo, se lo vuelve a poner en su lugar.
  useEffect(() => {
    const v = videoRef.current;
    const a = audioRef.current;
    if (!v || !a) return;
    if (!audioExterno) {
      a.pause();
      v.muted = false;
      return;
    }
    const url = audiosExternos.find((x) => x.locale === audioExterno)?.url;
    if (!url) return;
    if (a.src !== url) a.src = url;
    v.muted = true;

    const alinear = () => { if (Math.abs(a.currentTime - v.currentTime) > 0.35) a.currentTime = v.currentTime; };
    const sonar = () => { alinear(); a.playbackRate = v.playbackRate; void a.play().catch(() => {}); };
    const callar = () => a.pause();
    const alSaltar = () => { a.currentTime = v.currentTime; };
    const alSeguir = () => { if (!v.paused) sonar(); };
    const alVelocidad = () => { a.playbackRate = v.playbackRate; };

    v.addEventListener("play", sonar);
    v.addEventListener("playing", alSeguir);
    v.addEventListener("pause", callar);
    v.addEventListener("waiting", callar);
    v.addEventListener("seeking", alSaltar);
    v.addEventListener("seeked", alSeguir);
    v.addEventListener("ratechange", alVelocidad);
    const vigilar = window.setInterval(() => {
      if (v.paused) return;
      if (a.paused && v.readyState >= 3) sonar();
      else alinear();
    }, 1000);
    alinear();
    if (!v.paused) sonar();

    return () => {
      window.clearInterval(vigilar);
      v.removeEventListener("play", sonar);
      v.removeEventListener("playing", alSeguir);
      v.removeEventListener("pause", callar);
      v.removeEventListener("waiting", callar);
      v.removeEventListener("seeking", alSaltar);
      v.removeEventListener("seeked", alSeguir);
      v.removeEventListener("ratechange", alVelocidad);
    };
  }, [audioExterno, audiosExternos]);

  const selectorAudio = selectorTracks.length > 1 ? (
    <div role="group" aria-label="Idioma del audio" style={{ display: "flex", gap: 6 }}>
      {selectorTracks.map((t) => {
        const isActive = audiosExternos.length > 0 ? t.locale === (audioExterno ?? "es") : t.id === activeAudioId;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => switchAudio(t.id)}
            title={`Audio en ${t.name}`}
            aria-label={`Audio en ${t.name}`}
            aria-pressed={isActive}
            style={{
              minWidth: 44,
              height: 34,
              padding: "0 13px",
              fontSize: 11,
              letterSpacing: "0.12em",
              fontWeight: 800,
              cursor: "pointer",
              background: isActive ? "#E64F55" : "rgba(28,22,24,0.6)",
              color: isActive ? "#FDF8F6" : "rgba(253,248,246,0.8)",
              border: `1px solid ${isActive ? "#E64F55" : "rgba(253,248,246,0.3)"}`,
              borderRadius: 20,
              backdropFilter: "blur(4px)"
            }}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  ) : null;

  return (
    <div
      ref={contenedorRef}
      style={{ position: "relative", borderRadius: 22, overflow: "hidden", background: "#1C1618", aspectRatio: "16/9" }}
    >
      <video
        ref={videoRef}
        poster={poster ?? undefined}
        playsInline
        preload="metadata"
        // Sin controles del navegador: los dibuja ControlesReproductor (ver
        // por que en ese archivo). Sin "Descargar" ni "Guardar video como":
        // el video llega en pedacitos con enlaces firmados que vencen.
        controlsList="nodownload noremoteplayback"
        disablePictureInPicture={false}
        onContextMenu={(e) => e.preventDefault()}
        style={{ width: "100%", height: "100%", objectFit: "contain", background: "#1C1618", display: "block" }}
      >
        {pistasTexto.map((t) => (
          <track key={t.locale} kind="subtitles" srcLang={t.locale} label={LOCALE_NAMES[t.locale] ?? t.locale} src={t.src} />
        ))}
      </video>
      {audiosExternos.length > 0 && <audio ref={audioRef} preload="auto" hidden />}

      {!error && (
        <ControlesReproductor
          videoRef={videoRef}
          contenedorRef={contenedorRef}
          listo={ready}
          duracionRespaldo={durationSeconds}
          selectorAudio={selectorAudio}
          haySubtitulos={pistasTexto.length > 0}
          subtituloActivo={subtituloActivo}
          onSubtitulos={alternarSubtitulos}
          audioRef={audioExterno ? audioRef : undefined}
        />
      )}

      {!ready && !error && (
        <div style={{ position: "absolute", inset: 0, zIndex: 4, pointerEvents: "none", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(253,248,246,0.75)", fontSize: 13, fontWeight: 700, letterSpacing: "0.04em" }}>
          Cargando la clase…
        </div>
      )}
      {error && (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#FDF8F6", fontSize: 14, fontWeight: 700, padding: 24, textAlign: "center" }}>
          {error}
        </div>
      )}
    </div>
  );
}
