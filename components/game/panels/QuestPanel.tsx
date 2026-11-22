"use client";

import { useEffect, useRef } from "react";
import { Briefcase, GraduationCap } from "lucide-react";
import { useInView } from "react-intersection-observer";
import { experience, type ExperienceItem } from "@/components/Experience/ExperiencedData";
import { Card, Chip, Count, Eyebrow, Stat } from "./shared";

const WORK = "#fbbf24";
const EDU = "#60a5fa";

/** Fills the timeline spine as the panel is scrolled (writes a CSS variable, so it never re-renders). */
function useSpineFill(ref: React.RefObject<HTMLOListElement | null>) {
  useEffect(() => {
    const list = ref.current;
    const scroller = list?.closest<HTMLElement>(".panel-scroll");
    if (!list || !scroller) return;
    const update = () => {
      const l = list.getBoundingClientRect();
      const s = scroller.getBoundingClientRect();
      const reached = s.top + s.height * 0.62 - l.top;
      list.style.setProperty("--fill", String(Math.max(0, Math.min(1, reached / Math.max(1, l.height)))));
    };
    update();
    scroller.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      scroller.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [ref]);
}

function QuestItem({ e }: { e: ExperienceItem }) {
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.12, fallbackInView: true });
  const edu = e.type === "education";
  const color = edu ? EDU : WORK;

  return (
    <li ref={ref} data-in={inView} className="reveal from-right relative">
      <span
        className={`absolute -left-12 top-3 grid h-10 w-10 place-items-center rounded-full border bg-[#060a16] ${inView ? "node-pop" : "scale-0"}`}
        style={{ borderColor: `${color}88`, color, boxShadow: `0 0 0 4px #060a16, 0 0 22px ${color}55`, animationDelay: "0.15s" }}
      >
        {edu ? <GraduationCap size={17} /> : <Briefcase size={17} />}
        {inView && <span aria-hidden className="node-burst absolute inset-0 rounded-full border-2" style={{ borderColor: color, animationDelay: "0.3s" }} />}
        {e.current && <span className="live-ping absolute inset-0 rounded-full border" style={{ borderColor: color }} />}
      </span>

      <Card tilt accent={color} index={0} className="p-5">
        <div className="card-body">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md px-2 py-0.5 font-mono text-xs font-semibold" style={{ background: `${color}1f`, color }}>{e.year}</span>
            {e.current && (
              <span className="flex items-center gap-1.5 rounded-full bg-emerald-400/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-300">
                <span className="relative grid h-1.5 w-1.5 place-items-center">
                  <span className="live-ping absolute inset-0 rounded-full bg-emerald-300" />
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
                </span>
                Current quest
              </span>
            )}
            <span className="ml-auto text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">{edu ? "Education" : "Work"}</span>
          </div>
          <h3 className="mt-2.5 text-base font-semibold text-white">{e.role}</h3>
          <p className="text-xs text-slate-400">{e.company.trim()}</p>
          <p className="mt-3 text-[13.5px] leading-relaxed text-slate-300">{e.description}</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {e.technologies.map((t, k) => (
              <span key={t} className={inView ? "panel-rise" : "opacity-0"} style={{ "--i": 4 + k } as React.CSSProperties}>
                <Chip color={color}>{t}</Chip>
              </span>
            ))}
          </div>
        </div>
      </Card>
    </li>
  );
}

export default function QuestPanel() {
  const list = useRef<HTMLOListElement>(null);
  useSpineFill(list);
  const work = experience.filter((e) => e.type === "work").length;
  const edu = experience.length - work;

  return (
    <div>
      <Card accent={WORK} lift={false} className="p-5 sm:p-6">
        <div className="card-body flex flex-wrap items-center justify-between gap-x-8 gap-y-4">
          <div className="min-w-[180px] flex-1">
            <Eyebrow color={WORK}>Checkpoints reached</Eyebrow>
            <p className="mt-2 text-lg font-semibold text-white">The journey so far</p>
            <p className="mt-1 text-xs text-slate-400">Newest first. Scroll down and the path lights up as you go.</p>
          </div>
          <div className="flex gap-8">
            <Stat value={<Count to={experience.length} />} label="Checkpoints" color={WORK} />
            <Stat value={<Count to={work} />} label="Work" color={WORK} />
            <Stat value={<Count to={edu} />} label="Study" color={EDU} />
          </div>
        </div>
      </Card>

      <ol ref={list} className="relative mt-7 space-y-5 pl-12" style={{ "--fill": 0 } as React.CSSProperties}>
        {/* faint spine + glowing fill that follows the scroll */}
        <span aria-hidden className="absolute bottom-2 left-[19px] top-2 w-px bg-white/10" />
        <span
          aria-hidden
          className="absolute left-[18px] top-2 w-[3px] rounded-full bg-gradient-to-b from-amber-300 via-amber-300 to-blue-400 shadow-[0_0_14px_rgba(251,191,36,0.7)]"
          style={{ height: "calc((100% - 1rem) * var(--fill, 0))" }}
        />
        {experience.map((e) => (
          <QuestItem key={e.id} e={e} />
        ))}
      </ol>
    </div>
  );
}
