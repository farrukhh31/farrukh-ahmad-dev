"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Lang } from "./chatCopy";
import { cleanForSpeech } from "./chatUtils";

interface RecResult {
  isFinal: boolean;
  0: { transcript: string };
}
interface RecEvent {
  resultIndex: number;
  results: ArrayLike<RecResult>;
}
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: RecEvent) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
}
type RecognitionCtor = new () => Recognition;

function getRecognition(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const locale = (lang: Lang) => (lang === "ur" ? "ur-PK" : "en-US");

/** Microphone input that shows what you're saying while you say it, then sends it. */
export function useVoiceInput(lang: Lang, onFinal: (text: string) => void) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const rec = useRef<Recognition | null>(null);
  const heard = useRef("");
  const onFinalRef = useRef(onFinal);

  useEffect(() => {
    onFinalRef.current = onFinal;
  }, [onFinal]);

  useEffect(() => {
    setSupported(getRecognition() !== null); // after mount, so server and client markup match
    return () => {
      try {
        rec.current?.abort();
      } catch {
        /* already stopped */
      }
    };
  }, []);

  const stop = useCallback(() => {
    try {
      rec.current?.stop();
    } catch {
      /* already stopped */
    }
  }, []);

  const toggle = useCallback(() => {
    if (listening) {
      stop();
      return;
    }
    const Ctor = getRecognition();
    if (!Ctor) return;
    try {
      const r = new Ctor();
      r.lang = locale(lang);
      r.continuous = false;
      r.interimResults = true;
      r.maxAlternatives = 1;
      heard.current = "";
      r.onresult = (e) => {
        let text = "";
        for (let i = 0; i < e.results.length; i++) text += e.results[i][0].transcript;
        heard.current = text.trim();
        setInterim(heard.current);
      };
      r.onend = () => {
        setListening(false);
        setInterim("");
        const text = heard.current;
        heard.current = "";
        if (text) onFinalRef.current(text);
      };
      r.onerror = () => {
        heard.current = "";
        setListening(false);
        setInterim("");
      };
      rec.current = r;
      setListening(true);
      r.start();
    } catch {
      setListening(false);
    }
  }, [lang, listening, stop]);

  return { supported, listening, interim, toggle, stop };
}

/** Read an answer aloud. Only one answer speaks at a time. */
export function useSpeaker(lang: Lang) {
  const [supported, setSupported] = useState(false);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const own = useRef(false);

  useEffect(() => {
    setSupported(typeof window !== "undefined" && "speechSynthesis" in window);
    return () => {
      if (own.current) window.speechSynthesis?.cancel();
    };
  }, []);

  const stop = useCallback(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    own.current = false;
    setSpeakingId(null);
  }, []);

  const speak = useCallback(
    (id: string, text: string) => {
      if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
      if (speakingId === id) {
        stop();
        return;
      }
      window.speechSynthesis.cancel();
      const clean = cleanForSpeech(text);
      if (!clean) return;
      const u = new SpeechSynthesisUtterance(clean);
      u.lang = locale(lang);
      u.rate = lang === "ur" ? 0.95 : 1;
      const voice = window.speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith(lang));
      if (voice) u.voice = voice;
      u.onend = () => {
        own.current = false;
        setSpeakingId((cur) => (cur === id ? null : cur));
      };
      u.onerror = u.onend;
      own.current = true;
      setSpeakingId(id);
      window.speechSynthesis.speak(u);
    },
    [lang, speakingId, stop],
  );

  return { supported, speakingId, speak, stop };
}
