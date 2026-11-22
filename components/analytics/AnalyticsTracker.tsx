"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { track } from "@/lib/analytics/client";

/** Records one anonymous page view per route (Recruiter Mode "/" and the game "/play"). */
export default function AnalyticsTracker() {
  const pathname = usePathname();
  useEffect(() => {
    if (pathname && !pathname.startsWith("/stats")) track("pageview", pathname);
  }, [pathname]);
  return null;
}
