"use client";

import { useRef } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { useGame } from "@/lib/game/store";
import { useDialogFocus } from "./useDialogFocus";

const KEYS: [string, string][] = [
  ["W A S D  /  Arrow keys", "Move"],
  ["Shift", "Run"],
  ["E  /  Enter", "Open the zone you are standing in"],
  ["1  2  3  4", "Gestures: wave, cheer, bow, think"],
  ["H  or  ?", "Show / hide this help"],
  ["Esc", "Close a panel or this help"],
  ["Camera", "Swings around automatically so you face each zone"],
];

const kbd = "rounded-md border border-white/20 bg-white/10 px-2 py-0.5 font-mono text-xs text-slate-100";

export function HelpDialog() {
  const open = useGame((s) => s.helpOpen);
  const setOpen = useGame((s) => s.setHelpOpen);
  const ref = useRef<HTMLDivElement>(null);
  const onKeyDown = useDialogFocus(open, ref);
  if (!open) return null;

  return (
    <div className="absolute inset-0 z-40 grid place-items-center bg-black/60 p-4 backdrop-blur-sm" onClick={() => setOpen(false)}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-title"
        onKeyDown={onKeyDown}
        onClick={(e) => e.stopPropagation()}
        className="relative max-h-[88vh] w-full max-w-md overflow-y-auto rounded-3xl border border-cyan-400/30 bg-slate-950/95 p-6 shadow-2xl"
      >
        <button onClick={() => setOpen(false)} aria-label="Close help" className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full bg-white/5 text-slate-300 hover:bg-white/10">
          <X size={16} />
        </button>
        <h2 id="help-title" className="text-xl font-bold text-white">How to play</h2>
        <p className="mt-1 text-sm text-slate-400">Walk around the island and step into each zone to discover my portfolio.</p>

        <h3 className="mb-2 mt-5 text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-500">Keyboard</h3>
        <ul className="space-y-2">
          {KEYS.map(([k, d]) => (
            <li key={k} className="flex items-center justify-between gap-3 text-sm text-slate-300">
              <span className={kbd}>{k}</span>
              <span className="text-right">{d}</span>
            </li>
          ))}
        </ul>

        <h3 className="mb-2 mt-5 text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-500">Touch</h3>
        <p className="text-sm leading-relaxed text-slate-300">
          Drag the left stick to move and push it all the way out to run. Tap the <b>Open</b> button
          that appears when you reach a zone.
        </p>

        <h3 className="mb-2 mt-5 text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-500">Goals</h3>
        <p className="text-sm leading-relaxed text-slate-300">
          Discover all 9 zones, collect the 37 glowing skill orbs in the Skill Grove, and unlock
          achievements to level up.
        </p>

        <Link href="/" className="mt-6 block rounded-xl bg-white/5 px-4 py-3 text-center text-sm text-slate-200 hover:bg-white/10">
          Prefer a regular page? Open Recruiter Mode
        </Link>
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
    <div role="note" className="pointer-events-auto absolute bottom-[11.5rem] left-1/2 w-[min(92vw,22rem)] -translate-x-1/2 rounded-2xl border border-cyan-400/30 bg-slate-950/90 p-4 text-sm text-slate-300 shadow-xl backdrop-blur-xl sm:bottom-24">
      <p className="font-semibold text-white">Welcome to my Dev Hub 👋</p>
      <p className="mt-1 leading-relaxed">
        <span className="hidden sm:inline">Move with <b>WASD</b>.</span>
        <span className="sm:hidden">Drag the stick to move.</span> Walk into glowing zones to explore, and
        collect the colourful orbs for XP.
      </p>
      <div className="mt-3 flex gap-2 text-xs">
        <button onClick={dismiss} className="rounded-lg bg-cyan-400/20 px-3 py-1.5 font-medium text-cyan-100 hover:bg-cyan-400/30">Got it</button>
        <button onClick={() => useGame.getState().setHelpOpen(true)} className="rounded-lg bg-white/5 px-3 py-1.5 text-slate-200 hover:bg-white/10">All controls</button>
      </div>
    </div>
  );
}
