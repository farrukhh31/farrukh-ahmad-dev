"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import { input } from "@/lib/game/input";

const RADIUS = 48;

/** On-screen thumbstick, shown only on touch devices. */
const COARSE = "(pointer: coarse)";
const subscribeCoarse = (cb: () => void) => {
  const q = window.matchMedia(COARSE);
  q.addEventListener("change", cb);
  return () => q.removeEventListener("change", cb);
};

export default function Joystick() {
  const coarse = useSyncExternalStore(
    subscribeCoarse,
    () => window.matchMedia(COARSE).matches,
    () => false,
  );
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const base = useRef<HTMLDivElement>(null);
  const pointer = useRef<number | null>(null);

  const update = (e: React.PointerEvent) => {
    const rect = base.current!.getBoundingClientRect();
    let dx = e.clientX - (rect.left + rect.width / 2);
    let dy = e.clientY - (rect.top + rect.height / 2);
    const len = Math.hypot(dx, dy);
    if (len > RADIUS) {
      dx = (dx / len) * RADIUS;
      dy = (dy / len) * RADIUS;
    }
    setKnob({ x: dx, y: dy });
    input.joy.x = dx / RADIUS;
    input.joy.y = -dy / RADIUS;
  };

  const end = () => {
    pointer.current = null;
    setKnob({ x: 0, y: 0 });
    input.joy.x = 0;
    input.joy.y = 0;
  };

  if (!coarse) return null;

  return (
    <div
      ref={base}
      role="application"
      aria-label="Movement joystick"
      className="absolute bottom-[max(1.5rem,env(safe-area-inset-bottom))] left-6 h-[132px] w-[132px] touch-none select-none rounded-full border border-white/15 bg-white/5 backdrop-blur-md"
      onPointerDown={(e) => {
        pointer.current = e.pointerId;
        e.currentTarget.setPointerCapture(e.pointerId);
        update(e);
      }}
      onPointerMove={(e) => pointer.current === e.pointerId && update(e)}
      onPointerUp={end}
      onPointerCancel={end}
    >
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-14 w-14 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-400/40 ring-2 ring-cyan-300/60"
        style={{ transform: `translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))` }}
      />
    </div>
  );
}
