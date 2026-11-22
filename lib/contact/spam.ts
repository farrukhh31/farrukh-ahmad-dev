import { createHmac, timingSafeEqual } from "node:crypto";

/* ------------------------------------------------------------------ time-trap token
 * GET /api/contact hands out "<timestamp>.<signature>". A real person needs a few seconds to
 * fill the form; most bots submit instantly (or replay an ancient token). Stateless, so it
 * also works on serverless hosts.
 */
export const MIN_FILL_MS = 3_000;
export const MAX_AGE_MS = 2 * 60 * 60 * 1000;

const sign = (ts: string, secret: string) => createHmac("sha256", secret).update(`contact:${ts}`).digest("hex");

export function issueToken(secret: string, now = Date.now()): string {
  const ts = String(now);
  return `${ts}.${sign(ts, secret)}`;
}

export type TokenCheck = "ok" | "invalid" | "too-fast" | "expired";

export function checkToken(token: unknown, secret: string, now = Date.now()): TokenCheck {
  if (typeof token !== "string") return "invalid";
  const [ts, sig, ...rest] = token.split(".");
  if (!ts || !sig || rest.length || !/^\d{10,15}$/.test(ts)) return "invalid";
  const expected = Buffer.from(sign(ts, secret));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return "invalid";
  const age = now - Number(ts);
  if (age < MIN_FILL_MS) return "too-fast";
  if (age > MAX_AGE_MS) return "expired";
  return "ok";
}

/* ------------------------------------------------------------------ rate limiting
 * Sliding windows per IP (in memory: right for a single instance; use Redis/Upstash if you
 * scale to many serverless instances).
 */
type Window = { ms: number; max: number };
/** Messages that would actually be emailed: strict. */
export const SEND_WINDOWS: Window[] = [
  { ms: 10 * 60 * 1000, max: 3 },
  { ms: 24 * 60 * 60 * 1000, max: 10 },
];
/** Any request at all (including invalid ones): loose, only stops floods. Typos never get a visitor locked out. */
export const FLOOD_WINDOWS: Window[] = [{ ms: 60 * 1000, max: 30 }];
const hits = new Map<string, number[]>();

/** Returns 0 if allowed (and records the hit), otherwise the seconds until the next attempt is allowed. */
export function rateLimit(key: string, now = Date.now(), windows: Window[] = SEND_WINDOWS): number {
  const longest = Math.max(...windows.map((w) => w.ms));
  const list = (hits.get(key) ?? []).filter((t) => now - t < longest);
  for (const w of windows) {
    const inWindow = list.filter((t) => now - t < w.ms);
    if (inWindow.length >= w.max) {
      hits.set(key, list);
      return Math.ceil((inWindow[0] + w.ms - now) / 1000);
    }
  }
  list.push(now);
  hits.set(key, list);
  if (hits.size > 5000) for (const [k, v] of hits) if (now - v[v.length - 1] > longest) hits.delete(k);
  return 0;
}

/* ------------------------------------------------------------------ duplicate + content checks */
const recent = new Map<string, number>();

export function isDuplicate(email: string, message: string, now = Date.now()): boolean {
  const key = createHmac("sha256", "dup").update(`${email}\n${message}`).digest("hex");
  const seen = recent.get(key);
  recent.set(key, now);
  if (recent.size > 2000) for (const [k, t] of recent) if (now - t > 3_600_000) recent.delete(k);
  return seen !== undefined && now - seen < 3_600_000;
}

const URL_RE = /(https?:\/\/|www\.)\S+/gi;
export const countLinks = (s: string) => (s.match(URL_RE) ?? []).length;
export const MAX_LINKS = 2;

export function __resetContactState() {
  hits.clear();
  recent.clear();
}
