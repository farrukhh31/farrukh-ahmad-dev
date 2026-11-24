"use client";

import { useMemo } from "react";
import { motion, type Variants } from "framer-motion";
import { Briefcase, Download, ExternalLink, Layers, Map as MapIcon, Trophy } from "lucide-react";
import { socialLinks } from "@/components/SocialSidebar/Sociallinks";
import { ROLES } from "@/components/hero/hero.data";
import { experience } from "@/components/Experience/ExperiencedData";
import { skills } from "@/components/Skills/skillsData";
import { categoryColor } from "@/components/Skills/categoryTheme";
import { ACHIEVEMENTS, TOTAL_SKILLS, TOTAL_ZONES } from "@/lib/game/achievements";
import { sfx } from "@/lib/game/audio";
import { levelFromXp, useGame, xpIntoLevel } from "@/lib/game/store";
import { XP_PER_LEVEL } from "@/lib/game/zones";
import { Count } from "./panels/shared";

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
  const zonesSeen = useGame((s) => Object.keys(s.visited).length);
  const skillsGot = useGame((s) => Object.keys(s.skills).length);
  const trophies = useGame((s) => Object.keys(s.achievements).length);
  const level = levelFromXp(xp);
  const pct = (xpIntoLevel(xp) / XP_PER_LEVEL) * 100;
  const now = experience.find((e) => e.current);
  const top = useMemo(() => [...skills].sort((a, b) => b.proficiency - a.proficiency).slice(0, 6), []);

  const tiles = [
    { icon: MapIcon, label: "Zones", value: zonesSeen, of: TOTAL_ZONES, color: "#22d3ee" },
    { icon: Layers, label: "Skills", value: skillsGot, of: TOTAL_SKILLS, color: "#34d399" },
    { icon: Trophy, label: "Trophies", value: trophies, of: ACHIEVEMENTS.length, color: "#fbbf24" },
  ];

  return (
    <div className="aura-card rounded-3xl" style={{ ["--accent" as string]: "#22d3ee" }}>
      <motion.div
        variants={list}
        initial="hidden"
        animate="show"
        className={`relative overflow-hidden rounded-3xl bg-[#060a16]/97 ${compact ? "max-h-[calc(100dvh-8.5rem)] overflow-y-auto p-5" : "p-5 sm:p-7"}`}
      >
        {/* soft moving glow */}
        <span aria-hidden className="aura-blob pointer-events-none absolute -right-10 -top-12 h-44 w-44 rounded-full bg-cyan-400/20 blur-3xl" />
        <span aria-hidden className="aura-blob pointer-events-none absolute -bottom-14 -left-10 h-44 w-44 rounded-full bg-violet-500/20 blur-3xl [animation-delay:-4s]" />

        {/* identity */}
        <motion.div variants={item} className="relative flex items-center gap-4">
          <div className="relative grid h-[76px] w-[76px] shrink-0 place-items-center">
            <span aria-hidden className="aura-spin absolute inset-0 rounded-full" />
            <span className="relative grid h-[68px] w-[68px] place-items-center rounded-full bg-[#0a1124] font-mono text-xl font-bold tracking-tight text-white">FA</span>
            <span className="absolute -bottom-1 -right-1 rounded-full bg-gradient-to-r from-cyan-400 to-violet-500 px-2 py-0.5 font-mono text-[10px] font-bold text-slate-950">LV {level}</span>
          </div>
          <div className="min-w-0">
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-cyan-300/80">Player one</p>
            <h3 className="text-xl font-semibold leading-tight text-white">Farrukh Ahmad</h3>
            <p className="mt-0.5 text-xs leading-snug text-slate-400">{ROLES.slice(0, 3).join(" · ")}</p>
          </div>
        </motion.div>

        {now && (
          <motion.div variants={item} className="relative mt-4 flex items-start gap-2.5 rounded-2xl border border-emerald-300/20 bg-emerald-400/[0.07] px-3.5 py-2.5">
            <Briefcase size={15} className="mt-0.5 shrink-0 text-emerald-300" />
            <p className="text-xs leading-snug text-slate-300">
              <span className="font-semibold uppercase tracking-wider text-emerald-300">Now · </span>
              {now.role}, {now.company.trim()}
            </p>
          </motion.div>
        )}

        {/* progress */}
        <motion.div variants={item} className="relative mt-4">
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span>Level {level} progress</span>
            <span className="font-mono text-slate-300">{xp} XP</span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label="Experience progress">
            <div className="bar-shine h-full rounded-full bg-gradient-to-r from-cyan-400 to-violet-500 transition-all duration-700" style={{ width: `${Math.max(4, pct)}%` }} />
          </div>
        </motion.div>

        <motion.ul variants={list} className="relative mt-3 grid grid-cols-3 gap-2">
          {tiles.map((t) => (
            <motion.li key={t.label} variants={item} className="rounded-2xl border border-white/10 bg-white/[0.04] px-2.5 py-2.5 text-center">
              <t.icon size={14} className="mx-auto" style={{ color: t.color }} />
              <p className="mt-1 font-mono text-base font-bold text-white"><Count to={t.value} /><span className="text-xs font-normal text-slate-500">/{t.of}</span></p>
              <p className="text-[10px] uppercase tracking-wider text-slate-500">{t.label}</p>
            </motion.li>
          ))}
        </motion.ul>

        {/* top skills */}
        <motion.div variants={item} className="relative mt-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">Strongest skills</p>
          <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2.5">
            {top.map((sk, i) => (
              <li key={sk.id}>
                <div className="flex justify-between text-[11px]">
                  <span className="truncate text-slate-200">{sk.name}</span>
                  <span className="font-mono text-slate-500">{sk.proficiency}</span>
                </div>
                <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/10">
                  <div className="bar-fill h-full rounded-full" style={{ width: `${sk.proficiency}%`, background: categoryColor(sk.category), ["--i" as string]: i }} />
                </div>
              </li>
            ))}
          </ul>
        </motion.div>

        {/* resume */}
        <motion.a
          variants={item}
          href={RESUME_URL}
          download={RESUME_FILE}
          onClick={() => sfx.success()}
          className="resume-btn group relative mt-5 flex w-full items-center justify-center gap-2.5 overflow-hidden rounded-2xl bg-gradient-to-r from-cyan-400 to-violet-500 px-4 py-3.5 text-sm font-semibold text-slate-950 shadow-[0_10px_34px_-8px_rgba(34,211,238,0.65)] transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200 active:scale-[0.98]"
        >
          <Download size={16} className="transition-transform duration-300 group-hover:translate-y-0.5" />
          Download resume (PDF)
        </motion.a>
        <motion.a
          variants={item}
          href={RESUME_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs font-medium text-slate-200 transition hover:border-white/25 hover:bg-white/10"
        >
          <ExternalLink size={13} /> View in new tab
        </motion.a>

        {/* profiles */}
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
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl transition duration-300 group-hover:-rotate-6 group-hover:scale-110" style={{ background: `${color}1f`, color }}>
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
