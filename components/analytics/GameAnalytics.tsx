"use client";

import { useEffect } from "react";
import { track } from "@/lib/analytics/client";
import { useGame } from "@/lib/game/store";

const added = (next: Record<string, unknown>, prev: Record<string, unknown>) =>
  Object.keys(next).filter((k) => !(k in prev));

/** Turns game progress into anonymous analytics events (zone discovered, orb collected, ...). */
export default function GameAnalytics() {
  useEffect(() => {
    return useGame.subscribe((s, p) => {
      if (s.visited !== p.visited) added(s.visited, p.visited).forEach((z) => track("zone", z));
      if (s.opened !== p.opened) added(s.opened, p.opened).forEach((z) => track("panel", z));
      if (s.skills !== p.skills) added(s.skills, p.skills).forEach((id) => track("skill", id));
      if (s.achievements !== p.achievements) added(s.achievements, p.achievements).forEach((a) => track("achievement", a));
      if (s.messageSent && !p.messageSent) track("contact", "game");
    });
  }, []);
  return null;
}
