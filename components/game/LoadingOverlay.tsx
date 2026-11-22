"use client";

import { useEffect, useState } from "react";
import { useProgress } from "@react-three/drei";

export default function LoadingOverlay() {
  const { progress, active } = useProgress();
  const [gone, setGone] = useState(false);

  useEffect(() => {
    // give the first frames a moment to compile shaders
    if (!active && progress >= 100) {
      const t = setTimeout(() => setGone(true), 700);
      return () => clearTimeout(t);
    }
    const fallback = setTimeout(() => setGone(true), 2500);
    return () => clearTimeout(fallback);
  }, [active, progress]);

  return (
    <div
      aria-hidden={gone}
      className={`pointer-events-none absolute inset-0 z-40 grid place-items-center bg-[#030712] transition-opacity duration-700 ${gone ? "opacity-0" : "opacity-100"}`}
    >
      <div className="text-center">
        <p className="font-mono text-xs uppercase tracking-[0.4em] text-cyan-300/80">Loading world</p>
        <div className="mx-auto mt-4 h-1 w-56 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-violet-500 transition-all"
            style={{ width: `${Math.max(progress, 12)}%` }}
          />
        </div>
      </div>
    </div>
  );
}
