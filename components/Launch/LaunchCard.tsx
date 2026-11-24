"use client";

import ModeLink from "@/components/PlayCTA/ModeLink";
import { motion } from "framer-motion";
import { ArrowRight, ChevronsRight, Compass, Gamepad2, Layers, Map as MapIcon, Trophy } from "lucide-react";
import Logo from "./Logo";
import { initSfx, sfx } from "@/lib/game/audio";
import { ACHIEVEMENTS, TOTAL_SKILLS, TOTAL_ZONES } from "@/lib/game/achievements";
import { useEnterTransition } from "./EnterTransition";

type Props = {
  onEnter: () => void;
};

const STATS = [
  { icon: MapIcon, label: "Zones", value: TOTAL_ZONES, color: "#22d3ee" },
  { icon: Layers, label: "Skills", value: TOTAL_SKILLS, color: "#34d399" },
  { icon: Trophy, label: "Trophies", value: ACHIEVEMENTS.length, color: "#fbbf24" },
];

const rise = (delay: number) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { delay, duration: 0.6, ease: "easeOut" as const },
});

export default function LaunchCard({ onEnter }: Props) {
  const { go, overlay } = useEnterTransition();

  return (
    <>
      {overlay}
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 36 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.9, ease: "easeOut" }}
        className="hud-glow relative w-full max-w-2xl"
      >
        {/* animated gradient frame with cut corners */}
        <div className="aura-card hud-clip">
          <div className="hud-clip hud-scan relative overflow-hidden bg-[#050914]/[0.98] px-5 pb-6 pt-4 sm:px-9 sm:pb-8 sm:pt-5">
            {/* ambient glows */}
            <span aria-hidden className="aura-blob pointer-events-none absolute -right-14 -top-16 h-56 w-56 rounded-full bg-cyan-400/20 blur-3xl" />
            <span aria-hidden className="aura-blob pointer-events-none absolute -bottom-20 -left-14 h-56 w-56 rounded-full bg-violet-500/25 blur-3xl [animation-delay:-4s]" />
            <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-cyan-300/70 to-transparent" />

            {/* HUD status bar */}
            <motion.div
              {...rise(0.15)}
              className="relative flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.28em] text-slate-500"
            >
              <span className="inline-flex items-center gap-2 text-emerald-300/90">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/70" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
                </span>
                System online
              </span>
              <span>FA // Portfolio</span>
            </motion.div>

            {/* player identity */}
            <div className="relative mt-6 flex flex-col items-center gap-5 text-center sm:flex-row sm:items-center sm:gap-6 sm:text-left">
              <div className="shrink-0">
                <Logo />
              </div>

              <div className="min-w-0 flex-1">
                <motion.p {...rise(0.35)} className="font-mono text-[10px] uppercase tracking-[0.35em] text-cyan-300/80">
                  Player one · Ready
                </motion.p>

                <motion.h1
                  {...rise(0.5)}
                  className="mt-1 bg-linear-to-r from-white via-cyan-200 to-violet-300 bg-clip-text text-3xl font-black leading-tight tracking-tight text-transparent sm:text-4xl md:text-[2.75rem]"
                >
                  Farrukh Ahmad
                </motion.h1>

                <motion.div {...rise(0.65)} className="mt-3 flex flex-wrap justify-center gap-1.5 sm:justify-start">
                  {["Full Stack", "Game Dev", "DevOps"].map((role) => (
                    <span
                      key={role}
                      className="rounded-full border border-white/10 bg-white/5 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-slate-300"
                    >
                      {role}
                    </span>
                  ))}
                </motion.div>
              </div>
            </div>

            {/* profile sync bar */}
            <motion.div {...rise(0.8)} className="relative mt-6">
              <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.25em] text-slate-500">
                <span>Profile sync</span>
                <span className="text-cyan-300">100%</span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/8">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: "100%" }}
                  transition={{ delay: 1, duration: 1.4, ease: "easeOut" }}
                  className="bar-shine h-full rounded-full bg-linear-to-r from-cyan-400 via-sky-400 to-violet-500 shadow-[0_0_14px_rgba(34,211,238,.7)]"
                />
              </div>
            </motion.div>

            {/* stat tiles */}
            <motion.div {...rise(0.95)} className="relative mt-4 grid grid-cols-3 gap-2 sm:gap-3">
              {STATS.map(({ icon: Icon, label, value, color }) => (
                <div
                  key={label}
                  className="rounded-xl border border-white/8 bg-white/[0.035] px-2 py-2.5 text-center sm:py-3"
                >
                  <Icon size={14} className="mx-auto" style={{ color }} />
                  <p className="mt-1 text-xl font-bold leading-none text-white sm:text-2xl">{value}</p>
                  <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.25em] text-slate-500">{label}</p>
                </div>
              ))}
            </motion.div>

            <motion.p {...rise(1.05)} className="relative mx-auto mt-5 max-w-lg text-center text-sm leading-6 text-slate-400">
              Modern web apps, immersive game experiences and scalable software, built with clean design and
              thoughtful engineering.
            </motion.p>

            {/* mode select */}
            <motion.div {...rise(1.2)} className="relative">
              <div className="mt-6 flex items-center gap-3">
                <span className="h-px flex-1 bg-linear-to-r from-transparent to-white/15" />
                <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.35em] text-slate-400">Select mode</p>
                <span className="h-px flex-1 bg-linear-to-l from-transparent to-white/15" />
              </div>

              <div className="mt-4 grid gap-3 text-left sm:grid-cols-2">
                <ModeLink
                  href="/tour"
                  onClick={(e) => go(e, "tour", "/tour")}
                  className="group relative overflow-hidden rounded-2xl border border-cyan-400/25 bg-linear-to-br from-cyan-500/15 to-sky-500/5 p-4 transition duration-300 hover:-translate-y-0.5 hover:border-cyan-300/70 hover:shadow-[0_18px_40px_-18px_rgba(34,211,238,.6)] sm:p-5"
                >
                  <span className="absolute right-4 top-3 font-mono text-[11px] font-bold tracking-widest text-cyan-300/40">01</span>
                  <Compass size={24} className="text-cyan-300 transition-transform duration-500 group-hover:rotate-45" />
                  <p className="mt-3 text-base font-semibold text-white">Scroll the tour</p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-400">A guided flight over the archipelago. Just scroll.</p>
                  <p className="mt-3 inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.25em] text-cyan-300">
                    Guided <ArrowRight size={12} className="transition-transform group-hover:translate-x-1" />
                  </p>
                </ModeLink>

                <ModeLink
                  href="/play"
                  onClick={(e) => go(e, "play", "/play")}
                  className="group relative overflow-hidden rounded-2xl border border-violet-400/25 bg-linear-to-br from-violet-500/15 to-fuchsia-500/5 p-4 transition duration-300 hover:-translate-y-0.5 hover:border-violet-300/70 hover:shadow-[0_18px_40px_-18px_rgba(139,92,246,.7)] sm:p-5"
                >
                  <span className="absolute right-4 top-3 font-mono text-[11px] font-bold tracking-widest text-violet-300/40">02</span>
                  <Gamepad2 size={24} className="text-violet-300 transition-transform duration-500 group-hover:-rotate-12" />
                  <p className="mt-3 text-base font-semibold text-white">Explore the archipelago</p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-400">Walk the islands, collect skills and earn XP.</p>
                  <p className="mt-3 inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.25em] text-violet-300">
                    Free roam <ArrowRight size={12} className="transition-transform group-hover:translate-x-1" />
                  </p>
                </ModeLink>
              </div>

              <button
                type="button"
                onClick={() => {
                  initSfx();
                  sfx.click();
                  onEnter();
                }}
                className="group mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-5 py-3 font-mono text-[11px] uppercase tracking-[0.2em] text-slate-300 transition hover:border-white/25 hover:bg-white/10 hover:text-white"
              >
                <ChevronsRight size={15} className="transition-transform group-hover:translate-x-1" />
                Skip · Recruiter mode, just the facts
              </button>
            </motion.div>

            {/* footer */}
            <motion.div
              {...rise(1.4)}
              className="relative mt-5 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 font-mono text-[10px] uppercase tracking-[0.2em] text-slate-600"
            >
              <span>Next.js</span>
              <span>•</span>
              <span>TypeScript</span>
              <span>•</span>
              <span>Framer Motion</span>
            </motion.div>
          </div>
        </div>
      </motion.div>
    </>
  );
}