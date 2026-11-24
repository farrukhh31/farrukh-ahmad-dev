import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";

import ThemeProvider from "@/components/Providers/themeProvider";
import AnalyticsTracker from "@/components/analytics/AnalyticsTracker";
import VercelInsights from "@/components/analytics/VercelInsights";
import ModeTransition from "@/components/PlayCTA/ModeTransition";
import FloatingChat from "@/components/chat/FloatingChat";

export const metadata: Metadata = {
  title: "Farrukh.dev",
  description: "Full Stack Developer • Game Developer • Playable 3D Portfolio",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable}`}
      suppressHydrationWarning
    >
      <body className="relative min-h-screen overflow-x-hidden bg-(--background) text-(--foreground) antialiased">
        <ThemeProvider>{children}</ThemeProvider>
        <FloatingChat />
        <ModeTransition />
        <AnalyticsTracker />
        {/* durable page-view counts on Vercel (cookieless); does nothing elsewhere */}
        <VercelInsights />
      </body>
    </html>
  );
}
