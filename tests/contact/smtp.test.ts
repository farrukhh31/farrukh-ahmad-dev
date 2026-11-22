import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SMTPServer } from "smtp-server";
import { simpleParser, type ParsedMail } from "mailparser";

import { POST } from "@/app/api/contact/route";
import { __resetMailer } from "@/lib/contact/mailer";
import { __resetContactState, issueToken } from "@/lib/contact/spam";

/**
 * Delivery evidence: the real nodemailer SMTP transport talks to a real SMTP server
 * (in-process), authenticates with credentials from env vars, and we parse the email
 * that arrives - exactly what Gmail/Brevo/etc. would receive.
 */
const SECRET = "smtp-test-secret-0123456789";
const received: { mail: ParsedMail; envelope: { from: string; to: string[] }; user?: string }[] = [];
let server: SMTPServer;
let port = 0;

beforeAll(async () => {
  server = new SMTPServer({
    authOptional: false,
    allowInsecureAuth: true,
    disabledCommands: ["STARTTLS"],
    onAuth(auth, _s, cb) {
      if (auth.username === "mailer@example.com" && auth.password === "app-password-123") cb(null, { user: auth.username });
      else cb(new Error("Invalid credentials"));
    },
    onData(stream, session, cb) {
      simpleParser(stream).then((mail) => {
        received.push({ mail, envelope: { from: session.envelope.mailFrom ? session.envelope.mailFrom.address : "", to: session.envelope.rcptTo.map((r) => r.address) }, user: session.user as string | undefined });
        cb();
      });
    },
  });
  await new Promise<void>((res) => server.listen(0, "127.0.0.1", () => res()));
  port = (server.server.address() as { port: number }).port;
  Object.assign(process.env, { CONTACT_SECRET: SECRET, CONTACT_TRANSPORT: "smtp", SMTP_HOST: "127.0.0.1", SMTP_PORT: String(port), SMTP_SECURE: "false", SMTP_USER: "mailer@example.com", SMTP_PASS: "app-password-123", CONTACT_TO: "farrukh@example.com", CONTACT_FROM: "mailer@example.com" });
  __resetMailer();
  __resetContactState();
});
afterAll(() => new Promise<void>((res) => server.close(() => res())));

describe("real SMTP delivery", () => {
  it("authenticates and delivers the visitor's message to the owner's address", async () => {
    const res = await POST(new Request("http://localhost/api/contact", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": "198.51.100.7" },
      body: JSON.stringify({ name: "Sara Ahmed", email: "sara@company.com", subject: "Project collaboration", message: "Hello Farrukh! I run a small game studio and would love to chat about a collaboration.", token: issueToken(SECRET, Date.now() - 6000), website: "" }),
    }));
    expect(await res.json()).toEqual({ ok: true });

    expect(received).toHaveLength(1);
    const { mail, envelope, user } = received[0];
    expect(user).toBe("mailer@example.com"); // SMTP credentials came from env vars
    expect(envelope.to).toEqual(["farrukh@example.com"]);
    expect(mail.subject).toBe("[Portfolio] Project collaboration");
    expect(mail.replyTo?.value[0]).toMatchObject({ address: "sara@company.com", name: "Sara Ahmed" });
    expect(mail.text).toContain("small game studio");
    console.log("\n--- EMAIL RECEIVED BY THE SMTP SERVER ---\nFrom:     ", mail.from?.text, "\nTo:       ", mail.to && "text" in mail.to ? mail.to.text : "", "\nReply-To: ", mail.replyTo?.text, "\nSubject:  ", mail.subject, "\n\n" + mail.text + "\n-----------------------------------------");
  });

  it("fails safely when the SMTP password is wrong (and says nothing about why)", async () => {
    process.env.SMTP_PASS = "wrong-password";
    __resetMailer();
    const res = await POST(new Request("http://localhost/api/contact", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": "198.51.100.8" },
      body: JSON.stringify({ name: "Sara Ahmed", email: "sara@company.com", subject: "Second message", message: "This one should not be delivered at all.", token: issueToken(SECRET, Date.now() - 6000), website: "" }),
    }));
    expect(res.status).toBe(502);
    expect(JSON.stringify(await res.json())).not.toMatch(/password|credentials|auth/i);
    expect(received).toHaveLength(1);
  });
});
