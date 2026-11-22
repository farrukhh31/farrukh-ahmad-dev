import type { Metadata } from "next";
import StatsDashboard from "@/components/analytics/StatsDashboard";

export const metadata: Metadata = {
  title: "Analytics",
  robots: { index: false, follow: false },
};

export default function StatsPage() {
  return <StatsDashboard />;
}
