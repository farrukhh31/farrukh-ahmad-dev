"use client";

import { story } from "@/components/About/StoryData";
import { Card, Chip, Eyebrow } from "./shared";

const ACCENT = "#8b5cf6";

export default function AboutPanel() {
  return (
    <div>
      <Eyebrow color="#a78bfa">The story so far</Eyebrow>
      <p className="mt-3 max-w-xl text-2xl font-semibold leading-snug tracking-tight text-white">
        {story[0]?.subtitle ?? "Engineer. Creator. Problem solver."}
      </p>

      <ol className="mt-7 space-y-4">
        {story.map((item, i) => (
          <Card as="li" tilt key={item.id} accent={ACCENT} index={i} className="p-5 sm:p-6">
            <div className="flex gap-5">
              <span
                aria-hidden
                className="select-none font-mono text-5xl font-black leading-none tracking-tighter sm:text-6xl"
                style={{ color: "transparent", WebkitTextStroke: "1px rgba(167,139,250,0.55)" }}
              >
                {item.accent}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-violet-300/80">
                  Chapter {i + 1} of {story.length}
                </p>
                <h3 className="mt-1 text-lg font-semibold text-white">{item.title}</h3>
                <p className="text-sm italic text-slate-400">{item.subtitle}</p>
                <p className="mt-3 text-[14px] leading-relaxed text-slate-300">{item.description}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {item.tags.map((t) => <Chip key={t} color="#a78bfa">{t}</Chip>)}
                </div>
              </div>
            </div>
          </Card>
        ))}
      </ol>
    </div>
  );
}
