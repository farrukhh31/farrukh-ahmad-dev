"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Compass, Gamepad2 } from "lucide-react";
import { initSfx, setMuted, sfx } from "@/lib/game/audio";
import { useGame } from "@/lib/game/store";

export type EnterKind = "tour" | "play";

const DURATION = 2100; // ms before the route changes

const COPY: Record<EnterKind, { title: string; color: string; glow: string; steps: string[]; Icon: typeof Compass }> = {
  tour: {
    title: "Starting the tour",
    color: "#22d3ee",
    glow: "rgba(34,211,238,0.55)",
    steps: ["Calibrating the compass", "Charting the archipelago", "Ready for take-off"],
    Icon: Compass,
  },
  play: {
    title: "Entering the archipelago",
    color: "#a78bfa",
    glow: "rgba(167,139,250,0.55)",
    steps: ["Spawning the islands", "Warming up the avatar", "Player one, get ready"],
    Icon: Gamepad2,
  },
};

/** Thin streaks that fly outward from the centre (deterministic, so no hydration or render-time randomness). */
const STREAKS = Array.from({ length: 28 }, (_, i) => ({
  angle: (i / 28) * 360 + ((i * 37) % 11),
  delay: ((i * 53) % 100) / 260,
  len: 120 + ((i * 71) % 160),
}));

function Overlay({ kind, x, y }: { kind: EnterKind; x: number; y: number }) {
  const c = COPY[kind];
  const [step, setStep] = useState(0);

  useEffect(() => {
    const a = setTimeout(() => setStep(1), 750);
    const b = setTimeout(() => setStep(2), 1400);
    return () => {
      clearTimeout(a);
      clearTimeout(b);
    };
  }, []);

  return (
    <motion.div
      role="status"
      aria-live="polite"
      aria-label={c.title}
      className="fixed inset-0 z-[10000] overflow-hidden"
      initial={{ clipPath: `circle(0px at ${x}px ${y}px)` }}
      animate={{ clipPath: `circle(150vmax at ${x}px ${y}px)` }}
      transition={{ duration: 0.75, ease: [0.65, 0, 0.35, 1] }}
      style={{ background: `radial-gradient(circle at 50% 45%, ${c.color}33, #030712 62%)`, backgroundColor: "#030712" }}
    >
      {/* grid */}
      <div aria-hidden className="absolute inset-0 opacity-[0.12]" style={{ backgroundImage: `linear-gradient(${c.color} 1px, transparent 1px), linear-gradient(90deg, ${c.color} 1px, transparent 1px)`, backgroundSize: "56px 56px", maskImage: "radial-gradient(circle at center, black, transparent 70%)", WebkitMaskImage: "radial-gradient(circle at center, black, transparent 70%)" }} />

      {/* warp streaks */}
      <div aria-hidden className="absolute left-1/2 top-[45%]">
        {STREAKS.map((s, i) => (
          <motion.span
            key={i}
            className="absolute left-0 top-0 h-px origin-left rounded-full"
            style={{ rotate: s.angle, width: s.len, background: `linear-gradient(90deg, transparent, ${c.color})` }}
            initial={{ x: 0, opacity: 0, scaleX: 0.2 }}
            animate={{ x: [0, 420, 900], opacity: [0, 0.9, 0], scaleX: [0.2, 1, 1.6] }}
            transition={{ duration: 1.1, delay: 0.45 + s.delay, repeat: 1, ease: "easeIn" }}
          />
        ))}
      </div>

      {/* centre stage */}
      <div className="relative flex h-full flex-col items-center justify-center px-6 text-center">
        <motion.div
          initial={{ scale: 0.3, opacity: 0, rotate: -90 }}
          animate={{ scale: 1, opacity: 1, rotate: 0 }}
          transition={{ delay: 0.35, type: "spring", stiffness: 220, damping: 16 }}
          className="relative grid h-24 w-24 place-items-center rounded-full border"
          style={{ borderColor: `${c.color}88`, background: `${c.color}18`, boxShadow: `0 0 60px ${c.glow}` }}
        >
          <motion.span aria-hidden className="absolute inset-0 rounded-full border-2" style={{ borderColor: c.color }} animate={{ scale: [1, 1.8], opacity: [0.7, 0] }} transition={{ duration: 1.1, repeat: Infinity, ease: "easeOut" }} />
          <motion.div animate={kind === "tour" ? { rotate: [0, 360] } : { rotate: [0, -14, 14, 0] }} transition={{ duration: kind === "tour" ? 2.2 : 1.2, repeat: Infinity, ease: "easeInOut" }}>
            <c.Icon size={40} style={{ color: c.color }} />
          </motion.div>
        </motion.div>

        <motion.h2
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55, duration: 0.5 }}
          className="mt-7 text-2xl font-black tracking-tight text-white sm:text-4xl"
        >
          {c.title}
        </motion.h2>

        <div className="mt-3 h-6 overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.p
              key={step}
              initial={{ y: 18, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -18, opacity: 0 }}
              transition={{ duration: 0.28 }}
              className="font-mono text-xs uppercase tracking-[0.3em] sm:text-sm"
              style={{ color: c.color }}
            >
              {c.steps[step]}
            </motion.p>
          </AnimatePresence>
        </div>

        <div className="mt-8 h-1.5 w-64 overflow-hidden rounded-full bg-white/10 sm:w-80">
          <motion.div
            className="h-full rounded-full"
            style={{ background: `linear-gradient(90deg, ${c.color}88, ${c.color})`, boxShadow: `0 0 16px ${c.glow}` }}
            initial={{ width: "0%" }}
            animate={{ width: "100%" }}
            transition={{ delay: 0.5, duration: (DURATION - 650) / 1000, ease: "easeInOut" }}
          />
        </div>
      </div>
    </motion.div>
  );
}

/**
 * Cinematic hand-off used by the launch screen: a circle expands from the clicked button,
 * a short loading sequence plays with a whoosh, then the new page opens.
 * Reduced-motion users (and modified clicks) navigate straight away.
 */
export function useEnterTransition() {
  const router = useRouter();
  const [state, setState] = useState<{ kind: EnterKind; x: number; y: number } | null>(null);
  const busy = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const go = useCallback(
    (e: React.MouseEvent<HTMLElement>, kind: EnterKind, href: string) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
      e.preventDefault();
      if (busy.current) return;
      busy.current = true;

      setMuted(useGame.getState().muted);
      initSfx(); // this click is the user gesture browsers require
      sfx.launch();

      const root = document.documentElement;
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches || root.classList.contains("a11y-reduce-motion");
      if (reduce) {
        router.push(href);
        return;
      }
      const r = e.currentTarget.getBoundingClientRect();
      setState({ kind, x: e.clientX || r.left + r.width / 2, y: e.clientY || r.top + r.height / 2 });
      timer.current = setTimeout(() => router.push(href), DURATION);
    },
    [router],
  );

  const overlay = useMemo(
    () => (state && typeof document !== "undefined" ? createPortal(<Overlay kind={state.kind} x={state.x} y={state.y} />, document.body) : null),
    [state],
  );

  return { go, overlay };
}
