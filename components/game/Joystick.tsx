"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ChevronsUp } from "lucide-react";
import { input } from "@/lib/game/input";

/** On-screen thumbstick + sprint button, shown only on touch devices. */
const COARSE = "(pointer: coarse)";
const subscribeCoarse = (cb: () => void) => {
  const q = window.matchMedia(COARSE);
  q.addEventListener("change", cb);
  return () => q.removeEventListener("change", cb);
};

const buzz = (ms: number) => {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* haptics are a bonus, never a requirement */
  }
};

export default function Joystick() {
  const coarse = useSyncExternalStore(
    subscribeCoarse,
    () => window.matchMedia(COARSE).matches,
    () => false,
  );
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const [sprint, setSprint] = useState(false);
  const base = useRef<HTMLDivElement>(null);
  const pointer = useRef<number | null>(null);

  // never leave the avatar running if the stick unmounts mid-drag (panel opens, rotate, etc.)
  useEffect(
    () => () => {
      input.joy.x = 0;
      input.joy.y = 0;
      input.sprint = false;
    },
    [],
  );

  const update = (e: React.PointerEvent) => {
    const rect = base.current!.getBoundingClientRect();
    // the stick travel scales with the pad, so it feels the same on a small phone and a tablet
    const radius = rect.width * 0.36;
    let dx = e.clientX - (rect.left + rect.width / 2);
    let dy = e.clientY - (rect.top + rect.height / 2);
    const len = Math.hypot(dx, dy);
    if (len > radius) {
      dx = (dx / len) * radius;
      dy = (dy / len) * radius;
    }
    setKnob({ x: dx, y: dy });
    input.joy.x = dx / radius;
    input.joy.y = -dy / radius;
  };

  const end = () => {
    pointer.current = null;
    setKnob({ x: 0, y: 0 });
    input.joy.x = 0;
    input.joy.y = 0;
  };

  const toggleSprint = () => {
    const next = !input.sprint;
    input.sprint = next;
    setSprint(next);
    buzz(next ? 14 : 8);
  };

  if (!coarse) return null;

  return (
    <>
      <div
        ref={base}
        role="application"
        aria-label="Movement joystick"
        className="pm-stick absolute bottom-[max(1.5rem,calc(env(safe-area-inset-bottom)+0.5rem))] left-[max(1.25rem,env(safe-area-inset-left))] h-[clamp(112px,31vw,148px)] w-[clamp(112px,31vw,148px)] touch-none select-none rounded-full border border-white/20 bg-white/[0.06] shadow-[inset_0_0_30px_rgba(255,255,255,0.06),0_10px_30px_-10px_rgba(0,0,0,0.6)] backdrop-blur-md"
        onPointerDown={(e) => {
          pointer.current = e.pointerId;
          e.currentTarget.setPointerCapture(e.pointerId);
          buzz(6);
          update(e);
        }}
        onPointerMove={(e) => pointer.current === e.pointerId && update(e)}
        onPointerUp={end}
        onPointerCancel={end}
        onLostPointerCapture={end}
      >
        {/* direction ticks */}
        <span aria-hidden className="pointer-events-none absolute inset-2 rounded-full border border-dashed border-white/10" />
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 h-[42%] w-[42%] rounded-full bg-gradient-to-b from-cyan-300/60 to-cyan-500/40 ring-2 ring-cyan-200/70 shadow-[0_6px_18px_-4px_rgba(34,211,238,0.7)]"
          style={{ transform: `translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))` }}
        />
      </div>

      <button
        type="button"
        onClick={toggleSprint}
        aria-pressed={sprint}
        aria-label={sprint ? "Sprint on. Tap to walk." : "Sprint off. Tap to sprint."}
        className={`pm-sprint absolute bottom-[max(1.5rem,calc(env(safe-area-inset-bottom)+0.5rem))] left-[calc(max(1.25rem,env(safe-area-inset-left))+clamp(112px,31vw,148px)+0.75rem)] grid h-14 w-14 touch-manipulation select-none place-items-center rounded-full border text-white backdrop-blur-md transition active:scale-95 ${
          sprint
            ? "border-amber-200/80 bg-amber-400/40 shadow-[0_0_28px_-4px_rgba(251,191,36,0.8)]"
            : "border-white/20 bg-white/[0.06]"
        }`}
      >
        <ChevronsUp size={22} aria-hidden />
      </button>
    </>
  );
}
