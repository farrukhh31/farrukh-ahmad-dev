import type { Metadata } from "next";
import GameRoot from "@/components/game/GameRoot";

export const metadata: Metadata = {
  title: "Dev Hub — Farrukh's Playable Portfolio",
  description: "Explore Farrukh's portfolio as a playable 3D world.",
};

export default function PlayPage() {
  return <GameRoot />;
}
