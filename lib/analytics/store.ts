import { createHash, createHmac } from "node:crypto";
import fs from "node:fs";
import type { AnalyticsEvent } from "./events";

/**
 * Tiny first-party analytics store (counters only).
 *
 *  - No cookies, no localStorage ids, no raw IP addresses are kept.
 *  - "Unique visitors" are counted from a hash of (IP + browser) mixed with a salt that changes every
 *    UTC day, so a visitor cannot be followed from one day to the next. Only the number is exposed.
 *  - State lives in memory. Set ANALYTICS_FILE to also persist it to a JSON file (fine for one server,
 *    a VPS or Docker volume). On serverless hosting memory is per-instance, which is why the site also
 *    ships Vercel Web Analytics for durable page-view numbers (see docs/ANALYTICS.md).
 */
const KEEP_DAYS = 30;
const MAX_KEYS_PER_DAY = 400; // hard cap so a hostile client cannot grow memory without bound

interface DayBucket {
  events: Record<string, number>; // "type:name" -> count
  visitors: Set<string>;
  pageviews: number;
}

const days = new Map<string, DayBucket>();
const startedAt = { value: Date.now() };
let loaded = false;
let saveTimer: ReturnType<typeof setTimeout> | null = null;

const dayKey = (now: number) => new Date(now).toISOString().slice(0, 10);

function filePath(): string | null {
  return process.env.ANALYTICS_FILE || null;
}

function load() {
  if (loaded) return;
  loaded = true;
  const p = filePath();
  if (!p) return;
  try {
    const raw = JSON.parse(fs.readFileSync(p, "utf8")) as {
      since?: number;
      days?: Record<string, { events: Record<string, number>; visitors: string[]; pageviews: number }>;
    };
    if (raw.since) startedAt.value = raw.since;
    for (const [d, b] of Object.entries(raw.days ?? {})) {
      days.set(d, { events: b.events ?? {}, visitors: new Set(b.visitors ?? []), pageviews: b.pageviews ?? 0 });
    }
  } catch {
    /* no file yet, or unreadable: start fresh */
  }
}

function scheduleSave() {
  const p = filePath();
  if (!p || saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try {
      const out: Record<string, unknown> = {};
      for (const [d, b] of days) out[d] = { events: b.events, visitors: [...b.visitors], pageviews: b.pageviews };
      fs.writeFileSync(p, JSON.stringify({ since: startedAt.value, days: out }));
    } catch {
      /* analytics must never break the site */
    }
  }, 2000);
  saveTimer.unref?.();
}

function prune(now: number) {
  const cutoff = dayKey(now - KEEP_DAYS * 86_400_000);
  for (const d of days.keys()) if (d < cutoff) days.delete(d);
}

/** Anonymous per-day visitor id. Not reversible, and different every day. */
export function visitorHash(ip: string, userAgent: string, secret: string, now = Date.now()): string {
  const salt = createHmac("sha256", secret).update(dayKey(now)).digest("hex");
  return createHash("sha256").update(`${salt}|${ip}|${userAgent}`).digest("hex").slice(0, 16);
}

export function record(events: AnalyticsEvent[], visitor: string, now = Date.now()) {
  load();
  prune(now);
  const key = dayKey(now);
  let bucket = days.get(key);
  if (!bucket) days.set(key, (bucket = { events: {}, visitors: new Set(), pageviews: 0 }));
  bucket.visitors.add(visitor);
  for (const e of events) {
    const k = `${e.type}:${e.name}`;
    if (!(k in bucket.events) && Object.keys(bucket.events).length >= MAX_KEYS_PER_DAY) continue;
    bucket.events[k] = (bucket.events[k] ?? 0) + 1;
    if (e.type === "pageview") bucket.pageviews += 1;
  }
  scheduleSave();
}

export interface Summary {
  since: string;
  today: { pageviews: number; visitors: number };
  totals: { pageviews: number; events: number };
  /** last 14 days, oldest first */
  daily: { day: string; pageviews: number; visitors: number }[];
  /** event counts for the retained period, grouped by type, biggest first */
  breakdown: Record<string, { name: string; count: number }[]>;
}

export function summary(now = Date.now()): Summary {
  load();
  prune(now);
  const totalsByKey: Record<string, number> = {};
  let pageviews = 0;
  let events = 0;
  for (const b of days.values()) {
    pageviews += b.pageviews;
    for (const [k, v] of Object.entries(b.events)) {
      totalsByKey[k] = (totalsByKey[k] ?? 0) + v;
      events += v;
    }
  }
  const breakdown: Summary["breakdown"] = {};
  for (const [k, count] of Object.entries(totalsByKey)) {
    const i = k.indexOf(":");
    (breakdown[k.slice(0, i)] ??= []).push({ name: k.slice(i + 1), count });
  }
  for (const list of Object.values(breakdown)) list.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  const daily: Summary["daily"] = [];
  for (let i = 13; i >= 0; i--) {
    const d = dayKey(now - i * 86_400_000);
    const b = days.get(d);
    daily.push({ day: d, pageviews: b?.pageviews ?? 0, visitors: b?.visitors.size ?? 0 });
  }
  const t = days.get(dayKey(now));
  return {
    since: new Date(startedAt.value).toISOString(),
    today: { pageviews: t?.pageviews ?? 0, visitors: t?.visitors.size ?? 0 },
    totals: { pageviews, events },
    daily,
    breakdown,
  };
}

/** test helper */
export function __resetAnalytics() {
  days.clear();
  loaded = true;
  startedAt.value = Date.now();
}
