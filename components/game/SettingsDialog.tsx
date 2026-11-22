"use client";

import { useRef, useState } from "react";
import { X } from "lucide-react";

import { analyticsEnabled, setAnalyticsOptOut, track } from "@/lib/analytics/client";
import { useGame } from "@/lib/game/store";
import { MUSIC_TRACKS, setMusicOn, setMusicTrack, setMusicVolume } from "@/lib/game/music";
import { useDialogFocus } from "./useDialogFocus";
import { useMusicPref } from "./useMusicPref";

function Switch({ id, label, hint, checked, onChange, disabled }: { id: string; label: string; hint: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <li className="flex items-start justify-between gap-4 py-3">
      <div>
        <label htmlFor={id} className="text-sm font-medium text-white">{label}</label>
        <p id={`${id}-hint`} className="mt-0.5 text-xs leading-relaxed text-slate-400">{hint}</p>
      </div>
      <button
        id={id}
        role="switch"
        aria-checked={checked}
        aria-describedby={`${id}-hint`}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full border transition focus-visible:outline-2 focus-visible:outline-cyan-300 disabled:opacity-50 ${checked ? "border-cyan-300 bg-cyan-500/60" : "border-white/30 bg-white/10"}`}
      >
        <span className={`absolute top-0.5 h-4.5 w-4.5 rounded-full bg-white transition-all ${checked ? "left-5.5" : "left-0.5"}`} />
        <span className="sr-only">{checked ? "On" : "Off"}</span>
      </button>
    </li>
  );
}

/** Accessibility and privacy preferences. Everything is stored on this device only. */
export default function SettingsDialog() {
  const open = useGame((s) => s.settingsOpen);
  // the body only exists while open, so its state starts fresh every time the dialog opens
  return open ? <SettingsBody /> : null;
}

function SettingsBody() {
  const setOpen = useGame((s) => s.setSettingsOpen);
  const motionPref = useGame((s) => s.motionPref);
  const setMotionPref = useGame((s) => s.setMotionPref);
  const highContrast = useGame((s) => s.highContrast);
  const setHighContrast = useGame((s) => s.setHighContrast);
  const largeText = useGame((s) => s.largeText);
  const setLargeText = useGame((s) => s.setLargeText);
  const muted = useGame((s) => s.muted);
  const music = useMusicPref();
  const toggleMuted = useGame((s) => s.toggleMuted);
  const resetProgress = useGame((s) => s.resetProgress);

  const [analytics, setAnalytics] = useState(() => analyticsEnabled());
  const [confirmReset, setConfirmReset] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const onKeyDown = useDialogFocus(true, ref);

  const dnt = typeof navigator !== "undefined" && (navigator.doNotTrack === "1" || (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true);

  const changed = (name: string) => track("setting", name);

  return (
    <div className="absolute inset-0 z-40 grid place-items-center bg-black/60 p-4 backdrop-blur-sm" onClick={() => setOpen(false)}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        onKeyDown={onKeyDown}
        onClick={(e) => e.stopPropagation()}
        className="relative max-h-[88vh] w-full max-w-md overflow-y-auto rounded-3xl border border-cyan-400/30 bg-slate-950/95 p-6 shadow-2xl"
      >
        <button onClick={() => setOpen(false)} aria-label="Close settings" className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full bg-white/5 text-slate-300 hover:bg-white/10">
          <X size={16} />
        </button>
        <h2 id="settings-title" className="text-xl font-bold text-white">Settings</h2>
        <p className="mt-1 text-sm text-slate-400">Saved on this device only.</p>

        <h3 className="mb-1 mt-5 text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-500">Accessibility</h3>
        <ul className="divide-y divide-white/10">
          <Switch id="set-motion" label="Reduce motion" hint="Calms bobbing, sparkles, water ripples and moving lights. Follows your system setting automatically." checked={motionPref === "reduce"} onChange={(v) => { setMotionPref(v ? "reduce" : "system"); changed("reduce-motion"); }} />
          <Switch id="set-contrast" label="High contrast" hint="Brighter text, solid dark panels and stronger borders." checked={highContrast} onChange={(v) => { setHighContrast(v); changed("high-contrast"); }} />
          <Switch id="set-large" label="Larger text" hint="Makes text about 25% bigger across the menus and panels." checked={largeText} onChange={(v) => { setLargeText(v); changed("large-text"); }} />
          <Switch id="set-music" label="Background music" hint="Generated live in your browser. It lowers itself while a panel is open." checked={music.on} onChange={(v) => setMusicOn(v)} />
          {music.on && (
            <li className="py-3" role="group" aria-label="Music style">
              <p className="text-sm font-medium text-white">Music style</p>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {MUSIC_TRACKS.map((t) => {
                  const on = music.track === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => { setMusicTrack(t.id); changed("music-style"); }}
                      className={`rounded-xl border px-2 py-2 text-left transition focus-visible:outline-2 focus-visible:outline-cyan-300 ${on ? "border-cyan-300/70 bg-cyan-400/15 text-white shadow-[0_0_18px_rgba(34,211,238,0.25)]" : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"}`}
                    >
                      <span className="block text-xs font-semibold">{t.label}</span>
                      <span className="mt-0.5 block text-[10px] leading-snug text-slate-400">{t.hint}</span>
                    </button>
                  );
                })}
              </div>
            </li>
          )}
          {music.on && (
            <li className="flex items-center gap-4 py-3">
              <label htmlFor="set-music-vol" className="text-sm font-medium text-white">Music volume</label>
              <input
                id="set-music-vol"
                type="range"
                min={0}
                max={100}
                value={Math.round(music.vol * 100)}
                onChange={(e) => setMusicVolume(Number(e.target.value) / 100)}
                className="h-1.5 flex-1 cursor-pointer accent-cyan-400"
              />
              <span className="w-9 text-right font-mono text-xs tabular-nums text-slate-400">{Math.round(music.vol * 100)}%</span>
            </li>
          )}
          <Switch id="set-sound" label="Sound effects" hint="Short, quiet sounds when you collect orbs and discover zones." checked={!muted} onChange={() => toggleMuted()} />
        </ul>

        <h3 className="mb-1 mt-5 text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-500">Privacy</h3>
        <ul>
          <Switch
            id="set-analytics"
            label="Anonymous usage statistics"
            hint={dnt ? "Your browser sends Do Not Track, so nothing is counted." : "Counts things like which zones get visited. No cookies, no personal data, and never what you type into the chatbot or contact form."}
            checked={analytics && !dnt}
            disabled={dnt}
            onChange={(v) => { setAnalytics(v); setAnalyticsOptOut(!v); }}
          />
        </ul>

        <h3 className="mb-2 mt-5 text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-500">Progress</h3>
        {confirmReset ? (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-slate-300">Erase XP, orbs and achievements?</span>
            <button onClick={() => { resetProgress(); setConfirmReset(false); }} className="rounded-lg bg-red-500/25 px-3 py-1.5 font-medium text-red-100 hover:bg-red-500/40">Yes, reset</button>
            <button onClick={() => setConfirmReset(false)} className="rounded-lg bg-white/10 px-3 py-1.5 text-slate-200 hover:bg-white/20">Cancel</button>
          </div>
        ) : (
          <button onClick={() => setConfirmReset(true)} className="rounded-lg bg-white/10 px-3 py-1.5 text-sm text-slate-200 hover:bg-white/20">Reset my progress</button>
        )}
      </div>
    </div>
  );
}
