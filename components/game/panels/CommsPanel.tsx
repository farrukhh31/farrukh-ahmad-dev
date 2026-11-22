"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, Send } from "lucide-react";

import { ContactSchema, LIMITS, validateContact, type FieldErrors } from "@/lib/contact/schema";
import { useGame } from "@/lib/game/store";

type Status = "idle" | "sending" | "sent" | "error";
type Values = { name: string; email: string; subject: string; message: string };
const EMPTY: Values = { name: "", email: "", subject: "", message: "" };

/** Contact terminal: validated form that emails Farrukh through /api/contact. */
export default function CommsPanel() {
  const [values, setValues] = useState<Values>(EMPTY);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [status, setStatus] = useState<Status>("idle");
  const [notice, setNotice] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [honeypot, setHoneypot] = useState("");
  const refs = useRef<Partial<Record<keyof Values, HTMLInputElement | HTMLTextAreaElement | null>>>({});
  const markMessageSent = useGame((s) => s.markMessageSent);

  const loadToken = useCallback(async () => {
    try {
      const res = await fetch("/api/contact", { cache: "no-store" });
      if (!res.ok) throw new Error();
      setToken((await res.json()).token);
      setOffline(false);
    } catch {
      setOffline(true);
    }
  }, []);

  // fetch the first anti-spam token when the terminal opens
  useEffect(() => {
    let alive = true;
    fetch("/api/contact", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("unavailable"))))
      .then((d) => alive && (setToken(d.token), setOffline(false)))
      .catch(() => alive && setOffline(true));
    return () => {
      alive = false;
    };
  }, []);

  const set = (k: keyof Values) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setValues((v) => ({ ...v, [k]: e.target.value }));
    if (errors[k]) setErrors((er) => ({ ...er, [k]: undefined }));
  };

  // instant, friendly feedback when leaving a field (the server re-validates everything)
  const blur = (k: keyof Values) => () => {
    if (!values[k]) return;
    const r = ContactSchema.shape[k].safeParse(values[k]);
    setErrors((er) => ({ ...er, [k]: r.success ? undefined : r.error.issues[0]?.message }));
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (status === "sending") return;
    const checked = validateContact(values);
    if (!checked.ok) {
      setErrors(checked.errors);
      setStatus("error");
      setNotice("Please fix the highlighted fields.");
      const first = (["name", "email", "subject", "message"] as const).find((k) => checked.errors[k]);
      if (first) refs.current[first]?.focus();
      return;
    }
    setErrors({});
    setStatus("sending");
    setNotice("");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...checked.data, website: honeypot, token }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        setStatus("sent");
        markMessageSent();
        setValues(EMPTY);
        void loadToken();
        return;
      }
      if (data.errors) setErrors(data.errors);
      setNotice(data.error ?? "Something went wrong. Please try again.");
      if (data.code === "token" || data.code === "too-fast") void loadToken();
      setStatus("error");
    } catch {
      setNotice("Couldn't reach the server. Check your connection and try again.");
      setStatus("error");
    }
  }

  if (status === "sent") {
    return (
      <div role="status" className="grid place-items-center rounded-2xl border border-teal-400/30 bg-teal-400/[0.06] px-6 py-10 text-center">
        <CheckCircle2 className="text-teal-300" size={40} />
        <h3 className="mt-3 text-lg font-semibold text-white">Message sent!</h3>
        <p className="mt-1 max-w-sm text-sm text-slate-300">Thanks for reaching out. Farrukh will reply to the email address you provided.</p>
        <button onClick={() => { setStatus("idle"); setNotice(""); }} className="mt-5 rounded-xl bg-white/5 px-4 py-2 text-sm text-slate-200 hover:bg-white/10">Send another message</button>
      </div>
    );
  }

  const field = "w-full rounded-xl border bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-400/50";
  const border = (k: keyof Values) => (errors[k] ? "border-red-400/70" : "border-white/10");
  const err = (k: keyof Values) =>
    errors[k] ? (
      <p id={`err-${k}`} className="mt-1 flex items-center gap-1 text-xs text-red-300">
        <AlertCircle size={12} /> {errors[k]}
      </p>
    ) : null;
  const left = LIMITS.message.max - values.message.length;

  return (
    <form onSubmit={submit} noValidate className="space-y-3.5" aria-describedby="contact-status">
      {offline && (
        <p role="alert" className="rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-200">The contact terminal isn&apos;t connected right now. You can still write your message, but sending is paused.</p>
      )}

      <div className="grid gap-3.5 sm:grid-cols-2">
        <div>
          <label htmlFor="c-name" className="mb-1 block text-xs font-medium text-slate-300">Name</label>
          <input id="c-name" ref={(el) => { refs.current.name = el; }} value={values.name} onChange={set("name")} onBlur={blur("name")} autoComplete="name" maxLength={LIMITS.name.max} aria-invalid={!!errors.name} aria-describedby={errors.name ? "err-name" : undefined} placeholder="Your name" className={`${field} ${border("name")}`} />
          {err("name")}
        </div>
        <div>
          <label htmlFor="c-email" className="mb-1 block text-xs font-medium text-slate-300">Email</label>
          <input id="c-email" ref={(el) => { refs.current.email = el; }} type="email" value={values.email} onChange={set("email")} onBlur={blur("email")} autoComplete="email" maxLength={LIMITS.email.max} aria-invalid={!!errors.email} aria-describedby={errors.email ? "err-email" : undefined} placeholder="you@example.com" className={`${field} ${border("email")}`} />
          {err("email")}
        </div>
      </div>

      <div>
        <label htmlFor="c-subject" className="mb-1 block text-xs font-medium text-slate-300">Subject</label>
        <input id="c-subject" ref={(el) => { refs.current.subject = el; }} value={values.subject} onChange={set("subject")} onBlur={blur("subject")} maxLength={LIMITS.subject.max} aria-invalid={!!errors.subject} aria-describedby={errors.subject ? "err-subject" : undefined} placeholder="What's this about?" className={`${field} ${border("subject")}`} />
        {err("subject")}
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between">
          <label htmlFor="c-message" className="text-xs font-medium text-slate-300">Message</label>
          <span className={`text-[11px] ${left < 100 ? "text-amber-300" : "text-slate-500"}`} aria-live="off">{values.message.length}/{LIMITS.message.max}</span>
        </div>
        <textarea id="c-message" ref={(el) => { refs.current.message = el; }} rows={5} value={values.message} onChange={set("message")} onBlur={blur("message")} maxLength={LIMITS.message.max} aria-invalid={!!errors.message} aria-describedby={errors.message ? "err-message" : undefined} placeholder="Tell me about your project, role or idea…" className={`${field} resize-y ${border("message")}`} />
        {err("message")}
      </div>

      {/* honeypot: invisible to people and screen readers; bots fill it in */}
      <div aria-hidden="true" style={{ position: "absolute", left: "-10000px", width: 1, height: 1, overflow: "hidden" }}>
        <label>Leave this field empty<input tabIndex={-1} autoComplete="off" name="website" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} /></label>
      </div>

      <div id="contact-status" role="status" aria-live="polite" className="min-h-5">
        {status === "error" && notice && <p className="flex items-center gap-1.5 text-sm text-red-300"><AlertCircle size={14} /> {notice}</p>}
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] text-slate-500">Your message goes straight to Farrukh&apos;s inbox. It is not stored on this site.</p>
        <button type="submit" disabled={status === "sending" || offline || !token} className="flex shrink-0 items-center gap-2 rounded-xl bg-teal-400/25 px-5 py-2.5 text-sm font-medium text-teal-100 transition hover:bg-teal-400/40 disabled:cursor-not-allowed disabled:opacity-50">
          {status === "sending" ? <><Loader2 size={15} className="animate-spin" /> Sending…</> : <><Send size={15} /> Send message</>}
        </button>
      </div>
    </form>
  );
}
