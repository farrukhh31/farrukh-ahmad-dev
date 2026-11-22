"use client";

import { Lock, Trophy } from "lucide-react";
import { DESCRIPTION_WORDS, ROLES, STATS } from "@/components/hero/hero.data";
import { ACHIEVEMENTS, TOTAL_SKILLS, TOTAL_ZONES } from "@/lib/game/achievements";
import { levelFromXp, useGame, xpIntoLevel } from "@/lib/game/store";
import { XP_PER_LEVEL } from "@/lib/game/zones";
import PlayerCard from "../PlayerCard";
import { Card, Chip, Eyebrow, ProgressBar, Ring, SectionTitle, Stat } from "./shared";

const CYAN = "#22d3ee";

export default function PlazaPanel() {
  const xp = useGame((s) => s.xp);
  const visited = useGame((s) => Object.keys(s.visited).length);
  const skills = useGame((s) => Object.keys(s.skills).length);
  const unlocked = useGame((s) => s.achievements);
  const level = levelFromXp(xp);
  const into = xpIntoLevel(xp);
  const doneCount = ACHIEVEMENTS.filter((a) => unlocked[a.id]).length;

  return (
    <div>
      <PlayerCard />

      <div className="mt-7" />
      <Eyebrow color={CYAN}>Welcome, player one</Eyebrow>
      <p className="mt-3 text-[17px] leading-relaxed text-slate-200">{DESCRIPTION_WORDS.map(([w]) => w).join(" ")}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {ROLES.slice(0, 6).map((r) => (
          <Chip key={r} color={CYAN}>{r}</Chip>
        ))}
      </div>

      <Card accent={CYAN} lift={false} className="mt-6 p-5">
        <div className="grid grid-cols-3 gap-4 text-center sm:gap-6">
          {STATS.map((s) => (
            <div key={s.id} className="flex justify-center"><Stat value={`${s.target}${s.suffix}`} label={s.label} color={CYAN} /></div>
          ))}
        </div>
      </Card>

      <SectionTitle accent={CYAN}>Player profile</SectionTitle>
      <Card accent="#8b5cf6" lift={false} className="p-5">
        <div className="flex flex-wrap items-center gap-6">
          <Ring value={(into / XP_PER_LEVEL) * 100} color="#a78bfa" size={88} stroke={7} label={`Level ${level} progress`}>
            <span className="text-sm">LV {level}</span>
          </Ring>
          <div className="min-w-[150px] flex-1">
            <p className="font-mono text-2xl font-semibold tabular-nums text-white">{xp} <span className="text-sm font-normal text-slate-400">XP</span></p>
            <p className="mt-1 text-xs text-slate-400">{XP_PER_LEVEL - into} XP to level {level + 1}</p>
          </div>
          <div className="flex gap-7">
            <Stat value={`${visited}/${TOTAL_ZONES}`} label="Zones" color="#a78bfa" />
            <Stat value={`${skills}/${TOTAL_SKILLS}`} label="Skills" color="#a78bfa" />
          </div>
        </div>
      </Card>

      <SectionTitle accent="#f59e0b">Achievements · {doneCount}/{ACHIEVEMENTS.length}</SectionTitle>
      <ul className="grid gap-2.5 sm:grid-cols-2">
        {ACHIEVEMENTS.map((a, i) => {
          const done = !!unlocked[a.id];
          return (
            <Card as="li" tilt key={a.id} accent={done ? "#f59e0b" : "#64748b"} index={Math.min(i, 10)} className={`flex items-center gap-3 px-3.5 py-3 ${done ? "" : "opacity-70"}`}>
              <span
                className="grid h-9 w-9 shrink-0 place-items-center rounded-xl"
                style={done ? { background: "linear-gradient(135deg,#fde68a,#f59e0b)", color: "#451a03", boxShadow: "0 0 18px rgba(245,158,11,.4)" } : { background: "rgba(255,255,255,.06)", color: "#64748b" }}
              >
                {done ? <Trophy size={16} /> : <Lock size={14} />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-white">{a.title}</span>
                <span className="block truncate text-xs text-slate-400">{a.hint}</span>
              </span>
              <span className="shrink-0 rounded-full bg-white/5 px-2 py-0.5 font-mono text-[10px] text-amber-300">+{a.reward}</span>
            </Card>
          );
        })}
      </ul>
      <div className="mt-4"><ProgressBar value={(doneCount / Math.max(1, ACHIEVEMENTS.length)) * 100} color="#f59e0b" label="Achievements unlocked" height={4} /></div>
    </div>
  );
}
