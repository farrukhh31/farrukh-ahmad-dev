"use client";

import { useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import ModeLink from "@/components/PlayCTA/ModeLink";
import { ArrowLeft, Check, ChevronDown, CircleHelp, Compass, Hand, Map as MapIcon, MapPin, Menu, Moon, Music, Settings, Sparkles, Sun, Volume2, VolumeX, X, Zap } from "lucide-react";
import { useTheme } from "next-themes";
import { useMounted } from "@/hooks/useMounted";
import { useMediaQuery } from "@/hooks/useMediaQuery";

import { levelFromXp, useGame, xpIntoLevel } from "@/lib/game/store";
import { travelToZone } from "@/lib/game/travel";
import { TOTAL_SKILLS } from "@/lib/game/achievements";
import { XP_PER_LEVEL, ZONES, type Zone } from "@/lib/game/zones";
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

const accent = (color: string) => ({ ["--pm-accent" as string]: color }) as React.CSSProperties;

/** Closes a popover on Escape or on a press outside it (presses on the dock are left to the dock's own buttons). */
function useDismiss(open: boolean, onClose: () => void, ref: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const onDown = (e: PointerEvent) => {
      const t = e.target as HTMLElement | null;
      if (ref.current?.contains(t)) return;
      if (t?.closest("[data-hud-toggle]")) return;
      onClose();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onDown);
    };
  }, [open, onClose, ref]);
}

/* ------------------------------ actions ------------------------------ */

type Action = {
  id: string;
  label: string;
  icon: React.ReactNode;
  aria?: string;
  onClick?: () => void;
  href?: string;
  pressed?: boolean;
  toggle?: boolean;
};

function useActions(openTravel: () => void, travelOpen: boolean, openEmotes: () => void, emotesOpen: boolean): Record<string, Action> {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useMounted();
  const isLight = mounted && resolvedTheme === "light";
  const quality = useGame((s) => s.quality);
  const setQuality = useGame((s) => s.setQuality);
  const muted = useGame((s) => s.muted);
  const music = useMusicPref();
  const toggleMuted = useGame((s) => s.toggleMuted);
  const setHelp = useGame((s) => s.setHelpOpen);
  const setSettings = useGame((s) => s.setSettingsOpen);
  const sz = 18;

  const list: Action[] = [
    { id: "travel", label: "Fast travel", icon: <MapIcon size={sz} />, onClick: openTravel, pressed: travelOpen, toggle: true },
    { id: "emote", label: "Gestures", icon: <Hand size={sz} />, aria: "Avatar gestures", onClick: openEmotes, pressed: emotesOpen, toggle: true },
    { id: "theme", label: isLight ? "Night mode" : "Day mode", icon: isLight ? <Moon size={sz} /> : <Sun size={sz} />, aria: isLight ? "Switch to night mode" : "Switch to day mode", onClick: () => setTheme(isLight ? "dark" : "light") },
    { id: "sound", label: muted ? "Sound off" : "Sound on", icon: muted ? <VolumeX size={sz} /> : <Volume2 size={sz} />, aria: muted ? "Turn sound on" : "Turn sound off", onClick: toggleMuted },
    { id: "music", label: music.on ? (MUSIC_TRACKS.find((t) => t.id === music.track)?.label ?? "Music on") : "Music off", icon: <Music size={sz} />, aria: music.on ? "Change music style or turn it off" : "Turn music on", onClick: () => { initAudio(); cycleMusic(); } },
    { id: "quality", label: quality === "high" ? "High graphics" : "Low graphics", icon: <Zap size={sz} />, aria: `Graphics quality: ${quality}. Activate to change.`, onClick: () => setQuality(quality === "high" ? "low" : "high") },
    { id: "settings", label: "Settings", icon: <Settings size={sz} />, aria: "Accessibility and privacy settings", onClick: () => setSettings(true) },
    { id: "help", label: "Help", icon: <CircleHelp size={sz} />, aria: "How to play", onClick: () => setHelp(true) },
    { id: "tour", label: "Scroll tour", icon: <Compass size={sz} />, href: "/tour" },
    { id: "recruiter", label: "Recruiter mode", icon: <ArrowLeft size={sz} />, href: "/" },
  ];
  return Object.fromEntries(list.map((a) => [a.id, a]));
}

const GROUPS: string[][] = [["travel", "emote"], ["theme", "sound", "music"], ["quality", "settings", "help"], ["tour", "recruiter"]];
/** These show their label next to the icon once there is room for it. */
const LABELLED_XL = new Set(["travel", "emote"]);
const LABELLED_2XL = new Set(["tour", "recruiter"]);

function DockButton({ a }: { a: Action }) {
  const labelClass = LABELLED_XL.has(a.id) ? "hidden xl:inline" : LABELLED_2XL.has(a.id) ? "hidden 2xl:inline" : "sr-only";
  const inner = (
    <>
      {a.icon}
      <span className={labelClass}>{a.label}</span>
    </>
  );
  const tip = a.label;
  if (a.href) {
    return (
      <ModeLink href={a.href} className="pm-btn" data-tip={tip}>
        {inner}
      </ModeLink>
    );
  }
  return (
    <button
      onClick={a.onClick}
      aria-label={a.aria ?? a.label}
      aria-expanded={a.toggle ? a.pressed : undefined}
      data-hud-toggle={a.toggle ? "" : undefined}
      data-tip={tip}
      className="pm-btn"
    >
      {inner}
    </button>
  );
}

/* ------------------------------ profile ------------------------------ */

function LevelRing({ level, pct, size = 62 }: { level: number; pct: number; size?: number }) {
  const gid = useId();
  const stroke = 5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const shown = Math.max(0.04, Math.min(1, pct / 100));
  return (
    <div className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }} role="img" aria-label={`Level ${level}, ${Math.round(pct)} percent to the next level`}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#22d3ee" />
            <stop offset="1" stopColor="#8b5cf6" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--pm-raise-hover)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`url(#${gid})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - shown)}
          style={{ transition: "stroke-dashoffset 0.7s cubic-bezier(0.2,0.8,0.2,1)" }}
        />
      </svg>
      <span className="absolute text-center leading-none">
        <span className="pm-muted block text-[10px] font-medium">Level</span>
        <span className="pm-ink block text-xl font-bold tabular-nums">{level}</span>
      </span>
    </div>
  );
}

function ProfilePanel() {
  const xp = useGame((s) => s.xp);
  const visited = useGame((s) => Object.keys(s.visited).length);
  const collected = useGame((s) => Object.keys(s.skills).length);
  const level = levelFromXp(xp);
  const into = xpIntoLevel(xp);
  const pct = (into / XP_PER_LEVEL) * 100;
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  useDismiss(open, () => setOpen(false), wrap);

  return (
    <div ref={wrap} className="pointer-events-auto relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="Player card: resume and links"
        className="pm-panel group flex w-[min(19.5rem,calc(100vw-5.75rem))] items-center gap-3.5 rounded-[24px] p-3.5 pr-4 text-left transition duration-200 hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 sm:w-[19.5rem]"
      >
        <LevelRing level={level} pct={pct} />
        <span className="min-w-0 flex-1">
          <span className="pm-ink block truncate text-[15px] font-semibold leading-tight">Farrukh Ahmad</span>
          <span className="pm-muted mt-0.5 block text-xs">{into} of {XP_PER_LEVEL} XP to level {level + 1}</span>
          <span className="pm-meter mt-2 block" aria-hidden>
            <span style={{ width: `${Math.max(4, pct)}%` }} />
          </span>
          <span className="pm-muted mt-2 flex gap-4 text-[11px]">
            <span><b className="pm-ink tabular-nums">{visited}</b>/{ZONES.length} zones</span>
            <span><b className="pm-ink tabular-nums">{collected}</b>/{TOTAL_SKILLS} skills</span>
          </span>
        </span>
        <span className="pm-btn is-icon shrink-0" aria-hidden>
          <ChevronDown size={18} className={`transition-transform duration-300 ${open ? "rotate-180" : ""}`} />
        </span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            key="player-card"
            initial={{ opacity: 0, y: -10, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 380, damping: 28 }}
            style={{ transformOrigin: "top left" }}
            className="absolute left-0 top-full z-20 mt-2 w-[min(26rem,calc(100vw-1.5rem))]"
          >
            <PlayerCard compact />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ------------------------------ journey ------------------------------ */

function JourneyPanel() {
  const visited = useGame((s) => s.visited);
  const active = useGame((s) => s.activeZone);
  const collected = useGame((s) => Object.keys(s.skills).length);
  const [collapsed, setCollapsed] = useState(false);
  const found = ZONES.filter((z) => visited[z.id]).length;
  const next: Zone | undefined = ZONES.find((z) => !visited[z.id] && z.id !== active);
  const done = found === ZONES.length;

  return (
    <section aria-label="Journey" className="pm-panel pointer-events-auto w-[19.5rem] rounded-[24px] p-4">
      <button
        onClick={() => setCollapsed((v) => !v)}
        aria-expanded={!collapsed}
        className="flex w-full items-center justify-between gap-3 rounded-lg text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-300"
      >
        <span>
          <span className="pm-ink block text-sm font-semibold">Journey</span>
          <span className="pm-muted block text-xs">{found} of {ZONES.length} zones found</span>
        </span>
        <ChevronDown size={16} className={`pm-muted transition-transform duration-300 ${collapsed ? "" : "rotate-180"}`} />
      </button>

      <div className="mt-3 flex gap-1" aria-hidden>
        {ZONES.map((z) => (
          <span key={z.id} className="h-1.5 flex-1 rounded-full transition-colors duration-500" style={{ background: visited[z.id] ? z.color : "var(--pm-raise-hover)" }} />
        ))}
      </div>

      {!collapsed && (
        <div className="pm-rise mt-3">
          {next ? (
            <div className="flex items-center gap-3 rounded-2xl p-2.5" style={{ background: `${next.color}14` }}>
              <span className="pm-beacon grid h-10 w-10 shrink-0 place-items-center rounded-xl" style={{ ...accent(next.color), background: `${next.color}2b`, color: next.color }}>
                <MapPin size={18} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="pm-muted block text-[11px]">Next stop</span>
                <span className="pm-ink block truncate text-sm font-semibold">{next.name}</span>
              </span>
              <button onClick={() => travelToZone(next.id)} className="pm-btn" style={accent(next.color)} aria-label={`Travel to ${next.name}`}>
                Go
              </button>
            </div>
          ) : (
            <p className="pm-muted rounded-2xl p-2.5 text-xs leading-relaxed" style={{ background: "var(--pm-raise)" }}>
              {done ? "Every zone found." : "You are standing in the last zone."}{" "}
              {collected < TOTAL_SKILLS ? `${TOTAL_SKILLS - collected} skill orbs left to collect in the Skill Grove.` : "All skill orbs collected."}
            </p>
          )}
        </div>
      )}
    </section>
  );
}

/* ------------------------------ popovers ------------------------------ */

function PopoverShell({ title, subtitle, onClose, children, width = "26rem" }: { title: string; subtitle?: string; onClose: () => void; children: React.ReactNode; width?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(true, onClose, ref);
  return (
    <motion.div
      ref={ref}
      role="group"
      aria-label={title}
      initial={{ opacity: 0, y: -8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -6, scale: 0.98 }}
      transition={{ type: "spring", stiffness: 420, damping: 30 }}
      style={{ transformOrigin: "top right", width: `min(${width}, calc(100vw - 1.5rem))` }}
      className="pm-panel pointer-events-auto absolute right-3 top-[5.25rem] z-20 max-h-[calc(100dvh-7rem)] overflow-y-auto rounded-[26px] p-4 sm:right-5 sm:top-[6.5rem]"
    >
      <div className="mb-3 flex items-start justify-between gap-3 px-1">
        <div>
          <h2 className="pm-ink text-base font-semibold">{title}</h2>
          {subtitle && <p className="pm-muted mt-0.5 text-xs">{subtitle}</p>}
        </div>
        <button onClick={onClose} aria-label={`Close ${title.toLowerCase()}`} className="pm-btn is-icon -mr-1 -mt-1">
          <X size={18} />
        </button>
      </div>
      {children}
    </motion.div>
  );
}

function FastTravel({ onClose }: { onClose: () => void }) {
  const visited = useGame((s) => s.visited);
  const active = useGame((s) => s.activeZone);
  const found = ZONES.filter((z) => visited[z.id]).length;
  return (
    <PopoverShell title="Fast travel" subtitle={`${found} of ${ZONES.length} places discovered`} onClose={onClose} width="28rem">
      <ul className="grid gap-2 sm:grid-cols-2">
        {ZONES.map((z) => {
          const here = active === z.id;
          const seen = !!visited[z.id];
          return (
            <li key={z.id}>
              <button
                onClick={() => {
                  travelToZone(z.id);
                  onClose();
                }}
                aria-current={here}
                style={accent(z.color)}
                className="pm-tile"
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl" style={{ background: `${z.color}2b`, color: z.color }}>
                  {seen ? <Check size={18} /> : <MapPin size={18} />}
                </span>
                <span className="min-w-0">
                  <span className="pm-ink block truncate text-sm font-semibold">{z.name}</span>
                  <span className="pm-muted block truncate text-xs">{here ? "You are here" : seen ? z.tagline : "Not discovered yet"}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </PopoverShell>
  );
}

function GesturesMenu({ onClose }: { onClose: () => void }) {
  const playEmote = useGame((s) => s.playEmote);
  return (
    <PopoverShell title="Gestures" subtitle="Make your avatar react" onClose={onClose} width="22rem">
      <ul className="grid grid-cols-2 gap-2">
        {EMOTES.map((e) => (
          <li key={e.id}>
            <button
              onClick={() => {
                playEmote(e.id);
                track("emote", e.id);
                onClose();
              }}
              className="pm-tile !min-h-[72px] flex-col !items-start !justify-between !gap-2"
            >
              <span className="pm-key">{e.key}</span>
              <span className="pm-ink text-sm font-semibold">{e.label}</span>
            </button>
          </li>
        ))}
      </ul>
    </PopoverShell>
  );
}

/* ------------------------------ top bar ------------------------------ */

function TopBar({ travelOpen, setTravelOpen, emotesOpen, setEmotesOpen }: { travelOpen: boolean; setTravelOpen: (v: boolean) => void; emotesOpen: boolean; setEmotesOpen: (v: boolean) => void }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const roomForJourney = useMediaQuery("(min-width: 1024px) and (min-height: 720px)");
  const sheet = useRef<HTMLDivElement>(null);
  useDismiss(menuOpen, () => setMenuOpen(false), sheet);

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
      <div className="flex flex-col gap-3">
        <ProfilePanel />
        {roomForJourney && <JourneyPanel />}
      </div>

      {/* wide screens: one dock with every action, grouped */}
      <nav aria-label="Game controls" className="pm-panel pointer-events-auto hidden items-center gap-1 rounded-[24px] p-1.5 lg:flex">
        {GROUPS.map((ids, gi) => (
          <div key={gi} className="flex items-center gap-1">
            {gi > 0 && <span className="pm-divider" aria-hidden />}
            {ids.map((id) => (
              <DockButton key={id} a={actions[id]} />
            ))}
          </div>
        ))}
      </nav>

      {/* tablets and phones: one menu button that opens a sheet of large tiles */}
      <div ref={sheet} className="pointer-events-auto relative lg:hidden">
        <button
          onClick={() => {
            setTravelOpen(false);
            setEmotesOpen(false);
            setMenuOpen((v) => !v);
          }}
          aria-expanded={menuOpen}
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          data-hud-toggle=""
          className="pm-panel grid h-[58px] w-[58px] place-items-center rounded-[22px] transition active:scale-95"
        >
          {menuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
        <AnimatePresence>
          {menuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.98 }}
              transition={{ type: "spring", stiffness: 420, damping: 30 }}
              style={{ transformOrigin: "top right" }}
              className="pm-panel absolute right-0 top-[4.4rem] z-20 max-h-[calc(100dvh-7rem)] w-[min(21rem,calc(100vw-1.5rem))] overflow-y-auto rounded-[26px] p-2"
            >
              <ul className="grid grid-cols-2 gap-1.5">
                {GROUPS.flat().map((id) => {
                  const a = actions[id];
                  const body = (
                    <>
                      <span className="pm-muted">{a.icon}</span>
                      <span className="pm-ink min-w-0 truncate text-[13px] font-semibold">{a.label}</span>
                    </>
                  );
                  return (
                    <li key={id}>
                      {a.href ? (
                        <ModeLink href={a.href} className="pm-tile min-h-[56px]">
                          {body}
                        </ModeLink>
                      ) : (
                        <button
                          onClick={() => {
                            a.onClick?.();
                            if (!a.toggle) setMenuOpen(false);
                          }}
                          aria-label={a.aria ?? a.label}
                          className="pm-tile min-h-[56px]"
                        >
                          {body}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ------------------------------ prompts and toasts ------------------------------ */

function InteractPrompt() {
  const active = useGame((s) => s.activeZone);
  const panel = useGame((s) => s.openPanel);
  const interact = useGame((s) => s.interact);
  if (!active || panel) return null;
  const zone = ZONES.find((z) => z.id === active)!;
  return (
    <div key={zone.id} className="pm-rise pointer-events-none absolute inset-x-0 bottom-[max(11rem,env(safe-area-inset-bottom))] flex justify-center px-3 lg:bottom-5">
      <div
        className="pm-panel pointer-events-auto flex w-[min(32rem,100%)] items-center gap-3.5 rounded-[28px] p-3 pl-3.5"
        style={{ ...accent(zone.color), boxShadow: `var(--pm-shadow), 0 0 44px -10px ${zone.color}88` }}
      >
        <span className="grid h-[52px] w-[52px] shrink-0 place-items-center rounded-2xl" style={{ background: `${zone.color}2b`, color: zone.color }}>
          <MapPin size={22} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="pm-ink block truncate text-base font-semibold leading-tight">{zone.name}</span>
          <span className="pm-muted block truncate text-xs">{zone.tagline}</span>
        </span>
        <button onClick={interact} className="pm-cta shrink-0" aria-label={`Open ${zone.name}`}>
          Enter
          <span className="hidden rounded-lg bg-black/15 px-2 py-0.5 font-mono text-xs sm:inline">E</span>
        </button>
      </div>
    </div>
  );
}

function XpToast() {
  const gain = useGame((s) => s.lastGain);
  const [dismissed, setDismissed] = useState<number | null>(null);

  useEffect(() => {
    if (!gain) return;
    const t = setTimeout(() => setDismissed(gain.at), 3000);
    return () => clearTimeout(t);
  }, [gain]);

  if (!gain || dismissed === gain.at) return null;
  const big = gain.kind === "achievement";
  return (
    <div key={gain.at} aria-hidden className="pm-rise pointer-events-none absolute bottom-[16.5rem] left-1/2 lg:bottom-[7.75rem] max-w-[92vw] -translate-x-1/2">
      <div className="pm-panel flex items-center gap-3 rounded-2xl py-2 pl-2 pr-5" style={big ? { boxShadow: "var(--pm-shadow), 0 0 0 2px rgba(251,191,36,0.55)" } : undefined}>
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-400/25 text-amber-500">
          <Sparkles size={18} />
        </span>
        <span>
          <b className="pm-ink block text-sm tabular-nums">+{gain.amount} XP</b>
          <span className="pm-muted block text-xs">{gain.label}</span>
        </span>
      </div>
    </div>
  );
}

function ControlsBar() {
  const atZone = useGame((s) => s.activeZone !== null);
  const items: [string[], string][] = [
    [["W", "A", "S", "D"], "Move"],
    [["Shift"], "Run"],
    [["E"], "Interact"],
    [["1", "2", "3", "4"], "Gestures"],
    [["H"], "Help"],
  ];
  if (atZone) return null; // the Enter card takes this spot while you stand in a zone
  return (
    <div className="pm-panel absolute bottom-6 left-6 hidden items-center gap-5 rounded-[22px] px-4 py-2.5 xl:flex">
      {items.map(([keys, label]) => (
        <span key={label} className="flex items-center gap-2">
          <span className="flex gap-1">
            {keys.map((k) => (
              <kbd key={k} className="pm-key">{k}</kbd>
            ))}
          </span>
          <span className="pm-muted text-xs font-medium">{label}</span>
        </span>
      ))}
    </div>
  );
}

function MapPanel() {
  const found = useGame((s) => Object.keys(s.visited).length);
  const compact = useMediaQuery("(max-width: 639px)");
  return (
    <div className="pm-panel rounded-[26px] p-2.5">
      <Minimap size={compact ? 118 : 156} />
      <p className="pm-muted mt-2 px-1 text-center text-[11px] font-medium">
        <b className="pm-ink tabular-nums">{found}</b> of {ZONES.length} discovered
      </p>
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
      <AnimatePresence>
        {travelOpen && <FastTravel key="travel" onClose={() => setTravelOpen(false)} />}
        {emotesOpen && <GesturesMenu key="emotes" onClose={() => setEmotesOpen(false)} />}
      </AnimatePresence>
      <XpToast />
      <InteractPrompt />
      <IntroTip />

      <div className="pointer-events-auto absolute bottom-[max(1.25rem,env(safe-area-inset-bottom))] right-3 sm:right-6">
        <MapPanel />
      </div>

      <ControlsBar />

      <div className="pointer-events-auto"><Joystick /></div>
      <div className="pointer-events-auto"><ZonePanel /></div>
      <div className="pointer-events-auto"><HelpDialog /></div>
      <div className="pointer-events-auto"><SettingsDialog /></div>
    </div>
  );
}
