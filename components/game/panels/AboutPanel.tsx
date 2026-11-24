"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, type PanInfo } from "framer-motion";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { story } from "@/components/About/StoryData";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { Card, Chip, Eyebrow, SectionTitle } from "./shared";

const ACCENT = "#8b5cf6";
const SWIPE = 56; // px of horizontal drag that counts as a swipe

/** Every distinct tag across the chapters, for the "Toolbox" strip. */
const TOOLBOX = Array.from(new Set(story.flatMap((c) => c.tags)));

export default function AboutPanel() {
  const [i, setI] = useState(0);
  const [dir, setDir] = useState(1);
  const reduced = useReducedMotion();
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const chapter = story[i];

  const go = useCallback((to: number) => {
    const next = (to + story.length) % story.length;
    setDir(to > i || (i === story.length - 1 && next === 0) ? 1 : -1);
    setI(next);
  }, [i]);

  // keep the active chapter pill in view in the scrolling tab strip
  useEffect(() => {
    tabs.current[i]?.scrollIntoView({ inline: "center", block: "nearest", behavior: reduced ? "auto" : "smooth" });
  }, [i, reduced]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      go(i + 1);
      tabs.current[(i + 1) % story.length]?.focus();
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      go(i - 1);
      tabs.current[(i - 1 + story.length) % story.length]?.focus();
    }
  };

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x < -SWIPE) go(i + 1);
    else if (info.offset.x > SWIPE) go(i - 1);
  };

  return (
    <div>
      <Eyebrow color="#a78bfa">The story so far</Eyebrow>
      <p className="mt-3 max-w-xl text-xl font-semibold leading-snug tracking-tight text-white sm:text-2xl">
        {story[0]?.subtitle ?? "Engineer. Creator. Problem solver."}
      </p>

      {/* chapter selector: one scrolling row of large, thumb-sized pills */}
      <div
        role="tablist"
        aria-label="Chapters"
        onKeyDown={onKey}
        className="-mx-4 mt-6 flex snap-x gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden"
      >
        {story.map((c, k) => {
          const on = k === i;
          return (
            <button
              key={c.id}
              ref={(el) => {
                tabs.current[k] = el;
              }}
              role="tab"
              id={`about-tab-${c.id}`}
              aria-selected={on}
              aria-controls="about-chapter"
              tabIndex={on ? 0 : -1}
              onClick={() => go(k)}
              className={`min-h-11 shrink-0 snap-center touch-manipulation rounded-full border px-4 text-[13px] font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300 ${
                on ? "border-violet-300/70 bg-violet-400/25 text-white shadow-[0_0_24px_-6px_#8b5cf6]" : "border-white/10 bg-white/[0.05] text-slate-300 hover:bg-white/10"
              }`}
            >
              <span className="mr-2 font-mono text-[11px] opacity-60">{c.accent}</span>
              {c.title}
            </button>
          );
        })}
      </div>

      {/* the chapter itself: swipe sideways on a phone, or use the arrows */}
      <div className="relative mt-4 overflow-hidden">
        <AnimatePresence mode="wait" initial={false} custom={dir}>
          <motion.div
            key={chapter.id}
            id="about-chapter"
            role="tabpanel"
            aria-labelledby={`about-tab-${chapter.id}`}
            custom={dir}
            initial={reduced ? { opacity: 0 } : { opacity: 0, x: dir * 36 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, x: dir * -36 }}
            transition={{ duration: reduced ? 0.01 : 0.22, ease: [0.2, 0.8, 0.2, 1] }}
            drag={reduced ? false : "x"}
            dragDirectionLock
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.18}
            onDragEnd={onDragEnd}
            style={{ touchAction: "pan-y" }}
          >
            <Card accent={ACCENT} tilt className="p-5 sm:p-7">
              <div className="flex items-start gap-4 sm:gap-6">
                <span
                  aria-hidden
                  className="select-none font-mono text-5xl font-black leading-none tracking-tighter sm:text-7xl"
                  style={{ color: "transparent", WebkitTextStroke: "1px rgba(167,139,250,0.6)" }}
                >
                  {chapter.accent}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-violet-300/80">
                    Chapter {i + 1} of {story.length}
                  </p>
                  <h3 className="mt-1 text-xl font-semibold text-white sm:text-2xl">{chapter.title}</h3>
                  <p className="text-sm italic text-slate-400">{chapter.subtitle}</p>
                </div>
              </div>
              <p className="mt-5 max-w-prose text-[15px] leading-relaxed text-slate-300">{chapter.description}</p>
              <div className="mt-5 flex flex-wrap gap-2">
                {chapter.tags.map((t) => (
                  <Chip key={t} color="#a78bfa">
                    {t}
                  </Chip>
                ))}
              </div>
            </Card>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <button
          onClick={() => go(i - 1)}
          aria-label="Previous chapter"
          className="grid h-12 w-12 touch-manipulation place-items-center rounded-full border border-white/10 bg-white/[0.06] text-white transition active:scale-95 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex flex-1 justify-center gap-1.5" aria-hidden>
          {story.map((c, k) => (
            <span key={c.id} className="h-1.5 rounded-full transition-all duration-300" style={{ width: k === i ? 28 : 8, background: k === i ? "#a78bfa" : "rgba(255,255,255,0.18)" }} />
          ))}
        </div>
        <button
          onClick={() => go(i + 1)}
          aria-label="Next chapter"
          className="grid h-12 w-12 touch-manipulation place-items-center rounded-full border border-white/10 bg-white/[0.06] text-white transition active:scale-95 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300"
        >
          <ArrowRight size={18} />
        </button>
      </div>

      <SectionTitle accent={ACCENT}>Toolbox</SectionTitle>
      <ul className="flex flex-wrap gap-2">
        {TOOLBOX.map((t) => (
          <li key={t}>
            <Chip color="#a78bfa">{t}</Chip>
          </li>
        ))}
      </ul>
    </div>
  );
}
