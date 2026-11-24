"use client";

import { Briefcase, Download, ExternalLink, FileText } from "lucide-react";
import { experience } from "@/components/Experience/ExperiencedData";
import { sfx } from "@/lib/game/audio";
import { RESUME_FILE, RESUME_URL } from "../PlayerCard";
import { Card, Chip, Eyebrow, SectionTitle } from "./shared";

const ACCENT = "#fb7185";

export default function ResumePanel() {
  const now = experience.find((e) => e.current);
  const work = experience.filter((e) => e.type === "work").slice(0, 3);

  return (
    <div>
      <Eyebrow color={ACCENT}>Resume</Eyebrow>
      <p className="mt-3 max-w-xl text-2xl font-semibold leading-snug tracking-tight text-white">
        Everything on one page, ready to send on.
      </p>

      <Card accent={ACCENT} lift={false} className="mt-6 p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-5">
          <span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl" style={{ background: `${ACCENT}26`, color: ACCENT }}>
            <FileText size={28} />
          </span>
          <div className="min-w-[180px] flex-1">
            <p className="text-lg font-semibold text-white">Farrukh Ahmad</p>
            <p className="text-sm text-slate-400">{RESUME_FILE}</p>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          <a
            href={RESUME_URL}
            download={RESUME_FILE}
            onClick={() => sfx.success()}
            className="pm-cta"
            style={{ ["--pm-accent" as string]: ACCENT }}
          >
            <Download size={18} /> Download PDF
          </a>
          <a href={RESUME_URL} target="_blank" rel="noopener noreferrer" className="pm-btn !h-[52px] !text-white" aria-label="View resume in a new tab (opens in a new tab)">
            <ExternalLink size={16} /> View in new tab
          </a>
        </div>
      </Card>

      {now && (
        <>
          <SectionTitle accent={ACCENT}>Right now</SectionTitle>
          <Card accent="#34d399" lift={false} className="p-5">
            <div className="flex items-start gap-3">
              <Briefcase size={18} className="mt-0.5 shrink-0 text-emerald-300" />
              <div>
                <p className="font-semibold text-white">{now.role}</p>
                <p className="mt-1 text-sm leading-relaxed text-slate-300">{now.description}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {now.technologies.map((t) => <Chip key={t} color="#34d399">{t}</Chip>)}
                </div>
              </div>
            </div>
          </Card>
        </>
      )}

      {work.length > 0 && (
        <>
          <SectionTitle accent={ACCENT}>On the resume</SectionTitle>
          <ul className="space-y-3">
            {work.map((w, i) => (
              <Card as="li" key={w.id} accent={ACCENT} index={i} className="p-4">
                <p className="text-sm font-semibold text-white">{w.role}</p>
                <p className="text-xs text-slate-400">{w.year}</p>
              </Card>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
