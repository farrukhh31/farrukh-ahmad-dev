import { timingSafeEqual } from "node:crypto";

export const clientIp = (req: Request) => req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

/** Same-site check: a browser-sent Origin must match this site (or ANALYTICS_ALLOWED_ORIGINS). */
export function originAllowed(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true; // sendBeacon from older browsers / curl: still face every other check
  try {
    const host = new URL(origin).host;
    const allowed = (process.env.ANALYTICS_ALLOWED_ORIGINS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    return host === req.headers.get("host") || allowed.includes(origin) || allowed.includes(host);
  } catch {
    return false;
  }
}

/** Honour the browser's Do Not Track and Global Privacy Control signals. */
export const doNotTrack = (req: Request) => req.headers.get("dnt") === "1" || req.headers.get("sec-gpc") === "1";

export function keyMatches(given: string, expected: string): boolean {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
