import { describe, expect, it } from "vitest";
import { BRIDGES, PLATFORMS, PLATFORM_BY_ID, isWalkable } from "@/lib/game/layout";
import { travelToZone } from "@/lib/game/travel";
import { playerState } from "@/lib/game/input";
import { ISLAND_RADIUS, SPAWN, ZONES } from "@/lib/game/zones";

describe("archipelago layout", () => {
  it("gives every zone its own platform, with real gaps between platforms", () => {
    expect(PLATFORMS).toHaveLength(ZONES.length);
    for (let i = 0; i < PLATFORMS.length; i++) {
      for (let j = i + 1; j < PLATFORMS.length; j++) {
        const a = PLATFORMS[i];
        const b = PLATFORMS[j];
        expect(Math.hypot(a.x - b.x, a.z - b.z) - a.r - b.r).toBeGreaterThan(3);
      }
    }
  });

  it("keeps everything inside the minimap", () => {
    for (const p of PLATFORMS) expect(Math.hypot(p.x, p.z) + p.r).toBeLessThanOrEqual(ISLAND_RADIUS + 0.001);
  });

  it("connects every platform to the plaza and to its neighbours", () => {
    expect(BRIDGES).toHaveLength(16);
    for (const b of BRIDGES) expect(isWalkable((b.sx + b.ex) / 2, (b.sz + b.ez) / 2)).toBe(true);
  });

  it("spawns on a platform and blocks the void", () => {
    expect(isWalkable(SPAWN[0], SPAWN[1])).toBe(true);
    expect(isWalkable(0, 100)).toBe(false);
    const p = PLATFORM_BY_ID.about;
    expect(isWalkable(p.x + p.r + 1, p.z)).toBe(false); // just off the edge
  });

  it("fast travel always lands on the destination platform", () => {
    for (const z of ZONES) {
      travelToZone(z.id);
      const t = playerState.teleportTo!;
      expect(isWalkable(t[0], t[1])).toBe(true);
      expect(Math.hypot(t[0] - z.position[0], t[1] - z.position[2])).toBeGreaterThan(z.blockRadius);
    }
  });
});
