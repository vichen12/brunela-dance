"use client";

import { useCallback, useMemo, useRef } from "react";
import { VideoPlayer, type PlayerAudioTrack } from "@/components/video-player";

type Props = {
  src: string;
  poster?: string | null;
  audioTracks: PlayerAudioTrack[];
  durationSeconds: number;
  initialPositionSeconds?: number;
  preferredLocale?: string;
  videoId: string;
  videoSlug?: string | null;
  programId?: string | null;
  programDayNumber?: number | null;
};

/**
 * Identificador de ESTA reproduccion.
 *
 * crypto.randomUUID() no existe en Safari anterior a 15.4, y el reproductor en
 * iPhone es justamente la parte del sistema que sigue sin verificarse (ver
 * CLAUDE.md). Que la analitica tire una excepcion ahi le cortaria la clase a la
 * alumna, asi que hay salida por abajo.
 */
function nuevaSesion(): string {
  const c = globalThis.crypto as Crypto | undefined;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  const h = (n: number) =>
    Array.from({ length: n }, () => Math.floor(Math.random() * 16).toString(16)).join("");
  return `${h(8)}-${h(4)}-4${h(3)}-a${h(3)}-${h(12)}`;
}

/**
 * Client wrapper that owns the progress persistence side-effect, keeping
 * VideoPlayer itself free of data-fetching concerns.
 */
export function VideoPlayerPanel({
  src,
  poster,
  audioTracks,
  durationSeconds,
  initialPositionSeconds,
  preferredLocale,
  videoId,
  videoSlug,
  programId,
  programDayNumber
}: Props) {
  const inFlight = useRef(false);
  // Se genera una vez por montaje: reproducir la misma clase manana es otra
  // sesion, y esa es exactamente la diferencia entre "una alumna la vio entera"
  // y "cinco vieron el primer minuto".
  const sessionId = useMemo(() => nuevaSesion(), []);

  const handleProgress = useCallback(
    (lastPositionSeconds: number, completionPercent: number) => {
      if (inFlight.current) return;
      inFlight.current = true;
      // keepalive lets the final save survive a page unload.
      fetch("/api/progress", {
        method: "POST",
        headers: { "content-type": "application/json" },
        keepalive: true,
        body: JSON.stringify({
          videoId,
          programId: programId ?? null,
          programDayNumber: programDayNumber ?? null,
          lastPositionSeconds,
          completionPercent
        })
      })
        .catch(() => {})
        .finally(() => {
          inFlight.current = false;
        });
    },
    [videoId, programId, programDayNumber]
  );

  const handleActivity = useCallback(
    (e: { type: string; positionSeconds: number; secondsWatched: number }) => {
      // Sin `inFlight`, a diferencia del progreso: aca cada evento es un hecho
      // distinto y descartar uno seria perder historia, no repetir un guardado.
      // Van uno por minuto como mucho, asi que no hay riesgo de avalancha.
      fetch("/api/activity", {
        method: "POST",
        headers: { "content-type": "application/json" },
        keepalive: true,
        body: JSON.stringify({
          eventType: e.type,
          videoId,
          videoSlug: videoSlug ?? null,
          programId: programId ?? null,
          sessionId,
          positionSeconds: e.positionSeconds,
          secondsWatched: e.secondsWatched,
        }),
      }).catch(() => {});
    },
    [videoId, videoSlug, programId, sessionId]
  );

  return (
    <VideoPlayer
      src={src}
      poster={poster}
      audioTracks={audioTracks}
      durationSeconds={durationSeconds}
      initialPositionSeconds={initialPositionSeconds}
      preferredLocale={preferredLocale}
      onProgress={handleProgress}
      onActivity={handleActivity}
    />
  );
}
