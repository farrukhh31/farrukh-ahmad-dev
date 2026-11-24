"use client";

import { useEffect, useRef, useState } from "react";
import { Film, Pause, Play, Volume2, VolumeX } from "lucide-react";
import { duckMusic } from "@/lib/game/music";
import { Card, Eyebrow } from "./shared";

/** Promo video slot. */
export const PROMO_SRC = "/videos/promo.mp4";
const BLUE = "#60a5fa";

export default function CinemaPanel() {
  const video = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);

  // Opening the cinema starts the film from the beginning, with sound.
  // Opening a panel is a user action, so browsers normally allow sound; if not, fall back to muted.
  useEffect(() => {
    const el = video.current;
    if (!el) return;
    el.currentTime = 0;
    el.muted = false;
    el.play().catch(() => {
      el.muted = true;
      setMuted(true);
      el.play().catch(() => {});
    });
    return () => el.pause();
  }, []);

  // keep the background music out of the way while the film plays
  useEffect(() => {
    if (playing) duckMusic(true, muted ? 0.35 : 0.06);
  }, [playing, muted]);

  const toggle = () => {
    const el = video.current;
    if (!el) return;
    if (el.paused) void el.play();
    else el.pause();
  };
  const toggleSound = () => {
    const el = video.current;
    if (!el) return;
    el.muted = !el.muted;
    setMuted(el.muted);
  };

  return (
    <div>
      <Eyebrow color={BLUE}>Now showing</Eyebrow>
      <h3 className="mt-2 text-xl font-semibold text-white">The 46-second introduction</h3>
      <p className="mt-1 text-sm text-slate-400">An animated promo made in After Effects.</p>

      <Card accent={BLUE} lift={false} className="mt-5 p-2 sm:p-2.5">
        <div className="mb-2 flex items-center gap-1.5 px-2 pt-1">
          <span className="h-2 w-2 rounded-full bg-rose-400/80" />
          <span className="h-2 w-2 rounded-full bg-amber-300/80" />
          <span className="h-2 w-2 rounded-full bg-emerald-400/80" />
          <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.25em] text-slate-500">promo.mp4</span>
          {!failed && (
            <span className="ml-auto flex items-center gap-1.5">
              <button
                type="button"
                onClick={toggle}
                aria-label={playing ? "Pause video" : "Play video"}
                className="grid h-7 w-7 place-items-center rounded-full border border-white/10 bg-white/5 text-slate-200 transition hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-cyan-300"
              >
                {playing ? <Pause size={13} /> : <Play size={13} />}
              </button>
              <button
                type="button"
                onClick={toggleSound}
                aria-label={muted ? "Turn video sound on" : "Turn video sound off"}
                className="grid h-7 w-7 place-items-center rounded-full border border-white/10 bg-white/5 text-slate-200 transition hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-cyan-300"
              >
                {muted ? <VolumeX size={13} /> : <Volume2 size={13} />}
              </button>
            </span>
          )}
        </div>
        {failed ? (
          <div className="grid aspect-video place-items-center rounded-xl border border-dashed border-blue-400/30 bg-blue-400/[0.04] p-6 text-center">
            <div>
              <Film className="mx-auto text-blue-300" size={28} />
              <p className="mt-3 text-sm font-medium text-white">Promo video not found</p>
              <p className="mt-1 text-xs text-slate-400">Expected at {PROMO_SRC}.</p>
            </div>
          </div>
        ) : (
          <video
            ref={video}
            src={PROMO_SRC}
            poster="/videos/promo-poster.jpg"
            controls
            playsInline
            preload="auto"
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onVolumeChange={(e) => setMuted(e.currentTarget.muted)}
            onError={() => setFailed(true)}
            className="aspect-video w-full rounded-xl bg-black"
          />
        )}
      </Card>
    </div>
  );
}
