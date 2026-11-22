"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useWebglSupport } from "@/hooks/useWebglSupport";
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { useGame } from "@/lib/game/store";
import { useGameKeyboard } from "./useGameKeyboard";
import { useGameAudio } from "./useGameAudio";
import Hud from "./Hud";
import StartScreen from "./StartScreen";
import startStyles from "./startScreen.module.css";
import GameAnalytics from "@/components/analytics/GameAnalytics";

// three.js must never run on the server
const Scene = dynamic(() => import("./Scene"), { ssr: false });

export default function GameRoot() {
  const webgl = useWebglSupport();
  useGameKeyboard();
  useGameAudio();
  const [started, setStarted] = useState(false); // true once the player pressed Start

  // accessibility preferences become classes on <html> (see globals.css)
  const motionPref = useGame((s) => s.motionPref);
  const highContrast = useGame((s) => s.highContrast);
  const largeText = useGame((s) => s.largeText);
  useEffect(() => {
    const el = document.documentElement;
    el.classList.toggle("a11y-reduce-motion", motionPref === "reduce");
    el.classList.toggle("a11y-high-contrast", highContrast);
    el.classList.toggle("a11y-large-text", largeText);
    return () => el.classList.remove("a11y-reduce-motion", "a11y-high-contrast", "a11y-large-text");
  }, [motionPref, highContrast, largeText]);

  // first visit: start in the bright daytime archipelago (the player can still switch to night)
  const { setTheme } = useTheme();
  useEffect(() => {
    try {
      if (!localStorage.getItem("farrukh-day-default")) {
        localStorage.setItem("farrukh-day-default", "1");
        setTheme("light");
      }
    } catch {
      /* storage blocked: keep whatever theme is active */
    }
  }, [setTheme]);

  // stop pull-to-refresh / rubber-banding from fighting the game on phones
  useEffect(() => {
    const el = document.documentElement;
    const prev = el.style.overscrollBehavior;
    el.style.overscrollBehavior = "none";
    return () => {
      el.style.overscrollBehavior = prev;
    };
  }, []);

  if (!webgl) {
    return (
      <div className="grid min-h-screen place-items-center p-6 text-center">
        <div>
          <h1 className="text-xl font-semibold text-white">3D isn&apos;t available on this device</h1>
          <p className="mt-2 text-slate-400">Your browser couldn&apos;t start WebGL, so the playable world can&apos;t run.</p>
          <Link href="/" className="mt-5 inline-block rounded-xl bg-cyan-400/20 px-5 py-2.5 text-cyan-200 hover:bg-cyan-400/30">
            Open the regular portfolio
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 overflow-hidden bg-[#030712]">
      <Link href="/" className="skip-link">Skip the game: open the regular portfolio</Link>
      <div className="absolute inset-0 touch-none">
        <Scene />
      </div>
      <div className={`pointer-events-none absolute inset-0 ${started ? startStyles.hudEnter : ""}`}>
        <Hud />
      </div>
      <StartScreen onStart={() => setStarted(true)} />
      <GameAnalytics />
    </div>
  );
}
