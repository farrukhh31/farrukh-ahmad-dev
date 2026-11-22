/**
 * The archipelago: every zone sits on its own floating platform, joined by bridges.
 * This file is the single source of truth for WHERE the player may walk. The visuals in
 * World.tsx and the minimap are drawn from the same data, so they can never disagree.
 */
import { ZONES, ZoneId } from "./zones";

/** Platform radius per zone (the Skill Grove needs room for its three orb rings). */
const PLATFORM_RADIUS: Partial<Record<ZoneId, number>> = {
  plaza: 10.5,
  skills: 9,
  projects: 8,
  cinema: 8,
};
const DEFAULT_PLATFORM_RADIUS = 7.4;

/** How far in from an edge the player's centre must stay. */
export const EDGE_MARGIN = 0.5;
/** Bridges are drawn 3 wide; the walkable strip is a little narrower so you never hang over the rail. */
export const BRIDGE_HALF_WIDTH = 1.5;
const BRIDGE_WALK_HALF = BRIDGE_HALF_WIDTH - 0.4;

export interface Platform {
  id: ZoneId;
  x: number;
  z: number;
  r: number;
  color: string;
}

export interface Bridge {
  a: Platform;
  b: Platform;
  /** walkable/visible span, from just inside platform a to just inside platform b */
  sx: number;
  sz: number;
  ex: number;
  ez: number;
  length: number;
  /** centre point and rotation about Y (the box's length runs along local +Z) */
  cx: number;
  cz: number;
  rotY: number;
}

export const PLATFORMS: Platform[] = ZONES.map((z) => ({
  id: z.id,
  x: z.position[0],
  z: z.position[2],
  r: PLATFORM_RADIUS[z.id] ?? DEFAULT_PLATFORM_RADIUS,
  color: z.color,
}));

export const PLATFORM_BY_ID = Object.fromEntries(PLATFORMS.map((p) => [p.id, p])) as Record<ZoneId, Platform>;

function makeBridge(a: Platform, b: Platform): Bridge {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const dist = Math.hypot(dx, dz) || 1;
  const ux = dx / dist;
  const uz = dz / dist;
  const inset = 0.4; // tuck the ends under the platforms so there is no visible seam
  const sx = a.x + ux * (a.r - inset);
  const sz = a.z + uz * (a.r - inset);
  const ex = b.x - ux * (b.r - inset);
  const ez = b.z - uz * (b.r - inset);
  return {
    a,
    b,
    sx,
    sz,
    ex,
    ez,
    length: Math.hypot(ex - sx, ez - sz),
    cx: (sx + ex) / 2,
    cz: (sz + ez) / 2,
    rotY: Math.atan2(ux, uz),
  };
}

/** Plaza -> every ring platform (spokes), plus each ring platform -> its neighbour (so the ring is a loop). */
export const BRIDGES: Bridge[] = (() => {
  const plaza = PLATFORM_BY_ID.plaza;
  const ring = PLATFORMS.filter((p) => p.id !== "plaza"); // already in reading order around the ring
  const out: Bridge[] = ring.map((p) => makeBridge(plaza, p));
  ring.forEach((p, i) => out.push(makeBridge(p, ring[(i + 1) % ring.length])));
  return out;
})();

function distToSegment(px: number, pz: number, ax: number, az: number, bx: number, bz: number) {
  const abx = bx - ax;
  const abz = bz - az;
  const len2 = abx * abx + abz * abz || 1;
  const t = Math.max(0, Math.min(1, ((px - ax) * abx + (pz - az) * abz) / len2));
  return Math.hypot(px - (ax + abx * t), pz - (az + abz * t));
}

/** True when a point is on a platform (optionally keeping `margin` away from its edge). */
export function onPlatform(x: number, z: number, margin = 0): boolean {
  return PLATFORMS.some((p) => Math.hypot(x - p.x, z - p.z) <= p.r - margin);
}

/** Smallest distance from a point to any bridge centre line. */
export function distToBridge(x: number, z: number): number {
  let best = Infinity;
  for (const b of BRIDGES) best = Math.min(best, distToSegment(x, z, b.sx, b.sz, b.ex, b.ez));
  return best;
}

/** Can the player's centre stand here? (On a platform or on a bridge, not in the void.) */
export function isWalkable(x: number, z: number): boolean {
  if (onPlatform(x, z, EDGE_MARGIN)) return true;
  for (const b of BRIDGES) {
    if (distToSegment(x, z, b.sx, b.sz, b.ex, b.ez) <= BRIDGE_WALK_HALF) return true;
  }
  return false;
}
