"use client";

import { useEffect, useState } from "react";
import { useGame } from "@/lib/game/store";
import type { ContextKey } from "./chatCopy";
import { ZONE_TO_CONTEXT } from "./chatUtils";

const SECTION_IDS: ContextKey[] = ["about", "skills", "projects", "experience", "certificates", "contact"];

/** Which section sits in the middle of the viewport (normal site only). */
function useVisibleSection(enabled: boolean): ContextKey | null {
  const [key, setKey] = useState<ContextKey | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const mid = window.innerHeight * 0.45;
      let hit: ContextKey | null = null;
      for (const id of SECTION_IDS) {
        const r = document.getElementById(id)?.getBoundingClientRect();
        if (r && r.top <= mid && r.bottom >= mid) {
          hit = id;
          break;
        }
      }
      setKey(hit);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [enabled]);

  return enabled ? key : null;
}

/** The section the chat should tailor its suggestions to: a page section on the site, the current island in /play. */
export function useChatContext(isGame: boolean, active: boolean): ContextKey | null {
  const zone = useGame((s) => s.activeZone);
  const section = useVisibleSection(!isGame && active);
  if (!active) return null;
  return isGame ? (zone ? ZONE_TO_CONTEXT[zone] ?? null : null) : section;
}
