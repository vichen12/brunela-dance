"use client";

import { useRef, useState } from "react";
import { Play, Volume2, VolumeX } from "lucide-react";
import { T } from "@/components/language-provider";

export function VideoShowcase() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);

  function toggleSound() {
    const video = videoRef.current;
    if (!video) return;

    const nextMuted = !muted;
    video.muted = nextMuted;
    setMuted(nextMuted);

    if (!nextMuted) {
      void video.play();
    }
  }

  return (
    <section className="video-showcase-section" aria-label="Video Brunela Dance Trainer">
      <div className="video-showcase-frame">
        <video
          ref={videoRef}
          className="video-showcase-media"
          poster="/fotos-landing/about-hero.jpg.jpg"
          autoPlay
          loop
          muted
          playsInline
          preload="metadata"
        >
          <source src="/videos/brunela-trailer.mp4" type="video/mp4" />
        </video>

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
          <button className="video-sound-button" type="button" onClick={toggleSound}>
            {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            <span>{muted ? <T id="video.soundOn" /> : <T id="video.soundOff" />}</span>
            <Play size={14} fill="currentColor" />
          </button>
        </div>
      </div>
    </section>
  );
}
