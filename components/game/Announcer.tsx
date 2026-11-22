"use client";

import { useGame } from "@/lib/game/store";
import { ZONE_BY_ID } from "@/lib/game/zones";

/**
 * Visually hidden live regions so screen-reader users hear what a sighted
 * player sees: which zone they are standing in and every XP / achievement event.
 */
export default function Announcer() {
  const active = useGame((s) => s.activeZone);
  const gain = useGame((s) => s.lastGain);

  return (
    <>
      <p className="sr-only" aria-live="polite" role="status">
        {active ? `You are at ${ZONE_BY_ID[active].name}. Press E to open it.` : ""}
      </p>
      <p className="sr-only" aria-live="polite" role="status">
        {gain ? `${gain.label}. Plus ${gain.amount} experience.` : ""}
      </p>
    </>
  );
}
