import path from "path";
import type { NextConfig } from "next";

/**
 * Security headers sent with every page. A strict Content-Security-Policy is
 * deliberately not set: it has not been tested against Three.js / R3F, Vercel
 * Analytics and the Web Speech API, and a wrong policy would break the game.
 * Add one only after testing it in a browser.
 */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // microphone is needed for the chatbot's voice input; nothing else is used
  { key: "Permissions-Policy", value: "camera=(), geolocation=(), microphone=(self)" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  turbopack: {
    root: path.resolve(__dirname),
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // Big static assets: let browsers/CDN reuse them (file names are not hashed, so 1 day + revalidate)
      {
        source: "/models/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" }],
      },
      {
        source: "/videos/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" }],
      },
    ];
  },
};

export default nextConfig;
