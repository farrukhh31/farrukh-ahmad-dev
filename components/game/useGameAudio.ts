"use client";

import { useEffect } from "react";
import { disposeAudio, initAudio, setMuted, sfx } from "@/lib/game/audio";
import { duckMusic } from "@/lib/game/music";
import { useGame } from "@/lib/game/store";

const CLICKABLE = "button, a[href], [role='button'], [role='menuitem'], [role='tab'], summary, label[for], input[type='checkbox'], input[type='range']";

/** Starts audio on the first gesture and plays sounds in response to game events and UI clicks. */
export function useGameAudio() {
  useEffect(() => {
    const unlock = () => {
      initAudio();
      setMuted(useGame.getState().muted);
    };
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);

    // One delegated listener gives every button, tab and link in the HUD and the panels a click sound.
    let lastHover: Element | null = null;
    let lastHoverAt = 0;
    const onDown = (e: PointerEvent) => {
      const el = (e.target as Element | null)?.closest?.(CLICKABLE);
      if (!el || el.hasAttribute("disabled") || el.closest("[data-no-sfx]")) return;
      const tab = el.getAttribute("role") === "tab" || el.hasAttribute("aria-pressed") || el.getAttribute("type") === "checkbox";
      (tab ? sfx.tab : sfx.click)();
    };
    const onOver = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      const el = (e.target as Element | null)?.closest?.(CLICKABLE);
      if (!el || el === lastHover || el.closest("[data-no-sfx]")) return;
      lastHover = el;
      const now = performance.now();
      if (now - lastHoverAt < 70) return;
      lastHoverAt = now;
      sfx.hover();
    };
    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("pointerover", onOver, true);

    const unsub = useGame.subscribe((s, prev) => {
      if (s.muted !== prev.muted) setMuted(s.muted);
      if (s.lastGain && s.lastGain !== prev.lastGain) sfx[s.lastGain.kind]();
      if (s.openPanel !== prev.openPanel) {
        (s.openPanel ? sfx.open : sfx.close)();
        duckMusic(s.openPanel !== null);
      }
    });

    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("pointerover", onOver, true);
      unsub();
      disposeAudio();
    };
  }, []);
}
