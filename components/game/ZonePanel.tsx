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
    <div className="absolute inset-0 z-30 grid place-items-end bg-[radial-gradient(ellipse_at_center,rgba(3,7,18,0.55),rgba(3,7,18,0.88))] p-0 pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] backdrop-blur-md sm:place-items-center sm:p-6" onClick={() => close(null)}>
      <div
        ref={dialogRef}
        onKeyDown={onKeyDown}
        role="dialog"
        aria-modal="true"
        aria-labelledby="zone-title"
        onClick={(e) => e.stopPropagation()}
        className="panel-pop zone-sheet relative mx-auto flex max-h-[94dvh] w-full max-w-5xl flex-col overflow-hidden rounded-b-none rounded-t-[28px] sm:rounded-[28px] md:h-[min(80dvh,760px)] md:flex-row"
        style={{
          background: `radial-gradient(900px circle at 0% 0%, ${zone.color}2b, transparent 55%), radial-gradient(700px circle at 100% 100%, #8b5cf622, transparent 55%), rgba(6,10,22,0.96)`,
          boxShadow: `0 0 0 1px ${zone.color}44, 0 40px 120px -20px ${zone.color}55, inset 0 1px 0 rgba(255,255,255,0.08)`,
        }}
      >
        <span aria-hidden className="absolute left-1/2 top-2 z-20 h-1 w-10 -translate-x-1/2 rounded-full bg-white/25 sm:hidden" />
        <button
          onClick={() => close(null)}
          aria-label="Close panel"
          className="pm-btn !absolute right-3 top-4 z-20 !h-11 !min-w-11 !rounded-full !bg-black/30 !text-white backdrop-blur hover:!bg-black/40 sm:right-4"
        >
          <X size={18} />
          <span className="hidden sm:inline">Close</span>
          <kbd className="pm-key !hidden !h-6 !text-white sm:!inline-grid">Esc</kbd>
        </button>

        {/* Identity rail */}
        <aside className="relative shrink-0 overflow-hidden border-b border-white/10 px-5 pb-4 pr-20 pt-6 sm:p-5 sm:pr-28 md:flex md:w-[300px] md:flex-col md:border-b-0 md:border-r md:p-8 [@media(max-height:520px)]:md:w-[240px] [@media(max-height:520px)]:md:p-5">
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
        <div className="panel-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6 md:p-8 [@media(max-height:520px)]:md:p-5">
          <Body />
        </div>

        {/* phones and small tablets: previous / next zone sit under the content, in thumb reach */}
        <nav aria-label="Zone navigation" className="grid shrink-0 grid-cols-2 gap-2 border-t border-white/10 bg-black/20 p-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] md:hidden">
          <button
            onClick={() => close(prev.id)}
            aria-label={`Previous zone: ${prev.name}`}
            className="flex min-h-12 touch-manipulation items-center gap-2 rounded-2xl bg-white/[0.06] px-3.5 text-left text-white transition active:scale-[0.98]"
          >
            <ArrowLeft size={16} className="shrink-0 text-slate-400" />
            <span className="min-w-0 truncate text-[13px] font-semibold">{prev.name}</span>
          </button>
          <button
            onClick={() => close(next.id)}
            aria-label={`Next zone: ${next.name}`}
            className="flex min-h-12 touch-manipulation items-center justify-end gap-2 rounded-2xl bg-white/[0.06] px-3.5 text-right text-white transition active:scale-[0.98]"
          >
            <span className="min-w-0 truncate text-[13px] font-semibold">{next.name}</span>
            <ArrowRight size={16} className="shrink-0 text-slate-400" />
          </button>
        </nav>
      </div>
    </div>
  );
}
