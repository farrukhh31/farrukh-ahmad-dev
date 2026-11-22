import { beforeEach, describe, expect, it } from "vitest";
import { GET, POST } from "@/app/api/analytics/route";
import { __resetAnalytics } from "@/lib/analytics/store";
import { __resetContactState } from "@/lib/contact/spam";

const KEY = "owner-dashboard-key-123";
let n = 0;
const ip = () => `198.51.100.${++n}`;

beforeEach(() => {
  __resetAnalytics();
  __resetContactState();
  process.env.ANALYTICS_KEY = KEY;
});

const post = (body: unknown, headers: Record<string, string> = {}, from = ip()) =>
  POST(new Request("http://localhost:3000/api/analytics", { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": from, host: "localhost:3000", ...headers }, body: typeof body === "string" ? body : JSON.stringify(body) }));
const get = (auth?: string, from = ip()) =>
  GET(new Request("http://localhost:3000/api/analytics", { headers: { "x-forwarded-for": from, ...(auth ? { authorization: auth } : {}) } }));

describe("POST /api/analytics", () => {
  it("records valid events and answers 204", async () => {
    expect((await post({ events: [{ type: "zone", name: "projects" }] })).status).toBe(204);
    const s = await (await get(`Bearer ${KEY}`)).json();
    expect(s.breakdown.zone).toEqual([{ name: "projects", count: 1 }]);
  });
  it("rejects malformed JSON, bad events and oversized bodies", async () => {
    expect((await post("{nope")).status).toBe(400);
    expect((await post({ events: [{ type: "zone", name: "has space" }] })).status).toBe(400);
    expect((await post({ events: [{ type: "zone", name: "a".repeat(30) }], pad: "x".repeat(3000) })).status).toBe(413);
  });
  it("rejects cross-site posts", async () => {
    expect((await post({ events: [{ type: "zone", name: "a" }] }, { origin: "https://evil.example" })).status).toBe(403);
  });
  it("respects Do Not Track and Global Privacy Control: nothing is stored", async () => {
    expect((await post({ events: [{ type: "zone", name: "a" }] }, { dnt: "1" })).status).toBe(204);
    expect((await post({ events: [{ type: "zone", name: "b" }] }, { "sec-gpc": "1" })).status).toBe(204);
    expect((await (await get(`Bearer ${KEY}`)).json()).totals.events).toBe(0);
  });
  it("rate-limits floods per visitor", async () => {
    const same = ip();
    let last = 204;
    for (let i = 0; i < 61; i++) last = (await post({ events: [{ type: "zone", name: "a" }] }, {}, same)).status;
    expect(last).toBe(429);
  });
});

describe("GET /api/analytics", () => {
  it("needs the owner's key", async () => {
    expect((await get()).status).toBe(401);
    expect((await get("Bearer wrong-key-123456")).status).toBe(401);
    expect((await get(`Bearer ${KEY}`)).status).toBe(200);
  });
  it("is disabled when no key is configured", async () => {
    delete process.env.ANALYTICS_KEY;
    expect((await get("Bearer anything")).status).toBe(503);
  });
  it("throttles repeated wrong guesses but never the real key", async () => {
    const attacker = ip();
    let last = 401;
    for (let i = 0; i < 11; i++) last = (await get(`Bearer guess-${i}-xxxxxxxx`, attacker)).status;
    expect(last).toBe(429);
    expect((await get(`Bearer ${KEY}`, attacker)).status).toBe(200);
  });
  it("is never cached", async () => {
    expect((await get(`Bearer ${KEY}`)).headers.get("cache-control")).toBe("no-store");
  });
});
