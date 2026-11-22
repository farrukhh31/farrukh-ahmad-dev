"use client";

import { useSyncExternalStore } from "react";
import { getMusicPref, getServerMusicPref, subscribeMusic } from "@/lib/game/music";

/** Live music preference (on/off + volume), shared by the game, the tour and the settings dialog. */
export function useMusicPref() {
  return useSyncExternalStore(subscribeMusic, getMusicPref, getServerMusicPref);
}
