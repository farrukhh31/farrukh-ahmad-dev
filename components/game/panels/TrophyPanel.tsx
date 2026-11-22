"use client";

import { ExternalLink, Lock, Trophy } from "lucide-react";
import { certificates } from "@/components/certificates/certificatesData";
import { Card, Chip, Eyebrow, ProgressBar, Ring } from "./shared";

const GOLD = "#f59e0b";

export default function TrophyPanel() {
  const done = certificates.filter((c) => c.status === "completed").length;
  return (
    <div>
      <Card accent={GOLD} lift={false} className="p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-5">
          <Ring value={(done / Math.max(1, certificates.length)) * 100} color={GOLD} size={84} stroke={7} label="Trophies unlocked">
            <span className="text-base">{done}/{certificates.length}</span>
          </Ring>
          <div className="min-w-[180px] flex-1">
            <Eyebrow color={GOLD}>Trophy room</Eyebrow>
            <p className="mt-2 text-lg font-semibold text-white">{done} unlocked, {certificates.length - done} to go</p>
            <p className="mt-1 text-xs text-slate-400">Completed certificates shine. In-progress ones stay locked until they are earned.</p>
          </div>
        </div>
      </Card>

      <ul className="mt-5 grid gap-3 sm:grid-cols-2">
        {certificates.map((c, i) => {
          const ok = c.status === "completed";
          return (
            <Card as="li" tilt key={c.id} accent={ok ? GOLD : "#64748b"} index={Math.min(i, 10)} className={`p-4 ${ok ? "sheen" : "opacity-80"}`}>
              <div className="flex items-start gap-3">
                <span
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl"
                  style={ok ? { background: "linear-gradient(135deg,#fde68a,#f59e0b)", color: "#451a03", boxShadow: "0 0 24px rgba(245,158,11,.45)" } : { background: "rgba(255,255,255,.06)", color: "#64748b" }}
                >
                  {ok ? <Trophy size={19} /> : <Lock size={17} />}
                </span>
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold leading-snug text-white">{c.title}</h3>
                  <p className="mt-0.5 text-xs text-slate-400">{c.issuer} · {c.year}</p>
                </div>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-slate-400">{c.description}</p>
              {!ok && typeof c.progress === "number" && (
                <div className="mt-3">
                  <div className="mb-1 flex justify-between text-[10px] text-slate-500"><span>In progress</span><span className="font-mono">{c.progress}%</span></div>
                  <ProgressBar value={c.progress} color="#94a3b8" label={`${c.title} progress`} height={4} />
                </div>
              )}
              <div className="mt-3 flex flex-wrap gap-1.5">{c.skills.slice(0, 4).map((s) => <Chip key={s}>{s}</Chip>)}</div>
              <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500">
                <span className="truncate font-mono">{ok ? (c.credentialId ?? "Completed") : (c.expectedCompletion ?? "In progress")}</span>
                {ok && c.pdf && c.pdf !== "#" && (
                  <a href={c.pdf} target="_blank" rel="noreferrer" className="flex shrink-0 items-center gap-1 text-amber-300 hover:underline">View <ExternalLink size={11} /></a>
                )}
              </div>
            </Card>
          );
        })}
      </ul>
    </div>
  );
}
