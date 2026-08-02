"use client";

import { useCallback, useRef } from "react";
import { VideoPlayer, type PlayerAudioTrack } from "@/components/video-player";

type Props = {
  src: string;
  poster?: string | null;
  audioTracks: PlayerAudioTrack[];
  durationSeconds: number;
  initialPositionSeconds?: number;
  preferredLocale?: string;
  videoId: string;
  programId?: string | null;
  programDayNumber?: number | null;
};

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
  programId,
  programDayNumber
}: Props) {
  const inFlight = useRef(false);

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

  return (
    <VideoPlayer
      src={src}
      poster={poster}
      audioTracks={audioTracks}
      durationSeconds={durationSeconds}
      initialPositionSeconds={initialPositionSeconds}
      preferredLocale={preferredLocale}
      onProgress={handleProgress}
    />
  );
}
