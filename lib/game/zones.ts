/**
 * Single source of truth for the playable world layout.
 * The world is an archipelago: the Plaza platform sits at the centre and the other
 * eight zones each get their own platform, spaced evenly on a ring around it in the
 * order a visitor would naturally read a portfolio. Platform sizes and the bridges
 * between them live in layout.ts.
 */

export type ZoneId =
  | "plaza"
  | "about"
  | "skills"
  | "projects"
  | "quest"
  | "trophy"
  | "cinema"
  | "oracle"
  | "resume"
  | "hire"
  | "comms";

export interface Zone {
  id: ZoneId;
  name: string;
  /** What this place is, in game terms. */
  tagline: string;
  /** What it maps to in the portfolio brief. */
  section: string;
  description: string;
  color: string;
  position: [number, number, number];
  /** Distance at which the zone "activates" (prompt + XP). */
  triggerRadius: number;
  /** Solid footprint of the building the player cannot walk through. */
  blockRadius: number;
}

export const ISLAND_RADIUS = 45;
export const RING_RADIUS = 36;
const RING_SLOTS = 10;
export const SPAWN: [number, number] = [0, 9];

const ring = (index: number): [number, number, number] => {
  const a = (index * Math.PI * 2) / RING_SLOTS;
  return [Math.sin(a) * RING_RADIUS, 0, -Math.cos(a) * RING_RADIUS];
};

export const ZONES: Zone[] = [
  {
    id: "plaza",
    name: "Spawn Plaza",
    tagline: "Welcome, player one",
    section: "Home",
    description:
      "Name, introduction and profile. Every run starts here — walk out along any glowing path to explore the rest of the hub.",
    color: "#22d3ee",
    position: [0, 0, 0],
    triggerRadius: 7,
    blockRadius: 2.2,
  },
  {
    id: "about",
    name: "Origin Tower",
    tagline: "The story so far",
    section: "About Me",
    description:
      "Background, interests and the journey from first line of code to Gaming & Animation at NED University.",
    color: "#8b5cf6",
    position: ring(0),
    triggerRadius: 7,
    blockRadius: 3.2,
  },
  {
    id: "skills",
    name: "Skill Grove",
    tagline: "Collect them all",
    section: "Skills & Technologies",
    description:
      "Languages, frameworks, engines and DevOps tools as floating orbs grouped by category.",
    color: "#34d399",
    position: ring(1),
    triggerRadius: 7,
    blockRadius: 2.6,
  },
  {
    id: "projects",
    name: "Arcade Hall",
    tagline: "Insert coin",
    section: "Projects Gallery",
    description:
      "One arcade cabinet per project, with gameplay footage on the screen and links to source.",
    color: "#f472b6",
    position: ring(2),
    triggerRadius: 8,
    blockRadius: 3.8,
  },
  {
    id: "quest",
    name: "Quest Road",
    tagline: "Checkpoints reached",
    section: "Education & Experience",
    description:
      "Internships and education laid out as checkpoints along a road, newest first.",
    color: "#fbbf24",
    position: ring(3),
    triggerRadius: 7,
    blockRadius: 3.0,
  },
  {
    id: "trophy",
    name: "Trophy Room",
    tagline: "Achievements unlocked",
    section: "Certificates & Achievements",
    description:
      "Certificates and achievements on display, with in-progress ones still locked.",
    color: "#f59e0b",
    position: ring(4),
    triggerRadius: 7,
    blockRadius: 3.2,
  },
  {
    id: "resume",
    name: "Resume Hangar",
    tagline: "Ready for takeoff",
    section: "Resume",
    description:
      "My resume as a PDF: download it, open it in a new tab, and see where I am working right now.",
    color: "#fb7185",
    position: ring(5),
    triggerRadius: 7,
    blockRadius: 3.0,
  },
  {
    id: "cinema",
    name: "Promo Cinema",
    tagline: "Now showing",
    section: "Promo Video",
    description:
      "The short animated introduction made in After Effects, on the big screen.",
    color: "#60a5fa",
    position: ring(6),
    triggerRadius: 8,
    blockRadius: 3.8,
  },
  {
    id: "oracle",
    name: "Oracle Terminal",
    tagline: "Ask me anything",
    section: "AI Chatbot",
    description:
      "A RAG-powered assistant that answers questions about Farrukh using only the portfolio's own documents.",
    color: "#a78bfa",
    position: ring(7),
    triggerRadius: 7,
    blockRadius: 2.6,
  },
  {
    id: "hire",
    name: "Hire Harbour",
    tagline: "Let's build something",
    section: "Work with me",
    description:
      "What I can help with, what I work with most, and the quickest ways to get in touch.",
    color: "#f97316",
    position: ring(8),
    triggerRadius: 7,
    blockRadius: 3.0,
  },
  {
    id: "comms",
    name: "Comms Tower",
    tagline: "Send a message",
    section: "Contact",
    description:
      "Send a message straight to Farrukh's inbox from an in-world terminal.",
    color: "#2dd4bf",
    position: ring(9),
    triggerRadius: 7,
    blockRadius: 2.8,
  },
];

export const ZONE_BY_ID = Object.fromEntries(
  ZONES.map((z) => [z.id, z]),
) as Record<ZoneId, Zone>;

export const XP_PER_ZONE = 100;
export const XP_PER_LEVEL = 200;
