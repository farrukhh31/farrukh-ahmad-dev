import Background from "@/components/Background/bg";
import LoadingScreen from "@/components/Loading/LoadingScreen";
import { LaunchScreen } from "@/components/Launch";

import RouteTransition from "@/components/hero/transitions/RouteTransition";
import RouteProgressBar from "@/components/hero/transitions/RouteProgressBar";

import Navbar from "@/components/Navbar/navbar";
import ScrollProgress from "@/components/Navbar/ScrollProgress";
import ScrollIndicator from "@/components/ScrollIndicator";

import Cursor from "@/components/Cursor/cursor";
import SocialSidebar from "@/components/SocialSidebar/SocialSidebar";

import SmoothScroll from "@/components/layout/SmoothScroll";
import PlayPill from "@/components/PlayCTA/PlayPill";

/**
 * "Recruiter Mode" — the original scrolling portfolio.
 * All the global effects live here so the playable /play route stays clean.
 */
export default function SiteLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      {/* Global Effects */}
      <Background />
      <Cursor />
      <SocialSidebar />
      <ScrollProgress />
      <ScrollIndicator />
      <PlayPill />

      {/* Persistent, fixed nav — must stay OUTSIDE RouteTransition/SmoothScroll */}
      <Navbar />

      {/* Loading Layers */}
      <LaunchScreen />
      <LoadingScreen />
      <RouteProgressBar />

      {/* Smooth Page System */}
      <SmoothScroll>
        <main className="relative z-10">
          <RouteTransition>{children}</RouteTransition>
        </main>
      </SmoothScroll>
    </>
  );
}
