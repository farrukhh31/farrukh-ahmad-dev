"use client";

import { useEffect } from "react";
import { input } from "@/lib/game/input";
import { useGame } from "@/lib/game/store";
import { EMOTE_BY_KEY } from "@/lib/game/gestures";
import { track } from "@/lib/analytics/client";

const isTyping = (t: EventTarget | null) => {
  const el = t as HTMLElement | null;
  return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
};

const GAME_KEYS = new Set([
  "KeyW", "KeyA", "KeyS", "KeyD",
  "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight",
  "ShiftLeft", "ShiftRight",
]);

export function useGameKeyboard() {
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const game = useGame.getState();

      if (e.code === "Escape") {
        if (game.settingsOpen) game.setSettingsOpen(false);
        else if (game.helpOpen) game.setHelpOpen(false);
        else if (game.openPanel) game.openZonePanel(null);
        return;
      }
      if (isTyping(e.target)) return;
      if (e.code === "KeyH" || (e.code === "Slash" && e.shiftKey)) {
        game.setHelpOpen(!game.helpOpen);
        return;
      }
      if (!e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey && EMOTE_BY_KEY[e.key] && !game.openPanel && !game.helpOpen && !game.settingsOpen) {
        game.playEmote(EMOTE_BY_KEY[e.key]);
        track("emote", EMOTE_BY_KEY[e.key]);
        return;
      }
      if (e.code === "KeyE" || e.code === "Enter") {
        if (!e.repeat && !game.openPanel && !game.helpOpen && !game.settingsOpen) game.interact();
        return;
      }
      if (GAME_KEYS.has(e.code)) {
        e.preventDefault();
        input.keys.add(e.code);
      }
    };
    const up = (e: KeyboardEvent) => input.keys.delete(e.code);
    const clear = () => input.keys.clear();

    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", clear);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", clear);
      input.keys.clear();
    };
  }, []);
}
