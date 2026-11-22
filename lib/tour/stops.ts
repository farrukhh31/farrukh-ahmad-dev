import { skills } from "@/components/Skills/skillsData";
import { Projects } from "@/components/Projects/Projects-s";
import { experience } from "@/components/Experience/ExperiencedData";
import { certificates } from "@/components/certificates/certificatesData";
import { ZONES, ZONE_BY_ID, type ZoneId } from "@/lib/game/zones";

export type V3 = [number, number, number];

export interface TourStop {
  id: string;
  zone: ZoneId | null;
  kicker: string;
  title: string;
  tagline: string;
  body: string;
  fact?: string;
  /** section of the Recruiter Mode page with the full details */
  detail?: string;
  color: string;
  cam: V3;
  look: V3;
}

const FACTS: Partial<Record<ZoneId, string>> = {
  skills: `${skills.length} skills across languages, frameworks, engines and DevOps`,
  projects: `${Projects.length} projects, from games to full-stack apps`,
  quest: `${experience.length} checkpoints across work and education`,
  trophy: `${certificates.length} certificates, ${certificates.filter((c) => c.status === "completed").length} completed`,
};

const DETAIL: Partial<Record<ZoneId, string>> = {
  about: "about",
  skills: "skills",
  projects: "projects",
  quest: "experience",
  trophy: "experience",
  comms: "contact",
};

const LOOK_Y: Partial<Record<ZoneId, number>> = { about: 5, comms: 4.5 };

const zoneStops: TourStop[] = ZONES.filter((z) => z.id !== "plaza").map((z, i) => {
  const [x, , zz] = z.position;
  const d = Math.hypot(x, zz) || 1;
  const ux = -x / d; // zone -> hub
  const uz = -zz / d;
  const side = i % 2 === 0 ? 1 : -1;
  const back = z.blockRadius + 11;
  const cam: V3 = [x + ux * back - uz * side * 5, 6.8 + z.blockRadius * 0.5, zz + uz * back + ux * side * 5];
  const look: V3 = [x, LOOK_Y[z.id] ?? 3, zz];
  return {
    id: z.id,
    zone: z.id,
    kicker: z.section,
    title: z.name,
    tagline: z.tagline,
    body: z.description,
    fact: FACTS[z.id],
    detail: DETAIL[z.id],
    color: z.color,
    cam,
    look,
  };
});

export const TOUR_STOPS: TourStop[] = [
  {
    id: "overview",
    zone: null,
    kicker: "The archipelago",
    title: "Farrukh Ahmad",
    tagline: "Game developer · Full stack · AI",
    body: "Nine islands, one portfolio. Scroll to fly across them, or step off the tour and explore on foot.",
    color: "#38bdf8",
    cam: [0, 54, 74],
    look: [0, -3, -4],
  },
  {
    id: "plaza",
    zone: "plaza",
    kicker: ZONE_BY_ID.plaza.section,
    title: ZONE_BY_ID.plaza.name,
    tagline: ZONE_BY_ID.plaza.tagline,
    body: ZONE_BY_ID.plaza.description,
    color: ZONE_BY_ID.plaza.color,
    cam: [0, 11, 24],
    look: [0, 3, 0],
  },
  ...zoneStops,
  {
    id: "outro",
    zone: null,
    kicker: "End of the tour",
    title: "Now go and play",
    tagline: "Every island is walkable",
    body: "Jump into the game to collect skills and earn XP, or send a message from the Comms Tower.",
    color: "#a78bfa",
    cam: [-54, 38, 64],
    look: [0, -2, 0],
  },
];
