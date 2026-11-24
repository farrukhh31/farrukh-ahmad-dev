"use client";

import { useRef } from "react";
import { Gamepad2, Hand, Target, X } from "lucide-react";
import ModeLink from "@/components/PlayCTA/ModeLink";
import { useGame } from "@/lib/game/store";
import { TOTAL_SKILLS } from "@/lib/game/achievements";
import { ZONES } from "@/lib/game/zones";
import { useDialogFocus } from "./useDialogFocus";

const KEYS: [string[], string][] = [
  [["W", "A", "S", "D"], "Move"],
  [["←", "→"], "Orbit the camera"],
  [["↑", "↓"], "Zoom the camera"],
  [["Shift"], "Run"],
  [["E"], "Open the zone you are standing in"],
  [["1", "2", "3", "4"], "Wave, cheer, bow, think"],
  [["C"], "Reset the camera"],
  [["H"], "Show or hide this help"],
  [["Esc"], "Close a panel"],
];

export function HelpDialog() {
  const open = useGame((s) => s.helpOpen);
  const setOpen = useGame((s) => s.setHelpOpen);
  const ref = useRef<HTMLDivElement>(null);
  const onKeyDown = useDialogFocus(open, ref);
  if (!open) return null;

  return (
    <div className="absolute inset-0 z-40 grid place-items-center bg-[radial-gradient(ellipse_at_center,rgba(3,7,18,0.45),rgba(3,7,18,0.78))] p-3 backdrop-blur-sm" onClick={() => setOpen(false)}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-title"
        onKeyDown={onKeyDown}
        onClick={(e) => e.stopPropagation()}
        className="pm-panel pm-rise max-h-[90dvh] w-full max-w-xl overflow-y-auto rounded-[30px] p-6 sm:p-8"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="help-title" className="pm-ink text-2xl font-semibold tracking-tight">How to play</h2>
            <p className="pm-muted mt-1 max-w-sm text-sm leading-relaxed">Walk between the islands and step into each zone to see a different part of my portfolio.</p>
          </div>
          <button onClick={() => setOpen(false)} aria-label="Close help" className="pm-btn is-icon -mr-2 -mt-2 shrink-0">
            <X size={18} />
          </button>
        </div>

        <section className="mt-6">
          <h3 className="pm-ink flex items-center gap-2 text-sm font-semibold"><Gamepad2 size={16} /> Keyboard</h3>
          <ul className="mt-3 grid gap-x-6 gap-y-2.5 sm:grid-cols-2">
            {KEYS.map(([keys, label]) => (
              <li key={label} className="flex items-center gap-3">
                <span className="flex min-w-[5.5rem] shrink-0 gap-1">
                  {keys.map((k) => (
                    <kbd key={k} className="pm-key">{k}</kbd>
                  ))}
                </span>
                <span className="pm-muted text-[13px] leading-snug">{label}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-6 rounded-2xl p-4" style={{ background: "var(--pm-raise)" }}>
          <h3 className="pm-ink flex items-center gap-2 text-sm font-semibold"><Hand size={16} /> Touch</h3>
          <p className="pm-muted mt-1.5 text-[13px] leading-relaxed">
            Drag the left stick to move, and push it all the way out to run. Tap <b className="pm-ink">Enter</b> when it appears at a zone.
          </p>
        </section>

        <section className="mt-3 rounded-2xl p-4" style={{ background: "var(--pm-raise)" }}>
          <h3 className="pm-ink flex items-center gap-2 text-sm font-semibold"><Target size={16} /> Goals</h3>
          <p className="pm-muted mt-1.5 text-[13px] leading-relaxed">
            Find all {ZONES.length} zones, collect the {TOTAL_SKILLS} glowing skill orbs in the Skill Grove, and unlock achievements to level up. Unfound zones send up a light beam so you can spot them from across the water.
          </p>
        </section>

        <ModeLink href="/" className="pm-btn mt-6 w-full justify-center">
          Prefer a regular page? Open Recruiter mode
        </ModeLink>
      </div>
    </div>
  );
}

/** One-time hint for first-time visitors. */
export function IntroTip() {
  const seen = useGame((s) => s.seenIntro);
  const dismiss = useGame((s) => s.dismissIntro);
  const panel = useGame((s) => s.openPanel);
  const help = useGame((s) => s.helpOpen);
  if (seen || panel || help) return null;

  return (
    <div
      role="note"
      className="pm-panel pm-rise pointer-events-auto absolute left-1/2 top-[8.75rem] w-[min(92vw,23rem)] -translate-x-1/2 rounded-[26px] p-5 lg:bottom-44 lg:left-6 lg:top-auto lg:translate-x-0"
    >
      <p className="pm-ink text-base font-semibold">Welcome to my Dev Hub</p>
      <p className="pm-muted mt-1.5 text-[13px] leading-relaxed">
        <span className="hidden sm:inline">Move with <b className="pm-ink">WASD</b> and look around with the <b className="pm-ink">arrow keys</b>.</span>
        <span className="sm:hidden">Drag the stick to move.</span> Walk into a glowing zone to open it, and collect the colourful orbs for XP.
      </p>
      <div className="mt-4 flex gap-2">
        <button onClick={dismiss} className="pm-cta flex-1">Got it</button>
        <button onClick={() => useGame.getState().setHelpOpen(true)} className="pm-btn">All controls</button>
      </div>
    </div>
  );
}
