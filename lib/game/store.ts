"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { unlockAchievements } from "./achievements";
import type { EmoteName } from "./gestures";
import { XP_PER_LEVEL, XP_PER_ZONE, ZONE_BY_ID, ZoneId } from "./zones";

export type Quality = "low" | "high";
export type MotionPref = "system" | "reduce";
export type GainKind = "zone" | "skill" | "achievement" | "message";

export interface Gain {
  kind: GainKind;
  label: string;
  amount: number;
  at: number;
}

export const XP_PER_SKILL = 10;

interface GameState {
  xp: number;
  visited: Partial<Record<ZoneId, boolean>>;
  /** collected skill orbs by skill id */
  skills: Record<string, boolean>;
  opened: Partial<Record<ZoneId, boolean>>;
  achievements: Record<string, boolean>;
  messageSent: boolean;
  seenIntro: boolean;
  helpOpen: boolean;
  settingsOpen: boolean;
  /** accessibility preferences (saved on this device) */
  motionPref: MotionPref;
  highContrast: boolean;
  largeText: boolean;
  /** last gesture requested; the avatar reacts when `at` changes */
  emote: { name: EmoteName; at: number } | null;

  activeZone: ZoneId | null;
  openPanel: ZoneId | null;
  quality: Quality;
  muted: boolean;
  interactTick: number;
  lastGain: Gain | null;

  setActiveZone: (id: ZoneId | null) => void;
  visitZone: (id: ZoneId) => void;
  collectSkill: (id: string, name: string) => void;
  markMessageSent: () => void;
  openZonePanel: (id: ZoneId | null) => void;
  dismissIntro: () => void;
  setHelpOpen: (open: boolean) => void;
  setSettingsOpen: (open: boolean) => void;
  setMotionPref: (p: MotionPref) => void;
  setHighContrast: (v: boolean) => void;
  setLargeText: (v: boolean) => void;
  playEmote: (name: EmoteName) => void;
  interact: () => void;
  setQuality: (q: Quality) => void;
  toggleMuted: () => void;
  resetProgress: () => void;
}

export const useGame = create<GameState>()(
  persist(
    (set, get) => {
      /** Apply a progress change, then cascade any achievements it unlocks. */
      const commit = (
        patch: Partial<Pick<GameState, "xp" | "visited" | "skills" | "opened" | "messageSent">>,
        gain: Gain | null,
      ) => {
        const s = get();
        const next = {
          xp: patch.xp ?? s.xp,
          visited: patch.visited ?? s.visited,
          skills: patch.skills ?? s.skills,
          opened: patch.opened ?? s.opened,
          messageSent: patch.messageSent ?? s.messageSent,
        };
        const result = unlockAchievements({ ...next, sent: next.messageSent }, s.achievements);
        const last = result.newly.at(-1);
        set({
          ...next,
          xp: result.xp,
          achievements: result.achievements,
          lastGain: last
            ? {
                kind: "achievement",
                label: `Achievement unlocked: ${last.title}`,
                amount: last.reward,
                at: Date.now(),
              }
            : (gain ?? s.lastGain),
        });
      };

      return {
        xp: 0,
        visited: {},
        skills: {},
        opened: {},
        achievements: {},
        messageSent: false,
        seenIntro: false,
        helpOpen: false,
        settingsOpen: false,
        motionPref: "system",
        highContrast: false,
        largeText: false,
        emote: null,
        activeZone: null,
        openPanel: null,
        quality: "high",
        muted: false,
        interactTick: 0,
        lastGain: null,

        setActiveZone: (id) => set({ activeZone: id }),

        visitZone: (id) => {
          const s = get();
          if (s.visited[id]) return;
          commit(
            { visited: { ...s.visited, [id]: true }, xp: s.xp + XP_PER_ZONE },
            {
              kind: "zone",
              label: `${ZONE_BY_ID[id].name} discovered`,
              amount: XP_PER_ZONE,
              at: Date.now(),
            },
          );
        },

        collectSkill: (id, name) => {
          const s = get();
          if (s.skills[id]) return;
          commit(
            { skills: { ...s.skills, [id]: true }, xp: s.xp + XP_PER_SKILL },
            { kind: "skill", label: `${name} collected`, amount: XP_PER_SKILL, at: Date.now() },
          );
        },

        markMessageSent: () => {
          const s = get();
          commit(
            { messageSent: true, xp: s.xp + (s.messageSent ? 0 : 50) },
            s.messageSent ? null : { kind: "message", label: "Message sent to Farrukh", amount: 50, at: Date.now() },
          );
        },

        openZonePanel: (id) => {
          if (id === null) return set({ openPanel: null });
          const s = get();
          set({ openPanel: id });
          if (!s.opened[id]) commit({ opened: { ...s.opened, [id]: true } }, null);
        },

        dismissIntro: () => set({ seenIntro: true }),
        setHelpOpen: (helpOpen) => set({ helpOpen, seenIntro: true }),
        setSettingsOpen: (settingsOpen) => set({ settingsOpen, seenIntro: true }),
        setMotionPref: (motionPref) => set({ motionPref }),
        setHighContrast: (highContrast) => set({ highContrast }),
        setLargeText: (largeText) => set({ largeText }),
        playEmote: (name) => set({ emote: { name, at: Date.now() } }),
        interact: () => set((s) => ({ interactTick: s.interactTick + 1 })),
        setQuality: (quality) => set({ quality }),
        toggleMuted: () => set((s) => ({ muted: !s.muted })),
        resetProgress: () =>
          set({ xp: 0, visited: {}, skills: {}, opened: {}, achievements: {}, messageSent: false, seenIntro: false, lastGain: null }),
      };
    },
    {
      name: "farrukh-hub-progress",
      version: 5,
      partialize: (s) => ({
        xp: s.xp,
        visited: s.visited,
        skills: s.skills,
        opened: s.opened,
        achievements: s.achievements,
        messageSent: s.messageSent,
        seenIntro: s.seenIntro,
        quality: s.quality,
        muted: s.muted,
        motionPref: s.motionPref,
        highContrast: s.highContrast,
        largeText: s.largeText,
      }),
      // older saves (v0/v1) only had xp/visited; fill in the new fields
      migrate: (persisted) => {
        const p = (persisted ?? {}) as Record<string, unknown>;
        return { skills: {}, opened: {}, achievements: {}, messageSent: false, seenIntro: false, motionPref: "system", highContrast: false, largeText: false, ...p } as never;
      },
    },
  ),
);

export const levelFromXp = (xp: number) => Math.floor(xp / XP_PER_LEVEL) + 1;
export const xpIntoLevel = (xp: number) => xp % XP_PER_LEVEL;
