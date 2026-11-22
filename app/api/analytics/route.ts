import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";

import { parseEvents } from "@/lib/analytics/events";
import { clientIp, doNotTrack, keyMatches, originAllowed } from "@/lib/analytics/http";
import { record, summary, visitorHash } from "@/lib/analytics/store";
import { rateLimit } from "@/lib/contact/spam";

/**
 *   POST /api/analytics  { events: [{ type, name }] }   -> 204   (public, write-only, validated)
 *   GET  /api/analytics  Authorization: Bearer <ANALYTICS_KEY>  -> aggregate numbers (owner only)
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "cache-control": "no-store" };
const MAX_BODY = 2_000;
const WRITE_LIMIT = [{ ms: 60_000, max: 60 }];
const AUTH_FAIL_LIMIT = [{ ms: 10 * 60_000, max: 10 }];
const DEV_SALT = randomBytes(16).toString("hex");

const salt = () => process.env.ANALYTICS_SALT || process.env.CONTACT_SECRET || DEV_SALT;
const json = (body: unknown, status: number, headers: Record<string, string> = {}) =>
  NextResponse.json(body, { status, headers: { ...NO_STORE, ...headers } });

export async function POST(req: Request) {
  if (!originAllowed(req)) return json({ error: "Request not allowed." }, 403);
  if (doNotTrack(req)) return new NextResponse(null, { status: 204, headers: NO_STORE }); // respected, nothing stored

  const ip = clientIp(req);
  const wait = rateLimit(`analytics:${ip}`, Date.now(), WRITE_LIMIT);
  if (wait > 0) return json({ error: "Too many requests." }, 429, { "retry-after": String(wait) });

  const raw = await req.text();
  if (raw.length > MAX_BODY) return json({ error: "Too large." }, 413);
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ error: "Invalid request." }, 400);
  }
  const events = parseEvents(body);
  if (!events) return json({ error: "Invalid events." }, 400);

  record(events, visitorHash(ip, req.headers.get("user-agent") ?? "", salt()));
  return new NextResponse(null, { status: 204, headers: NO_STORE });
}

export async function GET(req: Request) {
  const key = process.env.ANALYTICS_KEY;
  if (!key || key.length < 12) return json({ error: "The dashboard is not configured." }, 503);

  const ip = clientIp(req);
  const given = /^Bearer (.+)$/.exec(req.headers.get("authorization") ?? "")?.[1] ?? "";
  if (!keyMatches(given, key)) {
    // only failed attempts count, so the real owner is never locked out by visitors
    const wait = rateLimit(`analytics-auth:${ip}`, Date.now(), AUTH_FAIL_LIMIT);
    if (wait > 0) return json({ error: "Too many attempts." }, 429, { "retry-after": String(wait) });
    return json({ error: "Wrong key." }, 401);
  }
  return json(summary(), 200);
}
