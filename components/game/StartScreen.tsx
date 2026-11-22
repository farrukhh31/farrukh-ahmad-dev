"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { useProgress } from "@react-three/drei";
import { initAudio, setMuted, sfx } from "@/lib/game/audio";
import { useGame } from "@/lib/game/store";
import styles from "./startScreen.module.css";

const TITLE = "DEV HUB";
const MIN_SHOW_MS = 1800; // let the intro animation play even when assets load instantly
const OPEN_MS = 1300; // length of the door-opening reveal
const TIPS = [
  "Move with WASD or the arrow keys. On a phone, use the joystick.",
  "Walk up to a building and press E or Enter to open it.",
  "Collect skill orbs and visit every zone to earn XP.",
  "Press H at any time to see the controls again.",
];

type Phase = "loading" | "ready" | "opening" | "done";

/**
 * Replaces the plain loading bar: animated title while the world loads, a "Press Start"
 * button once it is ready, then the doors slide apart. Starting also unlocks browser audio.
 */
export default function StartScreen({ onStart }: { onStart?: () => void }) {
  const { progress, active } = useProgress();
  const [phase, setPhase] = useState<Phase>("loading");
  const [loaded, setLoaded] = useState(false);
  const [minElapsed, setMinElapsed] = useState(false);
  const [tip, setTip] = useState(0);
  const button = useRef<HTMLButtonElement>(null);
  const startedRef = useRef(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setMinElapsed(true), MIN_SHOW_MS);
    return () => clearTimeout(t);
  }, []);

  // same idea as the old overlay: wait for assets, but never get stuck if loading stalls
  useEffect(() => {
    if (!active && progress >= 100) {
      const t = setTimeout(() => setLoaded(true), 500);
      return () => clearTimeout(t);
    }
    const fallback = setTimeout(() => setLoaded(true), 3000);
    return () => clearTimeout(fallback);
  }, [active, progress]);

  useEffect(() => {
    if (phase === "loading" && loaded && minElapsed) setPhase("ready");
  }, [phase, loaded, minElapsed]);

  useEffect(() => {
    if (phase === "ready") button.current?.focus();
  }, [phase]);

  useEffect(() => {
    const id = setInterval(() => setTip((n) => (n + 1) % TIPS.length), 3200);
    return () => clearInterval(id);
  }, []);

  useEffect(() => () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  }, []);

  const start = useCallback(() => {
    if (phase !== "ready" || startedRef.current) return;
    startedRef.current = true;
    initAudio(); // this click/keypress is the user gesture browsers require
    setMuted(useGame.getState().muted);
    sfx.open();
    setPhase("opening");
    onStart?.();
    closeTimer.current = setTimeout(() => setPhase("done"), OPEN_MS);
  }, [phase, onStart]);

  // While this screen is up, Enter / Space / E start the game instead of poking the world behind it.
  useEffect(() => {
    if (phase === "done") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Enter" || e.code === "Space" || e.code === "KeyE") {
        e.preventDefault();
        e.stopPropagation();
        if (!e.repeat) start();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [phase, start]);

  if (phase === "done") return null;

  const pct = Math.min(100, Math.round(progress));

  return (
    <div className={styles.root} data-phase={phase} role="dialog" aria-label="Start the game">
      <div className={`${styles.half} ${styles.left}`} />
      <div className={`${styles.half} ${styles.right}`} />
      <div className={styles.seam} />

      <div className={styles.content}>
        <div className={styles.grid} />
        <div className={`${styles.orb} ${styles.orbA}`} />
        <div className={`${styles.orb} ${styles.orbB}`} />

        <div className={styles.center}>
          <div className={styles.ring} />
          <p className={styles.kicker}>Farrukh&apos;s playable portfolio</p>
          <h1 className={styles.title} aria-label="Dev Hub">
            {[...TITLE].map((ch, i) => (
              <span key={i} aria-hidden className={styles.letter} style={{ "--i": i } as CSSProperties}>
                {ch === " " ? "\u00A0" : ch}
              </span>
            ))}
          </h1>

          <div className={styles.slot}>
            {phase === "loading" ? (
              <div className={styles.bar} role="status" aria-label="Loading world">
                <div className={styles.track}>
                  <div className={styles.fill} style={{ width: `${Math.max(pct, 10)}%` }} />
                </div>
                <p className={styles.pct}>LOADING WORLD {pct}%</p>
              </div>
            ) : (
              <div>
                <button ref={button} type="button" className={styles.start} onClick={start}>
                  Press Start
                </button>
                <p className={styles.hint}>Enter · Space · or tap</p>
              </div>
            )}
          </div>

          <p key={tip} className={styles.tip}>
            {TIPS[tip]}
          </p>
        </div>
      </div>
    </div>
  );
}
