"use client";

import ModeLink from "@/components/PlayCTA/ModeLink";
import { motion } from "framer-motion";
import { ArrowRight, Compass, Gamepad2, LayoutList } from "lucide-react";
import Logo from "./Logo";
import { initSfx, sfx } from "@/lib/game/audio";
import { useEnterTransition } from "./EnterTransition";

type Props = {
  onEnter: () => void;
};

export default function LaunchCard({
  onEnter,
}: Props) {
  const { go, overlay } = useEnterTransition();

  return (
    <>
    {overlay}
    <motion.div
      initial={{
        opacity: 0,
        scale: 0.92,
        y: 40,
      }}
      animate={{
        opacity: 1,
        scale: 1,
        y: 0,
      }}
      transition={{
        duration: 1.0,
        ease: "easeOut",
      }}
      className="relative w-full max-w-2xl overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-3xl shadow-[0_0_80px_rgba(34,211,238,.08)] sm:rounded-4xl sm:p-10"
    >
      {/* Top Gradient */}

      <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-cyan-400/60 to-transparent" />

      {/* Glow */}

      <motion.div
        animate={{
          opacity: [0.2, 0.5, 0.2],
          scale: [1, 1.1, 1],
        }}
        transition={{
          duration: 5,
          repeat: Infinity,
        }}
        className="absolute -top-20 left-1/2 h-52 w-52 -translate-x-1/2 rounded-full bg-cyan-500/10 blur-[80px] sm:h-72 sm:w-72 sm:blur-[120px]"
      />

      {/* Content */}

      <div className="relative z-10 text-center">

        <Logo />

        {/* Badge */}

        <motion.div
          initial={{
            opacity: 0,
            y: 15,
          }}
          animate={{
            opacity: 1,
            y: 0,
          }}
          transition={{
            delay: 0.4,
          }}
          className="mx-auto mt-6 inline-flex rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-1.5 text-[10px] font-semibold uppercase tracking-[0.3em] text-cyan-300 sm:mt-8 sm:px-5 sm:py-2 sm:text-xs sm:tracking-[0.35em]"
        >
          FA Launch Card
        </motion.div>

        {/* Welcome */}

        <motion.p
          initial={{
            opacity: 0,
          }}
          animate={{
            opacity: 1,
          }}
          transition={{
            delay: 0.6,
          }}
          className="mt-8 text-sm text-slate-400 sm:mt-10 sm:text-base"
        >
          Welcome to
        </motion.p>

        {/* Name */}

        <motion.h1
          initial={{
            opacity: 0,
            y: 20,
          }}
          animate={{
            opacity: 1,
            y: 0,
          }}
          transition={{
            delay: 0.8,
          }}
          className="mt-3 bg-linear-to-r from-white via-cyan-200 to-cyan-400 bg-clip-text text-3xl font-black text-transparent sm:text-4xl md:text-5xl"
        >
          Farrukh Ahmad
        </motion.h1>

        {/* Role */}

        <motion.p
          initial={{
            opacity: 0,
          }}
          animate={{
            opacity: 1,
          }}
          transition={{
            delay: 1,
          }}
          className="mt-4 text-sm text-cyan-300 sm:mt-5 sm:text-lg"
        >
          Full Stack Developer • Game Developer • DevOps
        </motion.p>

        {/* Description */}

        <motion.p
          initial={{
            opacity: 0,
          }}
          animate={{
            opacity: 1,
          }}
          transition={{
            delay: 1.2,
          }}
          className="mx-auto mt-6 max-w-md text-sm leading-6 text-slate-400 sm:mt-8 sm:text-base sm:leading-8"
        >
          Building modern web applications,
          immersive game experiences,
          and scalable software with clean design,
          smooth interactions, and thoughtful engineering.
        </motion.p>

        {/* CTA */}

        <motion.div
          initial={{
            opacity: 0,
            y: 20,
          }}
          animate={{
            opacity: 1,
            y: 0,
          }}
          transition={{
            delay: 1.4,
          }}
        >
          <p className="mt-8 text-[10px] font-semibold uppercase tracking-[0.3em] text-slate-500 sm:mt-10">
            Choose how to explore
          </p>

          <div className="mt-4 grid gap-3 text-left sm:grid-cols-2">
            <ModeLink
              href="/tour"
              onClick={(e) => go(e, "tour", "/tour")}
              className="group relative overflow-hidden rounded-2xl border border-cyan-400/25 bg-linear-to-br from-cyan-500/15 to-sky-500/5 p-5 transition hover:border-cyan-300/60 hover:from-cyan-500/25"
            >
              <Compass size={22} className="text-cyan-300 transition-transform duration-500 group-hover:rotate-45" />
              <p className="mt-3 text-base font-semibold text-white">Scroll the tour</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-400">
                A guided flight over the archipelago. Just scroll.
              </p>
              <ArrowRight size={16} className="absolute right-4 top-4 text-cyan-300/60 transition group-hover:translate-x-1 group-hover:text-cyan-200" />
            </ModeLink>

            <ModeLink
              href="/play"
              onClick={(e) => go(e, "play", "/play")}
              className="group relative overflow-hidden rounded-2xl border border-violet-400/25 bg-linear-to-br from-violet-500/15 to-fuchsia-500/5 p-5 transition hover:border-violet-300/60 hover:from-violet-500/25"
            >
              <Gamepad2 size={22} className="text-violet-300 transition-transform duration-500 group-hover:-rotate-12" />
              <p className="mt-3 text-base font-semibold text-white">Explore the archipelago</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-400">
                Walk the islands, collect skills and earn XP.
              </p>
              <ArrowRight size={16} className="absolute right-4 top-4 text-violet-300/60 transition group-hover:translate-x-1 group-hover:text-violet-200" />
            </ModeLink>
          </div>

          <button
            type="button"
            onClick={() => {
              initSfx();
              sfx.click();
              onEnter();
            }}
            className="group mt-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-5 py-2.5 text-sm text-slate-300 transition hover:border-white/25 hover:bg-white/10 hover:text-white"
          >
            <LayoutList size={16} />
            Just the facts: recruiter mode
            <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" />
          </button>
        </motion.div>

        {/* Bottom */}

        <motion.div
          initial={{
            opacity: 0,
          }}
          animate={{
            opacity: 1,
          }}
          transition={{
            delay: 0.1,
          }}
          className="mt-8 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-slate-500 sm:mt-10 sm:text-sm"
        >
          <span>Next.js</span>

          <span>•</span>

          <span>TypeScript</span>

          <span>•</span>

          <span>Framer Motion</span>
        </motion.div>

      </div>
    </motion.div>
    </>
  );
}
