"use client";

import { useMemo, useState } from "react";
import { Check, ChevronDown, Crown, Gem, Sparkles, Star } from "lucide-react";
import { skills } from "@/components/Skills/skillsData";
import { CATEGORY_ORDER, categoryColor } from "@/components/Skills/categoryTheme";
import type { Skill, SkillCategory } from "@/components/Skills/types";
import { TOTAL_SKILLS } from "@/lib/game/achievements";
import { useGame } from "@/lib/game/store";
import { Card, Chip, Count, Eyebrow, ProgressBar, Ring, SectionTitle, Stat } from "./shared";

const ACCENT = "#34d399";

/** Card rarity, from the skill's proficiency. */
const TIERS = [
  { min: 85, name: "Legendary", color: "#fbbf24", Icon: Crown, glow: true },
  { min: 75, name: "Epic", color: "#a78bfa", Icon: Gem, glow: true },
  { min: 65, name: "Rare", color: "#38bdf8", Icon: Star, glow: false },
  { min: 0, name: "Common", color: "#94a3b8", Icon: Sparkles, glow: false },
] as const;
const tierOf = (p: number) => TIERS.find((t) => p >= t.min) ?? TIERS[TIERS.length - 1];

function SkillCard({ skill, index, got }: { skill: Skill; index: number; got: boolean }) {
  const [open, setOpen] = useState(false);
  const color = categoryColor(skill.category);
  const tier = tierOf(skill.proficiency);
  const toggle = () => setOpen((v) => !v);

  return (
    <Card
      as="li"
      tilt
      accent={tier.glow ? tier.color : color}
      index={Math.min(index, 10)}
      className={tier.glow ? "rarity-border" : ""}
    >
      <div className="card-body p-4">
        <div
          role="button"
          tabIndex={0}
          aria-expanded={open}
          aria-label={`${skill.name}, ${tier.name} skill, ${skill.proficiency} percent. ${open ? "Hide" : "Show"} details`}
          onClick={toggle}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              toggle();
            }
          }}
          className="cursor-pointer rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-300"
        >
          <div className="flex items-center justify-between gap-2">
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.2em]"
              style={{ background: `${tier.color}1c`, color: tier.color, boxShadow: tier.glow ? `0 0 16px ${tier.color}33` : undefined }}
            >
              <tier.Icon size={11} className={tier.glow ? "float-y" : ""} /> {tier.name}
            </span>
            {got ? (
              <span className="node-pop flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: `${color}22`, color }}>
                <Check size={11} /> Collected
              </span>
            ) : (
              <span className="flex shrink-0 items-center gap-1 text-[10px] text-slate-500"><Sparkles size={11} /> In grove</span>
            )}
          </div>

          <div className="mt-3.5 flex items-center gap-3.5">
            <Ring value={skill.proficiency} color={color} size={58} stroke={4.5} label={`${skill.name} proficiency`} />
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-[16px] font-semibold leading-tight text-white">{skill.name}</h3>
              <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color }}>{skill.category}</p>
              <p className="mt-0.5 text-[11px] text-slate-500">{skill.level} · {skill.experience}</p>
            </div>
            <ChevronDown size={16} className={`shrink-0 text-slate-500 transition-transform duration-300 ${open ? "rotate-180 text-white" : ""}`} />
          </div>

          <div className="mt-3.5">
            <ProgressBar value={skill.proficiency} color={color} label={`${skill.name} proficiency bar`} height={5} index={index % 8} />
          </div>
        </div>

        <div className="expand" data-open={open}>
          <div>
            <p className="mt-3.5 text-xs leading-relaxed text-slate-300">{skill.description}</p>
            {skill.projects.length > 0 && (
              <>
                <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">Used in</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {skill.projects.map((p) => <Chip key={p} color={color}>{p}</Chip>)}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

export default function SkillsPanel() {
  const collected = useGame((s) => s.skills);
  const [filter, setFilter] = useState<SkillCategory | "All">("All");
  const count = Object.keys(collected).length;
  const list = skills.filter((s) => filter === "All" || s.category === filter);

  const avg = useMemo(() => Math.round(skills.reduce((a, s) => a + s.proficiency, 0) / Math.max(1, skills.length)), []);
  const breakdown = useMemo(
    () => CATEGORY_ORDER.map((c) => ({ c, n: skills.filter((s) => s.category === c).length })).filter((x) => x.n > 0),
    [],
  );
  const tiers = useMemo(() => TIERS.map((t) => ({ ...t, n: skills.filter((s) => tierOf(s.proficiency) === t).length })).filter((t) => t.n > 0), []);

  return (
    <div>
      {/* Overview */}
      <Card accent={ACCENT} lift={false} className="p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-x-8 gap-y-5">
          <Ring value={(count / TOTAL_SKILLS) * 100} color={ACCENT} size={92} stroke={7} label="Skill orbs collected">
            <span className="text-base">{count}/{TOTAL_SKILLS}</span>
          </Ring>
          <div className="min-w-[160px] flex-1">
            <Eyebrow color={ACCENT}>Skill orbs</Eyebrow>
            <p className="mt-2 text-lg font-semibold text-white">{count === TOTAL_SKILLS ? "Grove complete" : "Collect them all"}</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-400">Walk into the glowing orbs around the grove to collect them. +10 XP each. Tap a card to flip open its details.</p>
          </div>
          <div className="flex gap-8">
            <Stat value={<Count to={TOTAL_SKILLS} />} label="Skills" color={ACCENT} />
            <Stat value={<Count to={avg} suffix="%" />} label="Avg level" color={ACCENT} />
            <Stat value={<Count to={breakdown.length} />} label="Domains" color={ACCENT} />
          </div>
        </div>

        {/* rarity row */}
        <ul className="mt-5 flex flex-wrap gap-2" aria-label="Skills by rarity">
          {tiers.map((t) => (
            <li key={t.name} className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ background: `${t.color}18`, color: t.color }}>
              <t.Icon size={11} /> {t.name} <span className="font-mono opacity-70">{t.n}</span>
            </li>
          ))}
        </ul>

        {/* stacked distribution bar */}
        <div className="mt-5">
          <div className="flex h-2 gap-1 overflow-hidden rounded-full" role="img" aria-label="Skills per category">
            {breakdown.map(({ c, n }, i) => (
              <div key={c} className="bar-fill rounded-full" style={{ flex: n, background: categoryColor(c), boxShadow: `0 0 10px ${categoryColor(c)}66`, "--i": i } as React.CSSProperties} title={`${c}: ${n}`} />
            ))}
          </div>
          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] text-slate-400">
            {breakdown.map(({ c, n }) => (
              <li key={c} className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ background: categoryColor(c) }} />
                {c} <span className="font-mono text-slate-500">{n}</span>
              </li>
            ))}
          </ul>
        </div>
      </Card>

      <SectionTitle accent={ACCENT}>Arsenal</SectionTitle>
      <div className="-mx-1 flex flex-wrap gap-2 px-1" role="group" aria-label="Filter by category">
        <Chip active={filter === "All"} onClick={() => setFilter("All")}>All</Chip>
        {CATEGORY_ORDER.map((c) => (
          <Chip key={c} color={categoryColor(c)} active={filter === c} onClick={() => setFilter(c)}>{c}</Chip>
        ))}
      </div>

      <ul className="mt-4 grid items-start gap-3.5 sm:grid-cols-2">
        {list.map((s, i) => (
          <SkillCard key={`${filter}-${s.id}`} skill={s} index={i} got={!!collected[s.id]} />
        ))}
      </ul>
    </div>
  );
}
