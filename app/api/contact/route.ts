import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";

import { MailConfigError, sendContactMail } from "@/lib/contact/mailer";
import { validateContact } from "@/lib/contact/schema";
import { FLOOD_WINDOWS, MAX_LINKS, checkToken, countLinks, isDuplicate, issueToken, rateLimit } from "@/lib/contact/spam";

/**
 * Contact form endpoint.
 *   GET  -> a signed, time-stamped token (the "time trap")
 *   POST -> validate -> spam checks -> email the owner
 *
 * Every defence here runs on the server; the browser-side checks are only for friendly feedback.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 10_000;
const NO_STORE = { "cache-control": "no-store" };

// In development a random per-process secret keeps things working with zero setup.
const DEV_SECRET = randomBytes(32).toString("hex");
function secret(): string | null {
  const s = process.env.CONTACT_SECRET;
  if (s && s.length >= 16) return s;
  return process.env.NODE_ENV === "production" ? null : DEV_SECRET;
}

const fail = (error: string, status: number, extra: Record<string, unknown> = {}, headers: Record<string, string> = {}) =>
  NextResponse.json({ ok: false, error, ...extra }, { status, headers: { ...NO_STORE, ...headers } });

/** Reject cross-site form posts: if the browser sent an Origin, it must be this site (or an allowed one). */
function originAllowed(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true; // non-browser clients (curl) have no Origin; they still face every other check
  try {
    const host = new URL(origin).host;
    const allowed = (process.env.CONTACT_ALLOWED_ORIGINS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    return host === req.headers.get("host") || allowed.includes(origin) || allowed.includes(host);
  } catch {
    return false;
  }
}

export async function GET() {
  const s = secret();
  if (!s) return fail("The contact form is not configured yet.", 503);
  return NextResponse.json({ token: issueToken(s) }, { headers: NO_STORE });
}

export async function POST(req: Request) {
  const s = secret();
  if (!s) return fail("The contact form is not configured yet.", 503);
  if (!originAllowed(req)) return fail("Request not allowed.", 403);

  // --- flood guard: loose limit on ANY request, so a bot can't hammer the endpoint
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const flood = rateLimit(`flood:${ip}`, Date.now(), FLOOD_WINDOWS);
  if (flood > 0) return fail("Too many requests. Please slow down.", 429, { retryAfter: flood }, { "retry-after": String(flood) });

  // --- read a bounded body
  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) return fail("That message is too large.", 413);
  let body: Record<string, unknown>;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
    body = parsed as Record<string, unknown>;
  } catch {
    return fail("Invalid request.", 400);
  }

  // --- honeypot: humans never see this field. Pretend success so bots learn nothing.
  if (typeof body.website === "string" && body.website.trim() !== "") {
    return NextResponse.json({ ok: true }, { headers: NO_STORE });
  }

  // --- time trap
  const token = checkToken(body.token, s);
  if (token === "invalid" || token === "expired") return fail("Please refresh the page and try again.", 400, { code: "token" });
  if (token === "too-fast") return fail("That was quick! Please wait a moment and send it again.", 400, { code: "too-fast" });

  // --- field validation (the real one)
  const checked = validateContact(body);
  if (!checked.ok) return fail("Please fix the highlighted fields.", 400, { errors: checked.errors });
  const data = checked.data;

  // --- content heuristics
  if (countLinks(`${data.subject} ${data.message}`) > MAX_LINKS) {
    return fail("Messages with several links can't be sent. Please remove some links.", 400, { errors: { message: "Please include at most 2 links." } });
  }

  // --- strict per-visitor limit: only messages that are valid and about to be emailed count,
  //     so fixing a typo never costs a visitor their quota
  const wait = rateLimit(ip);
  if (wait > 0) {
    return fail("You've sent a few messages already. Please try again later.", 429, { retryAfter: wait }, { "retry-after": String(wait) });
  }
  if (isDuplicate(data.email, data.message)) return NextResponse.json({ ok: true }, { headers: NO_STORE }); // already delivered

  // --- send
  try {
    const sent = await sendContactMail(data, { ip });
    console.info(`[contact] delivered via ${sent.mode}`); // never log names, emails or message text
    return NextResponse.json({ ok: true }, { headers: NO_STORE });
  } catch (e) {
    console.error(`[contact] send failed: ${e instanceof MailConfigError ? "not configured" : (e as Error).name}`);
    if (e instanceof MailConfigError) return fail("The contact form is not configured yet.", 503);
    return fail("Couldn't send your message right now. Please try again in a moment.", 502);
  }
}
