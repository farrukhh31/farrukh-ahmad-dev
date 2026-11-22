import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { simpleParser } from "mailparser";

import { GET, POST } from "@/app/api/contact/route";
import { __resetContactState, issueToken } from "@/lib/contact/spam";

const SECRET = "route-test-secret-0123456789";
let outbox: string;
let ipCounter = 0;

beforeAll(() => {
  outbox = fs.mkdtempSync(path.join(os.tmpdir(), "outbox-"));
  Object.assign(process.env, { CONTACT_SECRET: SECRET, CONTACT_TRANSPORT: "file", CONTACT_OUTBOX: outbox, CONTACT_TO: "owner@example.com", CONTACT_FROM: "bot@example.com" });
});
afterAll(() => fs.rmSync(outbox, { recursive: true, force: true }));
beforeEach(() => {
  __resetContactState();
  fs.readdirSync(outbox).forEach((f) => fs.rmSync(path.join(outbox, f)));
});

const form = { name: "Ayesha Khan", email: "ayesha@example.com", subject: "Internship opportunity", message: "Hi Farrukh, we loved your portfolio and would like to talk." };
const freshToken = () => issueToken(SECRET, Date.now() - 6000);

function post(body: unknown, headers: Record<string, string> = {}, ip = `10.0.0.${++ipCounter}`) {
  return POST(new Request("http://localhost:3000/api/contact", { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": ip, ...headers }, body: typeof body === "string" ? body : JSON.stringify(body) }));
}
const sendable = (extra = {}) => ({ ...form, token: freshToken(), website: "", ...extra });
const outboxFiles = () => fs.readdirSync(outbox);

describe("GET /api/contact", () => {
  it("issues a signed token and is never cached", async () => {
    const res = await GET();
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(typeof (await res.json()).token).toBe("string");
  });
});

describe("POST /api/contact", () => {
  it("delivers a valid message to the owner, with the visitor as Reply-To", async () => {
    const res = await post(sendable());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(outboxFiles()).toHaveLength(1);
    const mail = await simpleParser(fs.readFileSync(path.join(outbox, outboxFiles()[0])));
    expect(mail.to).toMatchObject({ text: "owner@example.com" });
    expect(mail.from?.value[0].address).toBe("bot@example.com");
    expect(mail.replyTo?.value[0].address).toBe("ayesha@example.com");
    expect(mail.subject).toBe("[Portfolio] Internship opportunity");
    expect(mail.text).toContain("we loved your portfolio");
    expect(mail.text).toContain("Ayesha Khan");
  });

  it("escapes HTML so a message can't inject markup into the owner's inbox", async () => {
    await post(sendable({ name: "<b>Eve</b>", message: `<script>alert("x")</script> hello there, nice site` }));
    const mail = await simpleParser(fs.readFileSync(path.join(outbox, outboxFiles()[0])));
    expect(String(mail.html)).not.toContain("<script>");
    expect(String(mail.html)).toContain("&lt;script&gt;");
    expect(String(mail.html)).not.toContain("<b>Eve</b>");
  });

  it("returns per-field errors and sends nothing for invalid input", async () => {
    const res = await post(sendable({ email: "nope", message: "x" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(Object.keys(body.errors).sort()).toEqual(["email", "message"]);
    expect(outboxFiles()).toHaveLength(0);
  });

  it("blocks email header injection", async () => {
    const res = await post(sendable({ subject: "Hello\r\nBcc: victim@example.com" }));
    expect(res.status).toBe(400);
    expect(outboxFiles()).toHaveLength(0);
  });

  it("pretends to succeed on a filled honeypot but sends nothing", async () => {
    const res = await post(sendable({ website: "http://spam.example" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(outboxFiles()).toHaveLength(0);
  });

  it.each([
    ["missing token", { token: undefined }],
    ["forged token", { token: issueToken("some-other-secret-0123456789", Date.now() - 6000) }],
    ["expired token", { token: issueToken(SECRET, Date.now() - 3 * 3600 * 1000) }],
  ])("rejects a %s", async (_n, patch) => {
    const res = await post(sendable(patch));
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("token");
    expect(outboxFiles()).toHaveLength(0);
  });

  it("rejects a form submitted faster than a human could fill it", async () => {
    const res = await post(sendable({ token: issueToken(SECRET, Date.now() - 300) }));
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("too-fast");
  });

  it("rate-limits one visitor to 3 messages per 10 minutes", async () => {
    const ip = "203.0.113.9";
    const codes: number[] = [];
    for (let i = 0; i < 4; i++) codes.push((await post(sendable({ message: `Message number ${i} with enough words to pass` }), {}, ip)).status);
    expect(codes).toEqual([200, 200, 200, 429]);
    const blocked = await post(sendable(), {}, ip);
    expect(blocked.headers.get("retry-after")).toMatch(/^\d+$/);
    expect(outboxFiles()).toHaveLength(3);
  });

  it("does not count invalid or rejected attempts against a visitor's quota", async () => {
    const ip = "203.0.113.50";
    for (const bad of [{ email: "nope" }, { subject: "Hi\r\nBcc: x@y.z" }, { message: "buy http://a.com http://b.com http://c.com now" }, { message: "x" }]) {
      expect((await post(sendable(bad), {}, ip)).status).toBe(400);
    }
    const ok: number[] = [];
    for (let i = 0; i < 3; i++) ok.push((await post(sendable({ message: `Genuine message ${i}, with enough words in it.` }), {}, ip)).status);
    expect(ok).toEqual([200, 200, 200]);
  });

  it("stops request floods with a separate, looser limit", async () => {
    const ip = "203.0.113.60";
    const codes: number[] = [];
    for (let i = 0; i < 32; i++) codes.push((await post("{bad json", {}, ip)).status);
    expect(codes.slice(0, 30).every((c) => c === 400)).toBe(true);
    expect(codes.slice(30)).toEqual([429, 429]);
  });

  it("rejects link-stuffed messages", async () => {
    const res = await post(sendable({ message: "buy now http://a.com http://b.com http://c.com please click" }));
    expect(res.status).toBe(400);
    expect(outboxFiles()).toHaveLength(0);
  });

  it("delivers an accidental double-submit only once", async () => {
    const msg = sendable();
    expect((await post(msg)).status).toBe(200);
    expect((await post({ ...msg, token: freshToken() })).status).toBe(200);
    expect(outboxFiles()).toHaveLength(1);
  });

  it("rejects cross-site posts, malformed JSON and oversized bodies", async () => {
    expect((await post(sendable(), { origin: "https://evil.example" })).status).toBe(403);
    expect((await post("{not json")).status).toBe(400);
    expect((await post("[1,2,3]")).status).toBe(400);
    expect((await post(JSON.stringify({ ...sendable(), message: "x".repeat(20_000) }))).status).toBe(413);
  });

  it("reports a safe error (no internals) when the mail server is down", async () => {
    const prev = { ...process.env };
    Object.assign(process.env, { CONTACT_TRANSPORT: "smtp", SMTP_HOST: "127.0.0.1", SMTP_PORT: "1", SMTP_SECURE: "false" });
    const res = await post(sendable());
    Object.assign(process.env, { CONTACT_TRANSPORT: prev.CONTACT_TRANSPORT });
    delete process.env.SMTP_HOST;
    expect(res.status).toBe(502);
    const text = JSON.stringify(await res.json());
    expect(text).not.toMatch(/ECONNREFUSED|127\.0\.0\.1|nodemailer/i);
  });
});
