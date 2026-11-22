"use client";

import ModeLink from "@/components/PlayCTA/ModeLink";
import { Gamepad2 } from "lucide-react";

/** Compact "go to the game" button for the Recruiter Mode navbar. */
export default function PlayLink() {
  return (
    <ModeLink
      href="/play"
      aria-label="Play the 3D game version of this portfolio"
      className="group relative flex shrink-0 items-center gap-2 overflow-hidden rounded-full border border-cyan-400/25 bg-linear-to-r from-cyan-500/15 to-violet-500/15 px-3.5 py-2 text-sm font-medium text-cyan-100 transition hover:border-cyan-300/50 hover:from-cyan-500/25 hover:to-violet-500/25 hover:text-white"
    >
      <span className="relative grid h-2 w-2 place-items-center">
        <span className="absolute inset-0 animate-ping rounded-full bg-cyan-300/70" />
        <span className="relative h-1.5 w-1.5 rounded-full bg-cyan-300" />
      </span>
      <Gamepad2 size={16} className="transition-transform duration-300 group-hover:-rotate-12" />
      <span className="hidden xl:inline">Play the game</span>
      <span className="xl:hidden">Play</span>
    </ModeLink>
  );
}
