import { skills } from "@/components/Skills/skillsData";
import { XP_PER_LEVEL, ZONES, ZoneId } from "./zones";

export const TOTAL_SKILLS = skills.length;
export const TOTAL_ZONES = ZONES.length;

export interface ProgressSnapshot {
  xp: number;
  visited: Partial<Record<ZoneId, boolean>>;
  skills: Record<string, boolean>;
  opened: Partial<Record<ZoneId, boolean>>;
  sent: boolean;
}

export interface Achievement {
  id: string;
  title: string;
  hint: string;
  reward: number;
  check: (p: ProgressSnapshot) => boolean;
}

const count = (o: Record<string, unknown>) => Object.keys(o).length;

export const ACHIEVEMENTS: Achievement[] = [
  { id: "first-steps", title: "First Steps", hint: "Discover your first zone", reward: 50, check: (p) => count(p.visited) >= 1 },
  { id: "explorer", title: "Explorer", hint: "Discover every zone on the island", reward: 150, check: (p) => count(p.visited) >= TOTAL_ZONES },
  { id: "curious", title: "Curious Mind", hint: "Open 5 different zone panels", reward: 75, check: (p) => count(p.opened) >= 5 },
  { id: "collector", title: "Collector", hint: "Collect 10 skill orbs", reward: 75, check: (p) => count(p.skills) >= 10 },
  { id: "skill-master", title: "Skill Master", hint: `Collect all ${TOTAL_SKILLS} skill orbs`, reward: 250, check: (p) => count(p.skills) >= TOTAL_SKILLS },
  { id: "pen-pal", title: "Pen Pal", hint: "Send Farrukh a message from the Comms Tower", reward: 100, check: (p) => p.sent },
  { id: "rising-star", title: "Rising Star", hint: "Reach level 4", reward: 100, check: (p) => Math.floor(p.xp / XP_PER_LEVEL) + 1 >= 4 },
];

/** Unlocks every achievement whose condition is now met (and cascades the XP they award). */
export function unlockAchievements(
  p: ProgressSnapshot,
  have: Record<string, boolean>,
): { xp: number; achievements: Record<string, boolean>; newly: Achievement[] } {
  let xp = p.xp;
  let achievements = have;
  const newly: Achievement[] = [];
  let changed = true;
  while (changed) {
    changed = false;
    for (const a of ACHIEVEMENTS) {
      if (!achievements[a.id] && a.check({ ...p, xp })) {
        achievements = { ...achievements, [a.id]: true };
        xp += a.reward;
        newly.push(a);
        changed = true;
      }
    }
  }
  return { xp, achievements, newly };
}
