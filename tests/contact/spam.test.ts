import { beforeEach, describe, expect, it } from "vitest";
import { MAX_AGE_MS, MIN_FILL_MS, __resetContactState, checkToken, countLinks, isDuplicate, issueToken, rateLimit } from "@/lib/contact/spam";

const SECRET = "unit-test-secret-0123456789";
beforeEach(() => __resetContactState());

describe("time-trap token", () => {
  const now = 1_800_000_000_000;
  it("accepts a token aged between the minimum and maximum", () => {
    expect(checkToken(issueToken(SECRET, now - MIN_FILL_MS - 1), SECRET, now)).toBe("ok");
  });
  it("flags instant submissions", () => expect(checkToken(issueToken(SECRET, now - 500), SECRET, now)).toBe("too-fast"));
  it("flags stale tokens", () => expect(checkToken(issueToken(SECRET, now - MAX_AGE_MS - 1), SECRET, now)).toBe("expired"));
  it("rejects forged, tampered and malformed tokens", () => {
    const t = issueToken(SECRET, now - 10_000);
    expect(checkToken(issueToken("other-secret-0123456789", now - 10_000), SECRET, now)).toBe("invalid");
    expect(checkToken(t.replace(/^\d/, "9"), SECRET, now)).toBe("invalid");
    for (const bad of [undefined, null, 5, "", "abc", "1.2.3", `${now}.`, "x.y"]) expect(checkToken(bad, SECRET, now)).toBe("invalid");
  });
});

describe("rate limiter", () => {
  it("allows 3 per 10 minutes per visitor, then reports the wait", () => {
    const t = 1_000_000;
    expect([1, 2, 3].map((i) => rateLimit("a", t + i))).toEqual([0, 0, 0]);
    const wait = rateLimit("a", t + 10);
    expect(wait).toBeGreaterThan(0);
    expect(wait).toBeLessThanOrEqual(600);
    expect(rateLimit("b", t + 10)).toBe(0); // other visitors unaffected
    expect(rateLimit("a", t + 10 * 60 * 1000 + 100)).toBe(0); // window slides
  });
  it("also caps a visitor per day", () => {
    let t = 0;
    const results = Array.from({ length: 12 }, () => rateLimit("daily", (t += 11 * 60 * 1000)));
    expect(results.slice(0, 10).every((r) => r === 0)).toBe(true);
    expect(results[10]).toBeGreaterThan(0);
  });
});

describe("content checks", () => {
  it("counts links", () => {
    expect(countLinks("see https://a.com and www.b.com and http://c.org/x")).toBe(3);
    expect(countLinks("no links here")).toBe(0);
  });
  it("detects an identical resend within an hour", () => {
    expect(isDuplicate("a@b.co", "hello there", 1000)).toBe(false);
    expect(isDuplicate("a@b.co", "hello there", 2000)).toBe(true);
    expect(isDuplicate("other@b.co", "hello there", 2000)).toBe(false);
  });
});
