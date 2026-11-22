"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import ModeLink from "@/components/PlayCTA/ModeLink";
import { useTheme } from "next-themes";
import { ArrowRight, Compass, Gamepad2, LayoutList, Moon, Music, Sun, VolumeX } from "lucide-react";

import { useWebglSupport } from "@/hooks/useWebglSupport";
import { useGameAudio } from "@/components/game/useGameAudio";
import { useMusicPref } from "@/components/game/useMusicPref";
import { initAudio } from "@/lib/game/audio";
import { setMusicOn } from "@/lib/game/music";
import { useGame } from "@/lib/game/store";
import { TOUR_STOPS } from "@/lib/tour/stops";

// three.js must never run on the server
const TourScene = dynamic(() => import("./TourScene"), { ssr: false });

const N = TOUR_STOPS.length;

export default function TourRoot() {
  const webgl = useWebglSupport();
  useGameAudio(); // starts the audio engine on the first click or key press
  const music = useMusicPref();
  const progress = useRef({ current: 0 });
  const [active, setActive] = useState(0);
  const [ready, setReady] = useState(false); // first frames of the 3D scene have rendered
  const [minDone, setMinDone] = useState(false); // keep the intro on screen long enough to read
  const [gone, setGone] = useState(false);
  const loaded = ready && minDone;
  const { resolvedTheme, setTheme } = useTheme();
  const light = resolvedTheme === "light";
  const setActiveZone = useGame((s) => s.setActiveZone);

  useEffect(() => {
    const t = setTimeout(() => setMinDone(true), 1500);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => {
    if (!loaded) return;
    const t = setTimeout(() => setGone(true), 800);
    return () => clearTimeout(t);
  }, [loaded]);
  // no scrolling behind the loading screen
  useEffect(() => {
    document.documentElement.style.overflow = gone ? "" : "hidden";
    return () => {
      document.documentElement.style.overflow = "";
    };
  }, [gone]);

  // scroll position -> flight progress
  useEffect(() => {
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      progress.current.current = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  // first visit: bright daytime archipelago
  useEffect(() => {
    try {
      if (!localStorage.getItem("farrukh-day-default")) {
        localStorage.setItem("farrukh-day-default", "1");
        setTheme("light");
      }
    } catch {
      /* storage blocked */
    }
  }, [setTheme]);

  // light up the island the camera is visiting, and clean up when leaving
  useEffect(() => {
    setActiveZone(TOUR_STOPS[active]?.zone ?? null);
  }, [active, setActiveZone]);
  useEffect(() => () => setActiveZone(null), [setActiveZone]);

  const goTo = useCallback((i: number) => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    window.scrollTo({ top: (i / (N - 1)) * max, behavior: "smooth" });
  }, []);

  if (!webgl) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#bcd6dc] p-6 text-center text-slate-900">
        <div>
          <h1 className="text-xl font-semibold">3D isn&apos;t available on this device</h1>
          <p className="mt-2 text-slate-700">Your browser couldn&apos;t start WebGL, so the flight can&apos;t run.</p>
          <a href="/" className="mt-5 inline-block rounded-xl bg-slate-900 px-5 py-2.5 text-white">Open the regular portfolio</a>
        </div>
      </div>
    );
  }

  const stop = TOUR_STOPS[active];
  const left = active % 2 === 0;
  const glass = light
    ? "border-white/70 bg-white/70 text-slate-900 shadow-[0_20px_60px_-20px_rgba(30,70,90,.45)]"
    : "border-white/10 bg-slate-950/70 text-white shadow-[0_20px_60px_-20px_rgba(0,0,0,.8)]";
  const muted = light ? "text-slate-600" : "text-slate-400";
  const pill = light
    ? "border-white/70 bg-white/70 text-slate-800 hover:bg-white/90"
    : "border-white/15 bg-slate-950/70 text-slate-200 hover:bg-slate-900/90";

  return (
    <div className="relative">
      {/* scroll distance that drives the flight */}
      <div aria-hidden style={{ height: `${N * 90}vh` }} />

      <div className="fixed inset-0 bg-[#bcd6dc]">
        <TourScene progress={progress.current} onStop={setActive} onReady={() => setReady(true)} />
      </div>

      <div className="pointer-events-none fixed inset-0 z-10">
        {/* top bar */}
        <header className="flex items-start justify-between gap-3 p-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:p-5">
          <div className={`pointer-events-auto rounded-2xl border px-4 py-2.5 backdrop-blur-xl ${glass}`}>
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-cyan-500">Farrukh · Archipelago</p>
            <p className={`mt-0.5 text-xs ${muted}`}>Scroll tour</p>
          </div>

          <nav aria-label="Switch mode" className="pointer-events-auto flex flex-wrap justify-end gap-2">
            <span aria-current="page" className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold backdrop-blur-xl ${glass}`}>
              <Compass size={14} /> Tour
            </span>
            <ModeLink href="/play" className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium backdrop-blur-xl transition ${pill}`}>
              <Gamepad2 size={14} /> Explore
            </ModeLink>
            <ModeLink href="/" className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium backdrop-blur-xl transition ${pill}`}>
              <LayoutList size={14} /> Recruiter mode
            </ModeLink>
            <button
              type="button"
              onClick={() => {
                initAudio(); // a click is the gesture browsers require before sound can play
                setMusicOn(!music.on);
              }}
              aria-label={music.on ? "Turn music off" : "Turn music on"}
              aria-pressed={music.on}
              className={`grid h-9 w-9 place-items-center rounded-xl border backdrop-blur-xl transition ${pill}`}
            >
              {music.on ? <Music size={14} /> : <VolumeX size={14} />}
            </button>
            <button
              type="button"
              onClick={() => setTheme(light ? "dark" : "light")}
              aria-label={light ? "Switch to night" : "Switch to day"}
              className={`grid h-9 w-9 place-items-center rounded-xl border backdrop-blur-xl transition ${pill}`}
            >
              {light ? <Moon size={14} /> : <Sun size={14} />}
            </button>
          </nav>
        </header>

        {/* stop card */}
        <section
          key={stop.id}
          aria-live="polite"
          className={`panel-rise pointer-events-auto absolute bottom-[max(1.25rem,env(safe-area-inset-bottom))] left-3 right-3 max-w-md rounded-3xl border p-5 backdrop-blur-xl sm:bottom-10 sm:p-6 ${glass} ${left ? "md:left-10 md:right-auto" : "md:left-auto md:right-16"}`}
        >
          <div className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-[0.25em]" style={{ color: stop.color }}>
              <span className="h-2 w-2 rounded-full" style={{ background: stop.color, boxShadow: `0 0 12px ${stop.color}` }} />
              {stop.kicker}
            </span>
            <span className={`font-mono text-[11px] tabular-nums ${muted}`}>{String(active + 1).padStart(2, "0")} / {String(N).padStart(2, "0")}</span>
          </div>
          <h2 className="mt-3 text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">{stop.title}</h2>
          <p className={`mt-0.5 text-sm italic ${muted}`}>{stop.tagline}</p>
          <p className="mt-3 text-[14px] leading-relaxed">{stop.body}</p>
          {stop.fact && (
            <p className="mt-3 inline-block rounded-full border px-3 py-1 text-xs font-medium" style={{ borderColor: `${stop.color}66`, background: `${stop.color}18`, color: light ? "#0f172a" : stop.color }}>
              {stop.fact}
            </p>
          )}
          <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
            {stop.id === "overview" ? (
              <button type="button" onClick={() => goTo(1)} className="flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2.5 text-white transition hover:bg-slate-700">
                Start the tour <ArrowRight size={13} />
              </button>
            ) : (
              <ModeLink href={stop.zone && stop.zone !== "plaza" ? `/play?zone=${stop.zone}` : "/play"} className="flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2.5 text-white transition hover:bg-slate-700">
                <Gamepad2 size={13} /> {stop.zone && stop.zone !== "plaza" ? "Visit this island" : "Play the game"}
              </ModeLink>
            )}
            {stop.detail && (
              <ModeLink href={`/#${stop.detail}`} className={`flex items-center gap-1.5 rounded-xl border px-4 py-2.5 transition ${pill}`}>
                Read the details
              </ModeLink>
            )}
          </div>
        </section>

        {/* stop rail */}
        <nav aria-label="Tour stops" className="pointer-events-auto absolute right-3 top-1/2 hidden -translate-y-1/2 flex-col gap-2.5 sm:flex">
          {TOUR_STOPS.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => goTo(i)}
              aria-label={`Go to ${s.title}`}
              aria-current={i === active ? "step" : undefined}
              title={s.title}
              className="group grid h-4 w-4 place-items-center"
            >
              <span
                className="block rounded-full transition-all"
                style={{
                  width: i === active ? 12 : 7,
                  height: i === active ? 12 : 7,
                  background: i === active ? s.color : light ? "rgba(15,23,42,.35)" : "rgba(255,255,255,.4)",
                  boxShadow: i === active ? `0 0 14px ${s.color}` : undefined,
                }}
              />
            </button>
          ))}
        </nav>

        {active === 0 && (
          <p className={`absolute bottom-3 left-1/2 hidden -translate-x-1/2 items-center gap-2 text-xs sm:flex ${light ? "text-slate-700" : "text-slate-300"}`}>
            Scroll to begin <span aria-hidden className="inline-block animate-bounce">↓</span>
          </p>
        )}
      </div>

      {!gone && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed inset-0 z-50 grid place-items-center bg-linear-to-b from-[#a9c4cc] to-[#e4f1f3] transition-opacity duration-700 ${loaded ? "pointer-events-none opacity-0" : "opacity-100"}`}
        >
          <div className="px-6 text-center text-slate-900">
            <p className="font-mono text-[11px] uppercase tracking-[0.4em] text-slate-600">Farrukh · Archipelago</p>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">Preparing the tour</h1>
            <div className="mx-auto mt-8 h-1.5 w-56 overflow-hidden rounded-full bg-slate-900/10">
              <div className="bar-fill h-full rounded-full bg-slate-900/70 transition-[width] duration-[1400ms] ease-out" style={{ width: ready ? "100%" : "82%" }} />
            </div>
            <p className="mt-4 text-xs text-slate-600">{ready ? "Ready" : "Building the islands…"}</p>
          </div>
        </div>
      )}

      {/* the same content in reading order for screen readers */}
      <ol className="sr-only">
        {TOUR_STOPS.map((s) => (
          <li key={s.id}>
            <h2>{s.title}</h2>
            <p>{s.kicker}. {s.tagline}. {s.body}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}
