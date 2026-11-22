import type { Metadata } from "next";
import TourRoot from "@/components/tour/TourRoot";

export const metadata: Metadata = {
  title: "Archipelago Tour — Farrukh's Portfolio",
  description: "Scroll to fly across Farrukh's portfolio archipelago.",
};

export default function TourPage() {
  return <TourRoot />;
}
