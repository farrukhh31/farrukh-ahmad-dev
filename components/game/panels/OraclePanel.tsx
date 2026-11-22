"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bot, Loader2, MapPin, Mic, MicOff, Send, Volume2, VolumeX } from "lucide-react";

import { isZoneId, travelToZone } from "@/lib/game/travel";
import { useGame } from "@/lib/game/store";
import { track } from "@/lib/analytics/client";
import { ZONE_BY_ID, ZoneId } from "@/lib/game/zones";

type Lang = "en" | "ur";
interface Source { title: string; doc: string; zone: string; snippet: string; score: number }
interface Msg { role: "user" | "assistant"; content: string; sources?: Source[]; grounded?: boolean; mode?: string; error?: boolean }

const STRINGS = {
  en: {
    hello: "Hi! I'm Farrukh's portfolio assistant. Ask me about his projects, skills, experience, education or certificates. I only answer from this portfolio, so if something isn't there I'll say so.",
    placeholder: "Ask about Farrukh's work…",
    send: "Send",
    thinking: "Thinking…",
    suggestions: ["What projects has Farrukh built?", "Which skills does he have?", "Tell me about his experience", "What certificates does he have?"],
    goto: "Take me there",
    source: "Source",
    mic: "Speak your question",
    micStop: "Stop listening",
    speak: "Read answers aloud",
    speakOff: "Stop reading aloud",
    tooLong: "Please keep it under 500 characters.",
  },
  ur: {
    hello: "السلام علیکم! میں فرخ کے پورٹ فولیو کا اسسٹنٹ ہوں۔ ان کے پروجیکٹس، مہارتوں، تجربے، تعلیم یا سرٹیفکیٹس کے بارے میں پوچھیں۔",
    placeholder: "فرخ کے کام کے بارے میں پوچھیں…",
    send: "بھیجیں",
    thinking: "سوچ رہا ہوں…",
    suggestions: ["فرخ نے کون سے پروجیکٹس بنائے ہیں؟", "ان کے پاس کون سی مہارتیں ہیں؟", "ان کا تجربہ کیا ہے؟", "ان کے پاس کون سے سرٹیفکیٹس ہیں؟"],
    goto: "وہاں لے چلیں",
    source: "ماخذ",
    mic: "بول کر پوچھیں",
    micStop: "سننا بند کریں",
    speak: "جوابات بلند آواز میں سنیں",
    speakOff: "آواز بند کریں",
    tooLong: "براہِ کرم 500 حروف سے کم رکھیں۔",
  },
} as const;

// Web Speech API (not in lib.dom for all browsers)
interface Recognition {
  lang: string; interimResults: boolean; maxAlternatives: number;
  start(): void; stop(): void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null; onerror: (() => void) | null;
}
type RecognitionCtor = new () => Recognition;
const getRecognition = (): RecognitionCtor | null => {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};

export default function OraclePanel() {
  const [lang, setLang] = useState<Lang>("en");
  const t = STRINGS[lang];
  const [msgs, setMsgs] = useState<Msg[]>([{ role: "assistant", content: STRINGS.en.hello }]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [speakOn, setSpeakOn] = useState(false);
  const log = useRef<HTMLDivElement>(null);
  const rec = useRef<Recognition | null>(null);
  const closePanel = useGame((s) => s.openZonePanel);

  const canListen = useMemo(() => getRecognition() !== null, []);
  const canSpeak = typeof window !== "undefined" && "speechSynthesis" in window;

  useEffect(() => {
    log.current?.scrollTo({ top: log.current.scrollHeight, behavior: "smooth" });
  }, [msgs, busy]);

  useEffect(() => () => { rec.current?.stop(); if (typeof window !== "undefined") window.speechSynthesis?.cancel(); }, []);

  const speak = useCallback((text: string, l: Lang) => {
    if (!canSpeak) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = l === "ur" ? "ur-PK" : "en-US";
    window.speechSynthesis.speak(u);
  }, [canSpeak]);

  const send = useCallback(async (raw: string) => {
    const text = raw.trim();
    if (!text || busy) return;
    if (text.length > 500) {
      setMsgs((m) => [...m, { role: "assistant", content: t.tooLong, error: true }]);
      return;
    }
    const history = msgs.filter((m) => !m.error).slice(-6).map((m) => ({ role: m.role, content: m.content }));
    setMsgs((m) => [...m, { role: "user", content: text }]);
    track("oracle", lang); // language only - never the question
    setInput("");
    setBusy(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: text, history, lang }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Something went wrong.");
      setMsgs((m) => [...m, { role: "assistant", content: data.answer, sources: data.sources, grounded: data.grounded, mode: data.mode }]);
      if (speakOn) speak(data.answer, lang);
    } catch (e) {
      setMsgs((m) => [...m, { role: "assistant", content: e instanceof Error ? e.message : "Something went wrong.", error: true }]);
    } finally {
      setBusy(false);
    }
  }, [busy, lang, msgs, speak, speakOn, t.tooLong]);

  const toggleMic = () => {
    const Ctor = getRecognition();
    if (!Ctor) return;
    if (listening) { rec.current?.stop(); return; }
    const r = new Ctor();
    r.lang = lang === "ur" ? "ur-PK" : "en-US";
    r.interimResults = false;
    r.maxAlternatives = 1;
    r.onresult = (e) => {
      const said = e.results[0]?.[0]?.transcript ?? "";
      if (said) void send(said);
    };
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    rec.current = r;
    setListening(true);
    r.start();
  };

  const switchLang = (l: Lang) => {
    setLang(l);
    setMsgs((m) => (m.length === 1 ? [{ role: "assistant", content: STRINGS[l].hello }] : m));
  };

  const goto = (zone: string) => {
    if (!isZoneId(zone)) return;
    closePanel(null);
    travelToZone(zone as ZoneId);
  };

  const iconBtn = "grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/5 text-slate-300 transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-violet-300";

  return (
    <div className="flex h-[min(62vh,30rem)] flex-col" dir={lang === "ur" ? "rtl" : "ltr"}>
      <div className="mb-3 flex items-center justify-between gap-2" dir="ltr">
        <div className="flex rounded-xl border border-white/10 bg-white/5 p-0.5 text-xs" role="group" aria-label="Language">
          {(["en", "ur"] as Lang[]).map((l) => (
            <button key={l} onClick={() => switchLang(l)} aria-pressed={lang === l} className={`rounded-lg px-3 py-1.5 font-medium transition ${lang === l ? "bg-violet-500/30 text-violet-100" : "text-slate-400 hover:text-white"}`}>
              {l === "en" ? "English" : "اردو"}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-slate-500">Answers come only from Farrukh&apos;s portfolio</p>
      </div>

      <div ref={log} role="log" aria-live="polite" aria-label="Chat messages" className="min-h-0 flex-1 space-y-3 overflow-y-auto rounded-2xl border border-white/10 bg-black/25 p-3">
        {msgs.map((m, i) => (
          <div key={i} className={`flex gap-2.5 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
            {m.role === "assistant" && <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-violet-500/20 text-violet-300"><Bot size={14} /></span>}
            <div className={`max-w-[85%] ${m.role === "user" ? "items-end" : ""}`}>
              <p className={`whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${m.role === "user" ? "rounded-tr-sm bg-violet-500/30 text-white" : m.error ? "rounded-tl-sm bg-red-500/15 text-red-200" : "rounded-tl-sm bg-white/[0.06] text-slate-200"}`}>
                {m.content}
              </p>
              {m.sources && m.sources.length > 0 && (
                <ul className="mt-1.5 flex flex-wrap gap-1.5" dir="ltr" aria-label="Sources">
                  {m.sources.map((s) => {
                    const known = isZoneId(s.zone);
                    return (
                      <li key={s.title}>
                        <button disabled={!known} onClick={() => goto(s.zone)} title={s.snippet} className="flex items-center gap-1.5 rounded-full border border-violet-400/30 bg-violet-400/10 px-2.5 py-1 text-[11px] text-violet-200 transition hover:bg-violet-400/20 disabled:opacity-60">
                          <MapPin size={11} />
                          <span className="max-w-[16rem] truncate">{t.source}: {s.title}</span>
                          {known && <span className="text-violet-300/80">· {ZONE_BY_ID[s.zone as ZoneId].name} →</span>}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
              {m.mode === "extractive" && m.grounded && m.sources?.length ? <p className="mt-1 text-[10px] text-slate-600" dir="ltr">Quoted directly from the portfolio (AI model not connected)</p> : null}
            </div>
          </div>
        ))}
        {busy && (
          <div className="flex items-center gap-2 text-xs text-slate-400"><Loader2 size={14} className="animate-spin" /> {t.thinking}</div>
        )}
        {msgs.length === 1 && !busy && (
          <div className="flex flex-wrap gap-2 pt-1">
            {t.suggestions.map((s) => (
              <button key={s} onClick={() => void send(s)} className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300 transition hover:bg-white/10">{s}</button>
            ))}
          </div>
        )}
      </div>

      <form onSubmit={(e) => { e.preventDefault(); void send(input); }} className="mt-3 flex items-center gap-2" dir="ltr">
        {canListen && (
          <button type="button" onClick={toggleMic} aria-pressed={listening} aria-label={listening ? t.micStop : t.mic} className={`${iconBtn} ${listening ? "!border-red-400/60 !bg-red-500/20 !text-red-200" : ""}`}>
            {listening ? <MicOff size={15} /> : <Mic size={15} />}
          </button>
        )}
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          maxLength={500}
          dir={lang === "ur" ? "rtl" : "ltr"}
          placeholder={t.placeholder}
          aria-label={t.placeholder}
          className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-violet-400/60 focus:outline-none"
        />
        {canSpeak && (
          <button type="button" onClick={() => { if (speakOn) window.speechSynthesis.cancel(); setSpeakOn((v) => !v); }} aria-pressed={speakOn} aria-label={speakOn ? t.speakOff : t.speak} className={iconBtn}>
            {speakOn ? <Volume2 size={15} /> : <VolumeX size={15} />}
          </button>
        )}
        <button type="submit" disabled={busy || !input.trim()} aria-label={t.send} className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-violet-500/40 text-violet-100 transition hover:bg-violet-500/60 disabled:opacity-40">
          <Send size={15} />
        </button>
      </form>
    </div>
  );
}
