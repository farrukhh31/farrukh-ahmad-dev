"use client";

import { useRef } from "react";
import { ArrowLeft, ArrowRight, X } from "lucide-react";
import { useGame } from "@/lib/game/store";
import { ZONES, ZONE_BY_ID, ZoneId } from "@/lib/game/zones";
import { useDialogFocus } from "./useDialogFocus";

import PlazaPanel from "./panels/PlazaPanel";
import AboutPanel from "./panels/AboutPanel";
import SkillsPanel from "./panels/SkillsPanel";
import ProjectsPanel from "./panels/ProjectsPanel";
import QuestPanel from "./panels/QuestPanel";
import TrophyPanel from "./panels/TrophyPanel";
import CinemaPanel from "./panels/CinemaPanel";
import OraclePanel from "./panels/OraclePanel";
import CommsPanel from "./panels/CommsPanel";
import ResumePanel from "./panels/ResumePanel";
import HirePanel from "./panels/HirePanel";

const BODY: Record<ZoneId, () => React.JSX.Element> = {
  plaza: PlazaPanel,
  about: AboutPanel,
  skills: SkillsPanel,
  projects: ProjectsPanel,
  quest: QuestPanel,
  trophy: TrophyPanel,
  cinema: CinemaPanel,
  oracle: OraclePanel,
  resume: ResumePanel,
  hire: HirePanel,
  comms: CommsPanel,
};

export default function ZonePanel() {
  const openPanel = useGame((s) => s.openPanel);
  const close = useGame((s) => s.openZonePanel);
  const visited = useGame((s) => s.visited);
  const dialogRef = useRef<HTMLDivElement>(null);
  const onKeyDown = useDialogFocus(openPanel !== null, dialogRef);

  if (!openPanel) return null;
  const zone = ZONE_BY_ID[openPanel];
  const Body = BODY[openPanel];
  const at = ZONES.findIndex((z) => z.id === openPanel);
  const index = at + 1;
  const num = String(index).padStart(2, "0");
  const prev = ZONES[(at - 1 + ZONES.length) % ZONES.length];
  const next = ZONES[(at + 1) % ZONES.length];

  return (
    <div className="absolute inset-0 z-30 grid place-items-center bg-[radial-gradient(ellipse_at_center,rgba(3,7,18,0.55),rgba(3,7,18,0.88))] p-2.5 backdrop-blur-md sm:p-6" onClick={() => close(null)}>
      <div
        ref={dialogRef}
        onKeyDown={onKeyDown}
        role="dialog"
        aria-modal="true"
        aria-labelledby="zone-title"
        onClick={(e) => e.stopPropagation()}
        className="panel-pop relative flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-[28px] md:h-[min(80vh,760px)] md:flex-row"
        style={{
          background: `radial-gradient(900px circle at 0% 0%, ${zone.color}2b, transparent 55%), radial-gradient(700px circle at 100% 100%, #8b5cf622, transparent 55%), rgba(6,10,22,0.96)`,
          boxShadow: `0 0 0 1px ${zone.color}44, 0 40px 120px -20px ${zone.color}55, inset 0 1px 0 rgba(255,255,255,0.08)`,
        }}
      >
        <button
          onClick={() => close(null)}
          aria-label="Close panel"
          className="pm-btn !absolute right-4 top-4 z-20 !h-11 !rounded-full !bg-black/25 !text-white backdrop-blur hover:!bg-black/40"
        >
          <X size={18} />
          <span className="hidden sm:inline">Close</span>
          <kbd className="pm-key !hidden !h-6 !text-white sm:!inline-grid">Esc</kbd>
        </button>

        {/* Identity rail */}
        <aside className="relative shrink-0 overflow-hidden border-b border-white/10 p-5 pr-28 md:pr-8 md:flex md:w-[300px] md:flex-col md:border-b-0 md:border-r md:p-8">
          <span
            aria-hidden
            className="pointer-events-none absolute -bottom-6 -left-3 hidden select-none font-mono text-[10rem] font-black leading-none tracking-tighter md:block"
            style={{ color: zone.color, opacity: 0.08 }}
          >
            {num}
          </span>

          <span className="relative inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.25em]" style={{ borderColor: `${zone.color}55`, background: `${zone.color}18`, color: zone.color }}>
            <span className="opacity-60">{num}</span>
            {zone.section}
          </span>
          <h2 id="zone-title" className="relative mt-3 text-2xl font-semibold leading-tight tracking-tight text-white md:mt-5 md:text-[34px]">
            {zone.name}
          </h2>
          <p className="relative mt-1 text-sm italic text-slate-400">{zone.tagline}</p>
          <p className="relative mt-4 hidden text-[13px] leading-relaxed text-slate-400 md:block">{zone.description}</p>

          <div className="relative mt-auto hidden pt-8 md:block">
            <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.25em] text-slate-500">Islands discovered</p>
            <div className="flex gap-1.5" aria-label="Zones visited">
              {ZONES.map((z) => (
                <span
                  key={z.id}
                  title={z.name}
                  className="h-1.5 flex-1 rounded-full"
                  style={{ background: visited[z.id] || z.id === openPanel ? z.color : "rgba(255,255,255,0.1)", boxShadow: z.id === openPanel ? `0 0 10px ${z.color}` : undefined }}
                />
              ))}
            </div>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                onClick={() => close(prev.id)}
                aria-label={`Previous zone: ${prev.name}`}
                className="pm-tile !min-h-[56px] !flex-col !items-start !gap-0.5 !rounded-2xl !bg-white/[0.06] !p-3 !text-white"
                style={{ ["--pm-accent" as string]: prev.color }}
              >
                <ArrowLeft size={14} className="text-slate-400" />
                <span className="w-full truncate text-xs font-semibold">{prev.name}</span>
              </button>
              <button
                onClick={() => close(next.id)}
                aria-label={`Next zone: ${next.name}`}
                className="pm-tile !min-h-[56px] !flex-col !items-end !gap-0.5 !rounded-2xl !bg-white/[0.06] !p-3 !text-white"
                style={{ ["--pm-accent" as string]: next.color }}
              >
                <ArrowRight size={14} className="text-slate-400" />
                <span className="w-full truncate text-right text-xs font-semibold">{next.name}</span>
              </button>
            </div>
          </div>
        </aside>

        {/* Content */}
        <div className="panel-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6 md:p-8">
          <Body />
        </div>
      </div>
    </div>
  );
}
