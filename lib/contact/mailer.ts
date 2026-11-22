import fs from "node:fs/promises";
import path from "node:path";
import nodemailer, { type Transporter } from "nodemailer";
import type { ContactInput } from "./schema";

/**
 * Sends the visitor's message to the owner's inbox.
 *
 *   CONTACT_TRANSPORT=smtp  -> real SMTP (Gmail app password, Brevo, Resend SMTP, ...)
 *   CONTACT_TRANSPORT=file  -> writes an .eml file to CONTACT_OUTBOX (development / demo)
 *
 * If unset: "smtp" when SMTP_HOST is configured, otherwise "file" outside production.
 * All credentials come from environment variables - none are in the code or the browser.
 */
export class MailConfigError extends Error {}

export function mailMode(): "smtp" | "file" {
  const explicit = process.env.CONTACT_TRANSPORT;
  if (explicit === "smtp" || explicit === "file") return explicit;
  if (process.env.SMTP_HOST) return "smtp";
  if (process.env.NODE_ENV !== "production") return "file";
  throw new MailConfigError("Mail transport is not configured");
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

// strip characters that could break out of a display name in a header
const displayName = (s: string) => s.replace(/["<>\\,;:\r\n]/g, "").trim() || "Visitor";

let smtp: Transporter | null = null;
function transporter(mode: "smtp" | "file"): Transporter {
  if (mode === "file") return nodemailer.createTransport({ streamTransport: true, buffer: true, newline: "unix" });
  if (smtp) return smtp;
  const host = process.env.SMTP_HOST;
  if (!host) throw new MailConfigError("SMTP_HOST is not set");
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  smtp = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT ?? 465),
    secure: (process.env.SMTP_SECURE ?? "true") === "true",
    auth: user && pass ? { user, pass } : undefined,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  });
  return smtp;
}

export function __resetMailer() {
  smtp = null;
}

export async function sendContactMail(input: ContactInput, meta: { ip: string; at?: Date }) {
  const to = process.env.CONTACT_TO;
  const from = process.env.CONTACT_FROM ?? process.env.SMTP_USER;
  if (!to || !from) throw new MailConfigError("CONTACT_TO / CONTACT_FROM are not set");

  const mode = mailMode();
  const at = (meta.at ?? new Date()).toISOString();
  const text = [
    `New message from your portfolio`,
    ``,
    `Name:    ${input.name}`,
    `Email:   ${input.email}`,
    `Subject: ${input.subject}`,
    ``,
    input.message,
    ``,
    `--`,
    `Sent ${at} via the Dev Hub contact terminal. Just hit Reply to answer the visitor.`,
  ].join("\n");

  const html =
    `<div style="font-family:system-ui,sans-serif;max-width:640px">` +
    `<h2 style="margin:0 0 12px">New portfolio message</h2>` +
    `<table style="border-collapse:collapse"><tr><td style="padding:2px 12px 2px 0;color:#64748b">Name</td><td>${escapeHtml(input.name)}</td></tr>` +
    `<tr><td style="padding:2px 12px 2px 0;color:#64748b">Email</td><td>${escapeHtml(input.email)}</td></tr>` +
    `<tr><td style="padding:2px 12px 2px 0;color:#64748b">Subject</td><td>${escapeHtml(input.subject)}</td></tr></table>` +
    `<div style="margin-top:16px;padding:14px;background:#f1f5f9;border-radius:8px;white-space:pre-wrap">${escapeHtml(input.message)}</div>` +
    `<p style="color:#94a3b8;font-size:12px">Sent ${at} via the Dev Hub contact terminal. Hit Reply to answer the visitor.</p></div>`;

  const info = await transporter(mode).sendMail({
    from: { name: "Portfolio contact form", address: from },
    to,
    replyTo: { name: displayName(input.name), address: input.email },
    subject: `[Portfolio] ${input.subject}`,
    text,
    html,
  });

  if (mode === "file") {
    const dir = path.resolve(process.env.CONTACT_OUTBOX ?? ".contact-outbox");
    await fs.mkdir(dir, { recursive: true });
    const file = path.join(dir, `${at.replace(/[:.]/g, "-")}-${Math.random().toString(36).slice(2, 7)}.eml`);
    await fs.writeFile(file, info.message as Buffer);
    return { mode, id: path.basename(file) };
  }
  return { mode, id: String(info.messageId ?? "") };
}
