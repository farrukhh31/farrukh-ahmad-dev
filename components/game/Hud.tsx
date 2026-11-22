"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import ModeLink from "@/components/PlayCTA/ModeLink";
import { ArrowLeft, CircleHelp, ChevronDown, Compass, Gamepad2, Hand, UserRound, Map as MapIcon, Menu, Moon, Music, Settings, Sparkles, Sun, Volume2, VolumeX, X, Zap } from "lucide-react";
import { useTheme } from "next-themes";

import { levelFromXp, useGame, xpIntoLevel } from "@/lib/game/store";
import { travelToZone } from "@/lib/game/travel";
import { TOTAL_SKILLS } from "@/lib/game/achievements";
import { XP_PER_LEVEL, ZONES } from "@/lib/game/zones";
import Minimap from "./Minimap";
import Joystick from "./Joystick";
import ZonePanel from "./ZonePanel";
import Announcer from "./Announcer";
import { HelpDialog, IntroTip } from "./Help";
import SettingsDialog from "./SettingsDialog";
import PlayerCard from "./PlayerCard";
import { EMOTES } from "@/lib/game/gestures";
import { track } from "@/lib/analytics/client";
import { initAudio } from "@/lib/game/audio";
import { cycleMusic, MUSIC_TRACKS } from "@/lib/game/music";
import { useMusicPref } from "./useMusicPref";

const glass = "hud-glass backdrop-blur-xl";
const btn = `flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-slate-200 transition focus-visible:outline-2 focus-visible:outline-cyan-300 ${glass}`;

type Action = {
  id: string;
  label: string;
  icon: React.ReactNode;
  aria?: string;
  onClick?: () => void;
  href?: string;
  pressed?: boolean;
};

function useActions(openTravel: () => void, travelOpen: boolean, openEmotes: () => void, emotesOpen: boolean): Action[] {
  const { resolvedTheme, setTheme } = useTheme();
  const isLight = resolvedTheme === "light";
  const quality = useGame((s) => s.quality);
  const setQuality = useGame((s) => s.setQuality);
  const muted = useGame((s) => s.muted);
  const music = useMusicPref();
  const toggleMuted = useGame((s) => s.toggleMuted);
  const setHelp = useGame((s) => s.setHelpOpen);
  const setSettings = useGame((s) => s.setSettingsOpen);

  return [
    { id: "travel", label: "Fast travel", icon: <MapIcon size={14} />, onClick: openTravel, pressed: travelOpen },
    { id: "emote", label: "Gestures", icon: <Hand size={14} />, aria: "Avatar gestures", onClick: openEmotes, pressed: emotesOpen },
    { id: "theme", label: isLight ? "Night" : "Day", icon: isLight ? <Moon size={14} /> : <Sun size={14} />, aria: isLight ? "Switch to night mode" : "Switch to day mode", onClick: () => setTheme(isLight ? "dark" : "light") },
    { id: "sound", label: muted ? "Sound off" : "Sound on", icon: muted ? <VolumeX size={14} /> : <Volume2 size={14} />, aria: muted ? "Turn sound on" : "Turn sound off", onClick: toggleMuted },
    { id: "music", label: music.on ? (MUSIC_TRACKS.find((t) => t.id === music.track)?.label ?? "Music on") : "Music off", icon: <Music size={14} />, aria: music.on ? "Change music style or turn it off" : "Turn music on", onClick: () => { initAudio(); cycleMusic(); } },
    { id: "quality", label: quality === "high" ? "High" : "Low", icon: <Zap size={14} />, aria: `Graphics quality: ${quality}. Activate to change.`, onClick: () => setQuality(quality === "high" ? "low" : "high") },
    { id: "settings", label: "Settings", icon: <Settings size={14} />, aria: "Accessibility and privacy settings", onClick: () => setSettings(true) },
    { id: "help", label: "Help", icon: <CircleHelp size={14} />, aria: "How to play", onClick: () => setHelp(true) },
    { id: "tour", label: "Scroll tour", icon: <Compass size={14} />, href: "/tour" },
    { id: "recruiter", label: "Recruiter mode", icon: <ArrowLeft size={14} />, href: "/" },
  ];
}

function StatsCard() {
  const xp = useGame((s) => s.xp);
  const visited = useGame((s) => Object.keys(s.visited).length);
  const collected = useGame((s) => Object.keys(s.skills).length);
  const level = levelFromXp(xp);
  const pct = (xpIntoLevel(xp) / XP_PER_LEVEL) * 100;
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onDown = (e: PointerEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onDown);
    };
  }, [open]);

  return (
    <div ref={wrap} className="pointer-events-auto relative">
      <div className={`rounded-2xl px-4 py-3 ${glass}`}>
        <div className="flex items-center justify-between gap-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-cyan-300/80">Farrukh · Dev Hub</p>
          <button
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label="Player card: resume and links"
            className="flex items-center gap-1 rounded-full border border-cyan-300/30 bg-cyan-400/10 px-2 py-0.5 text-[10px] font-semibold text-cyan-200 transition hover:bg-cyan-400/20 focus-visible:outline-2 focus-visible:outline-cyan-300"
          >
            <UserRound size={11} /> Card
            <ChevronDown size={11} className={`transition-transform duration-300 ${open ? "rotate-180" : ""}`} />
          </button>
        </div>
        <div className="mt-1.5 flex items-center gap-3">
          <span className="shrink-0 whitespace-nowrap rounded-md bg-cyan-400/15 px-2 py-0.5 text-xs font-bold text-cyan-300">LV {level}</span>
          <div className="h-2 w-20 overflow-hidden rounded-full bg-white/10 sm:w-40" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label={`Experience, level ${level}`}>
            <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-violet-500 transition-all duration-500" style={{ width: `${pct}%` }} />
          </div>
          <span className="shrink-0 whitespace-nowrap text-xs text-slate-400">{xp} XP</span>
        </div>
        <p className="mt-1 text-[11px] text-slate-500">{visited}/{ZONES.length} zones · {collected}/{TOTAL_SKILLS} skills</p>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            key="player-card"
            initial={{ opacity: 0, y: -10, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 380, damping: 28 }}
            style={{ transformOrigin: "top left" }}
            className="absolute left-0 top-full z-20 mt-2 w-[min(21rem,calc(100vw-1.5rem))]"
          >
            <PlayerCard compact />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ActionButton({ a, onDone }: { a: Action; onDone?: () => void }) {
  const inner = <>{a.icon} {a.label}</>;
  if (a.href) {
    return <ModeLink href={a.href} className={btn}>{inner}</ModeLink>;
  }
  return (
    <button
      onClick={() => {
        a.onClick?.();
        onDone?.();
      }}
      aria-label={a.aria}
      aria-expanded={a.id === "travel" || a.id === "emote" ? a.pressed : undefined}
      className={btn}
    >
      {inner}
    </button>
  );
}

function FastTravel({ onClose }: { onClose: () => void }) {
  const visited = useGame((s) => s.visited);
  return (
    <div role="menu" aria-label="Fast travel" className={`pointer-events-auto absolute right-3 top-[4.75rem] z-20 w-60 rounded-2xl p-2 sm:right-5 sm:top-[5.75rem] ${glass}`}>
      <ul>
        {ZONES.map((z) => (
          <li key={z.id}>
            <button
              role="menuitem"
              onClick={() => {
                travelToZone(z.id);
                onClose();
              }}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm text-slate-200 transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-cyan-300"
            >
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: visited[z.id] ? z.color : "transparent", boxShadow: `0 0 0 1.5px ${z.color}` }} />
              {z.name}
              <span className="sr-only">{visited[z.id] ? " (visited)" : ""}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function GesturesMenu({ onClose }: { onClose: () => void }) {
  const playEmote = useGame((s) => s.playEmote);
  return (
    <div role="menu" aria-label="Avatar gestures" className={`pointer-events-auto absolute right-3 top-[4.75rem] z-20 w-56 rounded-2xl p-2 sm:right-5 sm:top-[5.75rem] ${glass}`}>
      <ul>
        {EMOTES.map((e) => (
          <li key={e.id}>
            <button
              role="menuitem"
              onClick={() => {
                playEmote(e.id);
                track("emote", e.id);
                onClose();
              }}
              className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm text-slate-200 transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-cyan-300"
            >
              {e.label}
              <kbd className="rounded-md border border-white/20 bg-white/10 px-2 py-0.5 font-mono text-xs">{e.key}</kbd>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TopBar({ travelOpen, setTravelOpen, emotesOpen, setEmotesOpen }: { travelOpen: boolean; setTravelOpen: (v: boolean) => void; emotesOpen: boolean; setEmotesOpen: (v: boolean) => void }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const actions = useActions(
    () => {
      setMenuOpen(false);
      setEmotesOpen(false);
      setTravelOpen(!travelOpen);
    },
    travelOpen,
    () => {
      setMenuOpen(false);
      setTravelOpen(false);
      setEmotesOpen(!emotesOpen);
    },
    emotesOpen,
  );

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:p-5">
      <StatsCard />

      {/* desktop / tablet: all actions in a row */}
      <div className="pointer-events-auto hidden flex-wrap justify-end gap-2 sm:flex">
        {actions.map((a) => <ActionButton key={a.id} a={a} />)}
      </div>

      {/* phone: one Menu button + sheet */}
      <div className="pointer-events-auto sm:hidden">
        <button onClick={() => { setTravelOpen(false); setMenuOpen((v) => !v); }} aria-expanded={menuOpen} aria-label={menuOpen ? "Close menu" : "Open menu"} className={`${btn} px-3.5 py-3`}>
          {menuOpen ? <X size={16} /> : <Menu size={16} />}
        </button>
        {menuOpen && (
          <div className={`absolute right-3 top-[4.5rem] z-20 flex w-52 flex-col gap-1.5 rounded-2xl p-2 ${glass}`}>
            {actions.map((a) => (
              <ActionButton key={a.id} a={a} onDone={a.id === "travel" || a.id === "emote" ? undefined : () => setMenuOpen(false)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function InteractPrompt() {
  const active = useGame((s) => s.activeZone);
  const panel = useGame((s) => s.openPanel);
  const interact = useGame((s) => s.interact);
  if (!active || panel) return null;
  const zone = ZONES.find((z) => z.id === active)!;
  return (
    <button
      onClick={interact}
      className={`pointer-events-auto absolute bottom-[max(2rem,env(safe-area-inset-bottom))] left-1/2 flex -translate-x-1/2 items-center gap-3 rounded-2xl px-5 py-3 text-sm text-white transition focus-visible:outline-2 focus-visible:outline-cyan-300 ${glass}`}
      style={{ boxShadow: `0 0 30px ${zone.color}44`, borderColor: `${zone.color}77` }}
    >
      <kbd className="hidden rounded-md border border-white/20 bg-white/10 px-2 py-0.5 font-mono text-xs sm:inline">E</kbd>
      <span>
        <span className="text-slate-400">Open </span>
        <strong>{zone.name}</strong>
      </span>
    </button>
  );
}

function XpToast() {
  const gain = useGame((s) => s.lastGain);
  const [dismissed, setDismissed] = useState<number | null>(null);

  useEffect(() => {
    if (!gain) return;
    const t = setTimeout(() => setDismissed(gain.at), 2600);
    return () => clearTimeout(t);
  }, [gain]);

  if (!gain || dismissed === gain.at) return null;
  const big = gain.kind === "achievement";
  return (
    <div aria-hidden className={`pointer-events-none absolute left-1/2 top-24 max-w-[92vw] -translate-x-1/2 rounded-full px-4 py-2 text-center text-sm ${big ? "text-amber-100 ring-2 ring-amber-300/60" : "text-amber-200"} ${glass}`}>
      <Sparkles size={14} className="mr-2 inline text-amber-300" />
      +{gain.amount} XP · {gain.label}
    </div>
  );
}

export default function Hud() {
  const [travelOpen, setTravelOpen] = useState(false);
  const [emotesOpen, setEmotesOpen] = useState(false);

  return (
    <div className="pointer-events-none absolute inset-0 z-10 select-none">
      <Announcer />
      <TopBar travelOpen={travelOpen} setTravelOpen={setTravelOpen} emotesOpen={emotesOpen} setEmotesOpen={setEmotesOpen} />
      {travelOpen && <FastTravel onClose={() => setTravelOpen(false)} />}
      {emotesOpen && <GesturesMenu onClose={() => setEmotesOpen(false)} />}
      <XpToast />
      <InteractPrompt />
      <IntroTip />

      <div className="pointer-events-auto absolute bottom-[max(1.5rem,env(safe-area-inset-bottom))] right-4 sm:right-6">
        <Minimap />
      </div>

      <div className={`absolute bottom-6 left-6 hidden items-center gap-3 rounded-xl px-4 py-2.5 text-xs text-slate-400 md:flex ${glass}`}>
        <Gamepad2 size={14} className="text-cyan-300" />
        <span><b className="text-slate-200">WASD</b> / arrows move</span>
        <span><b className="text-slate-200">Shift</b> run</span>
        <span><b className="text-slate-200">E</b> interact</span>
        <span><b className="text-slate-200">1-4</b> gestures</span>
        <span><b className="text-slate-200">H</b> help</span>
      </div>

      <div className="pointer-events-auto"><Joystick /></div>
      <div className="pointer-events-auto"><ZonePanel /></div>
      <div className="pointer-events-auto"><HelpDialog /></div>
      <div className="pointer-events-auto"><SettingsDialog /></div>
    </div>
  );
}
