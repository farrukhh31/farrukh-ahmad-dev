import { playerState } from "./input";
import { PLATFORM_BY_ID } from "./layout";
import { ZONE_BY_ID, ZoneId } from "./zones";

/** Teleport the player to the plaza-facing side of a zone (used by fast travel and chat citations). */
export function travelToZone(id: ZoneId) {
  const z = ZONE_BY_ID[id];
  if (!z) return;
  if (id === "plaza") {
    playerState.teleportTo = [0, 5.6];
    return;
  }
  const [x, , zz] = z.position;
  const d = Math.hypot(x, zz) || 1;
  const back = Math.min(z.blockRadius + 3.2, PLATFORM_BY_ID[id].r - 1.2); // stay on the platform
  playerState.teleportTo = [x - (x / d) * back, zz - (zz / d) * back];
}

export const isZoneId = (v: string): v is ZoneId => v in ZONE_BY_ID;
