"use client";

import { useMemo } from "react";
import { ArrowRight, Mail } from "lucide-react";
import { ROLES } from "@/components/hero/hero.data";
import { socialLinks } from "@/components/SocialSidebar/Sociallinks";
import { skills } from "@/components/Skills/skillsData";
import { CATEGORY_ORDER, CATEGORY_THEME } from "@/components/Skills/categoryTheme";
import { useGame } from "@/lib/game/store";
import { travelToZone } from "@/lib/game/travel";
import { Card, Chip, Eyebrow, ProgressBar, SectionTitle } from "./shared";

const ACCENT = "#f97316";

export default function HirePanel() {
  const close = useGame((s) => s.openZonePanel);
  const email = socialLinks.find((l) => l.name === "Email");

  // for each category, the skills I am strongest in, so this page always matches the Skill Grove
  const strengths = useMemo(
    () =>
      CATEGORY_ORDER.map((cat) => {
        const list = skills.filter((s) => s.category === cat).sort((a, b) => b.proficiency - a.proficiency);
        return { cat, top: list.slice(0, 3), best: list[0]?.proficiency ?? 0 };
      }).filter((c) => c.top.length > 0),
    [],
  );

  return (
    <div>
      <Eyebrow color={ACCENT}>Work with me</Eyebrow>
      <p className="mt-3 max-w-xl text-2xl font-semibold leading-snug tracking-tight text-white">
        Got something to build? Here is where I can help.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {ROLES.map((r) => <Chip key={r} color={ACCENT}>{r}</Chip>)}
      </div>

      <Card accent={ACCENT} lift={false} className="mt-6 p-5 sm:p-6">
        <p className="text-base font-semibold text-white">Say hello</p>
        <p className="mt-1 text-sm text-slate-400">The quickest way is a message from the Comms Tower, or email me directly.</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            onClick={() => {
              close(null);
              travelToZone("comms");
            }}
            className="pm-cta"
            style={{ ["--pm-accent" as string]: ACCENT }}
          >
            Send a message <ArrowRight size={18} />
          </button>
          {email && (
            <a href={email.href} target="_blank" rel="noopener noreferrer" className="pm-btn !h-[52px] !text-white" aria-label="Email Farrukh (opens in a new tab)">
              <Mail size={16} /> Email me
            </a>
          )}
        </div>
      </Card>

      <SectionTitle accent={ACCENT}>What I work with most</SectionTitle>
      <ul className="grid gap-3 sm:grid-cols-2">
        {strengths.map(({ cat, top, best }, i) => {
          const color = CATEGORY_THEME[cat].color;
          return (
            <Card as="li" key={cat} accent={color} index={i} className="p-4">
              <p className="text-sm font-semibold text-white">{cat}</p>
              <p className="mt-1 text-xs text-slate-400">{top.map((t) => t.name).join(", ")}</p>
              <div className="mt-3">
                <ProgressBar value={best} color={color} label={`${cat} strength`} index={i} />
              </div>
            </Card>
          );
        })}
      </ul>
    </div>
  );
}
