"use client";

import { motion, type Variants } from "framer-motion";
import { Download, ExternalLink } from "lucide-react";
import { socialLinks } from "@/components/SocialSidebar/Sociallinks";
import { ROLES } from "@/components/hero/hero.data";
import { sfx } from "@/lib/game/audio";
import { levelFromXp, useGame } from "@/lib/game/store";

export const RESUME_URL = "/Farrukh_Ahmad_Resume.pdf";
export const RESUME_FILE = "Farrukh_Ahmad_Resume.pdf";

const BRAND: Record<string, string> = {
  GitHub: "#e2e8f0",
  LinkedIn: "#38bdf8",
  Instagram: "#f472b6",
  Email: "#fbbf24",
};

const list: Variants = { show: { transition: { staggerChildren: 0.06, delayChildren: 0.12 } } };
const item: Variants = {
  hidden: { opacity: 0, y: 12, scale: 0.96 },
  show: { opacity: 1, y: 0, scale: 1, transition: { type: "spring", stiffness: 420, damping: 26 } },
};

/**
 * The player's trading card: avatar, name, level, a resume download button and every profile link.
 * `compact` is the small dropdown from the HUD, the full version sits at the top of the Plaza panel.
 */
export default function PlayerCard({ compact = false }: { compact?: boolean }) {
  const xp = useGame((s) => s.xp);
  const level = levelFromXp(xp);

  return (
    <div className="aura-card rounded-3xl" style={{ ["--accent" as string]: "#22d3ee" }}>
      <motion.div
        variants={list}
        initial="hidden"
        animate="show"
        className={`relative overflow-hidden rounded-3xl bg-[#060a16]/95 ${compact ? "p-4" : "p-5 sm:p-6"}`}
      >
        {/* soft moving glow */}
        <span aria-hidden className="aura-blob pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full bg-cyan-400/20 blur-3xl" />
        <span aria-hidden className="aura-blob pointer-events-none absolute -bottom-14 -left-10 h-40 w-40 rounded-full bg-violet-500/20 blur-3xl [animation-delay:-4s]" />

        <motion.div variants={item} className="relative flex items-center gap-4">
          <div className="relative grid h-16 w-16 shrink-0 place-items-center">
            <span aria-hidden className="aura-spin absolute inset-0 rounded-full" />
            <span className="relative grid h-[58px] w-[58px] place-items-center rounded-full bg-[#0a1124] font-mono text-lg font-bold tracking-tight text-white">FA</span>
            <span className="absolute -bottom-1 -right-1 rounded-full bg-gradient-to-r from-cyan-400 to-violet-500 px-1.5 py-0.5 font-mono text-[10px] font-bold text-slate-950">LV {level}</span>
          </div>
          <div className="min-w-0">
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-cyan-300/80">Player one</p>
            <h3 className="truncate text-lg font-semibold leading-tight text-white">Farrukh Ahmad</h3>
            <p className="mt-0.5 truncate text-xs text-slate-400">{ROLES.slice(0, 3).join(" · ")}</p>
          </div>
        </motion.div>

        <motion.a
          variants={item}
          href={RESUME_URL}
          download={RESUME_FILE}
          onClick={() => sfx.success()}
          className="resume-btn group relative mt-4 flex w-full items-center justify-center gap-2.5 overflow-hidden rounded-2xl bg-gradient-to-r from-cyan-400 to-violet-500 px-4 py-3 text-sm font-semibold text-slate-950 shadow-[0_10px_34px_-8px_rgba(34,211,238,0.65)] transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200 active:scale-[0.98]"
        >
          <Download size={16} className="transition-transform duration-300 group-hover:translate-y-0.5" />
          Download resume
        </motion.a>

        <motion.a
          variants={item}
          href={RESUME_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-medium text-slate-200 transition hover:border-white/25 hover:bg-white/10"
        >
          <ExternalLink size={13} /> View in new tab
        </motion.a>

        <motion.ul variants={list} className={`relative mt-4 grid gap-2 ${compact ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-4"}`}>
          {socialLinks.map((l) => {
            const color = BRAND[l.name] ?? "#22d3ee";
            const Icon = l.icon;
            return (
              <motion.li key={l.name} variants={item}>
                <a
                  href={l.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${l.name} (opens in a new tab)`}
                  className="social-tile group flex items-center gap-2.5 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm font-medium text-slate-200 transition hover:-translate-y-0.5 hover:text-white focus-visible:outline-2 focus-visible:outline-cyan-300"
                  style={{ ["--tint" as string]: color }}
                >
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl transition duration-300 group-hover:scale-110 group-hover:-rotate-6" style={{ background: `${color}1f`, color }}>
                    <Icon size={16} />
                  </span>
                  {l.name}
                </a>
              </motion.li>
            );
          })}
        </motion.ul>
      </motion.div>
    </div>
  );
}
