"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Hls from "hls.js";

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
  preferredLocale = "es",
  onProgress,
  onActivity
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const lastSavedRef = useRef(0);
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

  const saveProgress = useCallback(
    (force = false) => {
      const video = videoRef.current;
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
      const percent = total > 0 ? Math.min(100, Math.round((position / total) * 100)) : 0;
      onProgress(position, percent);
    },
    [durationSeconds, onProgress]
  );

  // Set up HLS (or native) once.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    function applyResume() {
      if (video && initialPositionSeconds > 0 && initialPositionSeconds < (durationSeconds || Infinity)) {
        video.currentTime = initialPositionSeconds;
      }
    }

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
        const preferred = tracks.find((t) => normalizeLocale(t.lang) === preferredLocale);
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
          const resumeAt = video.currentTime;
          const wasPlaying = !video.paused;
          hls.once(Hls.Events.MANIFEST_PARSED, () => {
            video.currentTime = resumeAt;
            if (wasPlaying) void video.play().catch(() => {});
          });
          hls.loadSource(src);
          return;
        }

        setError("No se pudo cargar el video.");
      });

      return () => {
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

        const preferred = tracks.find((t) => normalizeLocale(t.lang) === preferredLocale);
        const target = preferred ?? tracks.find((_, id) => list[id].enabled) ?? tracks[0];
        for (let i = 0; i < list.length; i += 1) list[i].enabled = i === target.id;
        setActiveAudioId(target.id);
      };

      const onNativeError = () => {
        if (recoveriesRef.current >= MAX_RECOVERIES) {
          setError("No se pudo cargar el video.");
          return;
        }
        recoveriesRef.current += 1;
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
        video.removeEventListener("loadedmetadata", onLoaded);
        video.removeEventListener("error", onNativeError);
      };
    }

    setError("Tu navegador no soporta este formato de video.");
  }, [src, initialPositionSeconds, durationSeconds, preferredLocale]);

  // Persist progress on pause / page hide / unmount.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onPause = () => saveProgress(true);
    const onTimeUpdate = () => saveProgress(false);
    const onBeforeUnload = () => saveProgress(true);
    video.addEventListener("pause", onPause);
    video.addEventListener("timeupdate", onTimeUpdate);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      video.removeEventListener("pause", onPause);
      video.removeEventListener("timeupdate", onTimeUpdate);
      window.removeEventListener("beforeunload", onBeforeUnload);
      saveProgress(true);
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
  const selectorTracks = streamAudioTracks
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

  return (
    <div style={{ position: "relative", borderRadius: 22, overflow: "hidden", background: "#1C1618", aspectRatio: "16/9" }}>
      <video
        ref={videoRef}
        poster={poster ?? undefined}
        controls
        playsInline
        style={{ width: "100%", height: "100%", objectFit: "contain", background: "#1C1618" }}
      />

      {/* Audio-track selector — only when the stream has >1 audio rendition */}
      {selectorTracks.length > 1 && (
        <div
          role="group"
          aria-label="Idioma del audio"
          style={{ position: "absolute", top: 14, right: 14, display: "flex", gap: 6, zIndex: 5 }}
        >
          {selectorTracks.map((t) => {
            const isActive = t.id === activeAudioId;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => switchAudio(t.id)}
                title={`Audio en ${t.name}`}
                aria-label={`Audio en ${t.name}`}
                aria-pressed={isActive}
                style={{
                  padding: "5px 13px",
                  fontSize: 10,
                  letterSpacing: "0.12em",
                  fontWeight: 700,
                  cursor: "pointer",
                  background: isActive ? "#B8857F" : "rgba(28,22,24,0.6)",
                  color: isActive ? "#FDF8F6" : "rgba(253,248,246,0.65)",
                  border: `1px solid ${isActive ? "#B8857F" : "rgba(253,248,246,0.25)"}`,
                  borderRadius: 20,
                  backdropFilter: "blur(4px)"
                }}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      )}

      {!ready && !error && (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(253,248,246,0.7)", fontSize: 12, letterSpacing: "0.1em" }}>
          Cargando video…
        </div>
      )}
      {error && (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#F0A0A0", fontSize: 12, padding: 24, textAlign: "center" }}>
          {error}
        </div>
      )}
    </div>
  );
}
