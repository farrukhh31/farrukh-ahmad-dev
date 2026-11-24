"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  Bot,
  Check,
  ChevronDown,
  Copy,
  CornerDownLeft,
  ExternalLink,
  MessageSquare,
  Mic,
  MicOff,
  Minimize2,
  RotateCcw,
  Send,
  Sparkles,
  Volume2,
  VolumeX,
  X,
  Compass,
} from "lucide-react";
import { isZoneId, travelToZone } from "@/lib/game/travel";
import { ZONE_BY_ID, ZoneId } from "@/lib/game/zones";
import { track } from "@/lib/analytics/client";

export type Lang = "en" | "ur";

export interface SourceCitation {
  title: string;
  doc: string;
  zone: string;
  snippet: string;
  score: number;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: SourceCitation[];
  error?: boolean;
  followUps?: string[];
  timestamp?: number;
}

const ZONE_TO_SECTION_MAP: Record<string, string> = {
  projects: "projects",
  skills: "skills",
  quest: "experience",
  experience: "experience",
  trophy: "certificates",
  certificates: "certificates",
  about: "about",
  plaza: "about",
  comms: "contact",
  hire: "contact",
  contact: "contact",
  resume: "about",
  cinema: "projects",
};

const COPY = {
  en: {
    title: "Farrukh AI",
    badge: "Portfolio Assistant",
    status: "Online",
    welcomeTitle: "Farrukh's AI Assistant",
    welcome:
      "Hi! I'm Farrukh's portfolio assistant. Ask me about his projects, technical skills, game development, Unity/C#, React, DevOps, internships, or contact info.",
    placeholder: "Ask about Farrukh's portfolio…",
    send: "Send message",
    thinking: "Analyzing portfolio data…",
    promptsTitle: "Suggested Questions",
    prompts: [
      "What are Farrukh's top projects?",
      "What technologies and tech stack does he use?",
      "Tell me about his game dev & Unity experience",
      "What internships and work experience does he have?",
    ],
    error: "Sorry, I couldn't connect. Please try again.",
    clear: "Clear chat",
    clearConfirm: "Clear entire conversation?",
    cancel: "Cancel",
    confirm: "Clear",
    copied: "Copied!",
    copy: "Copy text",
    sourcePrefix: "Source",
    exploreSection: "Explore",
    fastTravel: "Fast travel",
    listen: "Read aloud",
    stop: "Stop audio",
    mic: "Voice input",
    micListening: "Listening… speak now",
    micStop: "Stop listening",
    unsupportedVoice: "Voice input is not supported in this browser.",
    retry: "Retry question",
    followUpsTitle: "Related questions",
    charCount: "/ 500",
    enterHint: "Enter to send · Shift+Enter for new line",
    closeAria: "Close Farrukh AI Assistant",
    minimizeAria: "Minimize Farrukh AI Assistant",
    launcherAria: "Open Farrukh AI Assistant",
    launcherTooltip: "Chat with Farrukh AI",
    scrollDown: "Latest message",
  },
  ur: {
    title: "فرخ AI",
    badge: "پورٹ فولیو اسسٹنٹ",
    status: "آن لائن",
    welcomeTitle: "فرخ کے AI اسسٹنٹ میں خوش آمدید",
    welcome:
      "السلام علیکم! میں فرخ کا AI پورٹ فولیو اسسٹنٹ ہوں۔ ان کے پروجیکٹس، مہارتوں، گیم ڈویلپمنٹ، یونیٹی، ری ایکٹ، ڈیواپس، انٹرن شپس یا رابطے کے بارے میں کچھ بھی پوچھیں۔",
    placeholder: "فرخ کے پورٹ فولیو کے بارے میں پوچھیں…",
    send: "پیغام بھیجیں",
    thinking: "پورٹ فولیو کا جائزہ لیا جا رہا ہے…",
    promptsTitle: "تجویز کردہ سوالات",
    prompts: [
      "فرخ کے اہم پروجیکٹس کون سے ہیں؟",
      "وہ کون سی ٹیکنالوجیز استعمال کرتے ہیں؟",
      "گیم ڈویلپمنٹ اور یونیٹی کا تجربہ بتائیں",
      "ان کی انٹرن شپس اور عملی تجربہ کیا ہے؟",
    ],
    error: "معذرت، رابطہ نہیں ہو سکا۔ براہِ کرم دوبارہ کوشش کریں۔",
    clear: "چیٹ صاف کریں",
    clearConfirm: "کیا آپ پوری گفتگو صاف کرنا چاہتے ہیں؟",
    cancel: "منسوخ",
    confirm: "صاف کریں",
    copied: "کاپی ہو گیا!",
    copy: "کاپی کریں",
    sourcePrefix: "ماخذ",
    exploreSection: "سیکشن دیکھیں",
    fastTravel: "وہاں جائیں",
    listen: "سنیں",
    stop: "روکیں",
    mic: "بول کر پوچھیں",
    micListening: "سن رہا ہوں… اب بولیں",
    micStop: "سننا بند کریں",
    unsupportedVoice: "اس براؤزر میں وائس ریکگنیشن دستیاب نہیں ہے۔",
    retry: "دوبارہ کوشش کریں",
    followUpsTitle: "متعلقہ سوالات",
    charCount: "/ 500",
    enterHint: "بھیجنے کے لیے Enter · نئی لائن کے لیے Shift+Enter",
    closeAria: "چیٹ بند کریں",
    minimizeAria: "چیٹ سکیڑیں",
    launcherAria: "فرخ AI چیٹ کھولیں",
    launcherTooltip: "فرخ AI سے بات کریں",
    scrollDown: "تازہ ترین پیغامات",
  },
} as const;

function generateFollowUps(answer: string, lang: Lang): string[] {
  const lower = answer.toLowerCase();
  if (lang === "ur") {
    if (lower.includes("unity") || lower.includes("game") || lower.includes("mask") || lower.includes("گیم")) {
      return [
        "انہوں نے کون سی گیمز بنائی ہیں؟",
        "ان کی بنیادی تکنیکی مہارتیں کیا ہیں؟",
        "فرخ سے رابطہ کیسے کریں؟",
      ];
    }
    if (lower.includes("docker") || lower.includes("devops") || lower.includes("react") || lower.includes("next")) {
      return [
        "کیا ان کے پاس صنعتی تجربہ ہے؟",
        "ان کے سرٹیفکیٹس دکھائیں",
        "ان کے اہم پروجیکٹس بتائیں",
      ];
    }
    if (lower.includes("intern") || lower.includes("educative") || lower.includes("devsinc") || lower.includes("تجربہ")) {
      return [
        "ان کی اہم ذمہ داریاں کیا تھیں؟",
        "ان کی تعلیمی قابلیت کیا ہے؟",
        "گٹ ہب اور لائیو لنکس دکھائیں",
      ];
    }
    return [
      "اہم پروجیکٹس کی تفصیل بتائیں",
      "ان کا مکمل ٹیک اسٹیک کیا ہے؟",
      "فرخ سے رابطہ کیسے کریں؟",
    ];
  } else {
    if (lower.includes("unity") || lower.includes("game") || lower.includes("mask") || lower.includes("ragdoll")) {
      return [
        "What game engines & tools does he use?",
        "Tell me about his other projects",
        "How can I contact Farrukh?",
      ];
    }
    if (lower.includes("docker") || lower.includes("devops") || lower.includes("react") || lower.includes("next") || lower.includes("fastapi")) {
      return [
        "What are his core technical skills?",
        "Does he have production work experience?",
        "Show me his certifications",
      ];
    }
    if (lower.includes("intern") || lower.includes("educative") || lower.includes("devsinc") || lower.includes("experience")) {
      return [
        "What were his key achievements there?",
        "What is his educational background?",
        "Explore his featured projects",
      ];
    }
    return [
      "Tell me about his top projects",
      "What is his full tech stack?",
      "How can recruiters contact him?",
    ];
  }
}

function cleanForSpeech(text: string): string {
  return text
    .replace(/<[^>]*>/g, "")
    .replace(/[*_#`~[\]]/g, "")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

interface SpeechRecognitionEvent {
  results: {
    [index: number]: {
      [index: number]: {
        transcript: string;
      };
    };
  };
}

interface SpeechRecognitionInstance {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: unknown) => void) | null;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

function getSpeechRecognition(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export default function FloatingChat() {
  const pathname = usePathname();
  const isGameRoute = pathname === "/play";

  const [lang, setLang] = useState<Lang>("en");
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [unreadCount, setUnreadCount] = useState(1);
  const [userScrolledUp, setUserScrolledUp] = useState(false);

  const logRef = useRef<HTMLDivElement>(null);
  const recRef = useRef<SpeechRecognitionInstance | null>(null);
  const lastQuestion = useRef("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const t = COPY[lang];

  // Auto-scroll when messages or busy state changes
  useEffect(() => {
    if (open && !userScrolledUp && logRef.current) {
      logRef.current.scrollTo({
        top: logRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [msgs, busy, open, userScrolledUp]);

  // Handle user scroll detection
  const handleScroll = () => {
    if (!logRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = logRef.current;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 70;
    setUserScrolledUp(!isNearBottom);
  };

  const scrollToBottom = () => {
    if (logRef.current) {
      logRef.current.scrollTo({
        top: logRef.current.scrollHeight,
        behavior: "smooth",
      });
      setUserScrolledUp(false);
    }
  };

  // Cleanup speech synthesis & recognition on unmount
  useEffect(() => {
    return () => {
      try {
        recRef.current?.abort();
      } catch {
        // noop
      }
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Clear unread badge when opened
  const toggleOpen = () => {
    setOpen((prev) => {
      if (!prev) setUnreadCount(0);
      return !prev;
    });
  };

  // Speak assistant response
  const speakAnswer = (id: string, text: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

    if (speakingId === id) {
      window.speechSynthesis.cancel();
      setSpeakingId(null);
      return;
    }

    window.speechSynthesis.cancel();
    const cleanText = cleanForSpeech(text);
    if (!cleanText) return;

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = lang === "ur" ? "ur-PK" : "en-US";
    utterance.rate = lang === "ur" ? 0.95 : 1.0;
    utterance.pitch = 1.0;

    utterance.onend = () => setSpeakingId(null);
    utterance.onerror = () => setSpeakingId(null);

    setSpeakingId(id);
    window.speechSynthesis.speak(utterance);
  };

  const stopAudio = () => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setSpeakingId(null);
  };

  // Copy message text
  const copyMessage = (id: string, content: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      void navigator.clipboard.writeText(content);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  // Send question to backend API
  const send = useCallback(
    async (raw: string) => {
      const question = raw.trim();
      if (!question || busy) return;

      lastQuestion.current = question;
      const history = msgs
        .filter((m) => !m.error)
        .slice(-8)
        .map((m) => ({ role: m.role, content: m.content }));

      const userMsgId = `user-${Date.now()}`;
      setMsgs((m) => [
        ...m,
        { id: userMsgId, role: "user", content: question, timestamp: Date.now() },
      ]);
      setInput("");
      setBusy(true);
      setUserScrolledUp(false);
      track("oracle", lang);

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ message: question, history, lang }),
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data?.error || COPY[lang].error);
        }

        const assistantMsgId = `asst-${Date.now()}`;
        const followUps = generateFollowUps(data.answer, lang);

        setMsgs((m) => [
          ...m,
          {
            id: assistantMsgId,
            role: "assistant",
            content: data.answer,
            sources: data.sources,
            followUps,
            timestamp: Date.now(),
          },
        ]);

        if (!open) {
          setUnreadCount((c) => c + 1);
        }
      } catch (e) {
        const errorMsgId = `err-${Date.now()}`;
        setMsgs((m) => [
          ...m,
          {
            id: errorMsgId,
            role: "assistant",
            content: e instanceof Error ? e.message : COPY[lang].error,
            error: true,
            timestamp: Date.now(),
          },
        ]);
      } finally {
        setBusy(false);
      }
    },
    [busy, lang, msgs, open]
  );

  // Toggle voice recognition
  const toggleVoice = () => {
    const SpeechCtor = getSpeechRecognition();
    if (!SpeechCtor) {
      const errorMsgId = `voice-err-${Date.now()}`;
      setMsgs((m) => [
        ...m,
        {
          id: errorMsgId,
          role: "assistant",
          content: t.unsupportedVoice,
          error: true,
          timestamp: Date.now(),
        },
      ]);
      return;
    }

    if (listening) {
      try {
        recRef.current?.stop();
      } catch {
        // noop
      }
      setListening(false);
      return;
    }

    try {
      const recognizer = new SpeechCtor();
      recognizer.lang = lang === "ur" ? "ur-PK" : "en-US";
      recognizer.continuous = false;
      recognizer.interimResults = false;
      recognizer.maxAlternatives = 1;

      recognizer.onresult = (e: SpeechRecognitionEvent) => {
        const heard = e.results[0]?.[0]?.transcript?.trim() || "";
        if (heard) {
          void send(heard);
        }
        setListening(false);
      };

      recognizer.onend = () => setListening(false);
      recognizer.onerror = () => setListening(false);

      recRef.current = recognizer;
      setListening(true);
      recognizer.start();
    } catch {
      setListening(false);
    }
  };

  // Clear conversation
  const clearChat = () => {
    setMsgs([]);
    setInput("");
    setShowClearConfirm(false);
    stopAudio();
  };

  // Navigate to section or fast-travel in game
  const handleSourceClick = (zone: string) => {
    if (isGameRoute) {
      if (isZoneId(zone)) {
        travelToZone(zone as ZoneId);
      }
    } else {
      const sectionId = ZONE_TO_SECTION_MAP[zone.toLowerCase()] || zone.toLowerCase();
      const el = document.getElementById(sectionId);
      if (el) {
        el.scrollIntoView({ behavior: "smooth" });
      }
    }
  };

  // Switch language handler
  const handleLanguageSwitch = (newLang: Lang) => {
    if (newLang === lang) return;
    setLang(newLang);
    stopAudio();
    if (listening) {
      try {
        recRef.current?.stop();
      } catch {
        // noop
      }
      setListening(false);
    }
  };

  return (
    <div
      className={`fixed z-[100] ${
        isGameRoute
          ? "bottom-[13.5rem] right-3 sm:right-6"
          : "bottom-5 right-5 sm:bottom-6 sm:right-6"
      }`}
      onKeyDown={(e) => e.stopPropagation()}
      onKeyUp={(e) => e.stopPropagation()}
      onKeyPress={(e) => e.stopPropagation()}
    >
      <AnimatePresence>
        {open && (
          <motion.section
            initial={{ opacity: 0, y: 24, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 18, scale: 0.95 }}
            transition={{ type: "spring", damping: 25, stiffness: 320 }}
            dir={lang === "ur" ? "rtl" : "ltr"}
            className="mb-3 flex h-[min(670px,calc(100dvh-100px))] w-[min(420px,calc(100vw-24px))] flex-col overflow-hidden rounded-[26px] border border-violet-500/30 bg-[#080c1d]/95 shadow-[0_25px_90px_rgba(0,0,0,0.8),0_0_35px_rgba(139,92,246,0.22)] backdrop-blur-2xl"
            role="dialog"
            aria-label={t.title}
          >
            {/* Header */}
            <header className="relative flex items-center justify-between border-b border-white/[0.08] bg-gradient-to-r from-violet-600/20 via-[#0e1329] to-cyan-500/10 px-4 py-3.5">
              <div className="flex items-center gap-3">
                <div className="relative grid h-10 w-10 place-items-center rounded-2xl border border-violet-400/30 bg-gradient-to-br from-violet-500/30 via-purple-600/20 to-cyan-400/20 text-violet-200 shadow-inner">
                  <Bot size={20} className="drop-shadow-[0_0_8px_rgba(167,139,250,0.6)]" />
                  <span
                    className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#080c1d] bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]"
                    title={t.status}
                  />
                </div>
                <div>
                  <div className="flex items-center gap-1.5 font-bold tracking-tight text-white">
                    <span>{t.title}</span>
                    <span className="rounded-full bg-violet-500/20 px-2 py-0.5 text-[10px] font-medium text-violet-300 border border-violet-500/30">
                      {t.badge}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    <span>{t.status}</span>
                  </div>
                </div>
              </div>

              {/* Language Switcher & Controls */}
              <div className="flex items-center gap-1.5" dir="ltr">
                <div className="flex rounded-xl border border-white/10 bg-black/40 p-0.5 text-[11px] shadow-inner">
                  <button
                    type="button"
                    onClick={() => handleLanguageSwitch("en")}
                    aria-pressed={lang === "en"}
                    className={`rounded-lg px-2.5 py-1 font-medium transition-all ${
                      lang === "en"
                        ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md shadow-violet-900/40"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    EN
                  </button>
                  <button
                    type="button"
                    onClick={() => handleLanguageSwitch("ur")}
                    aria-pressed={lang === "ur"}
                    className={`rounded-lg px-2.5 py-1 font-medium transition-all ${
                      lang === "ur"
                        ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md shadow-violet-900/40"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    اردو
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setShowClearConfirm(true)}
                  title={t.clear}
                  aria-label={t.clear}
                  className="grid h-8 w-8 place-items-center rounded-xl border border-white/5 text-slate-400 transition hover:bg-white/10 hover:text-white"
                >
                  <RotateCcw size={14} />
                </button>

                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  title={t.minimizeAria}
                  aria-label={t.minimizeAria}
                  className="grid h-8 w-8 place-items-center rounded-xl border border-white/5 text-slate-400 transition hover:bg-white/10 hover:text-white"
                >
                  <Minimize2 size={14} />
                </button>
              </div>

              {/* Inline Clear Confirmation */}
              <AnimatePresence>
                {showClearConfirm && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="absolute inset-x-0 bottom-0 top-0 z-20 flex items-center justify-between bg-[#0b0f24] px-4 py-2 border-b border-violet-500/30"
                  >
                    <span className="text-xs font-medium text-slate-200">
                      {t.clearConfirm}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setShowClearConfirm(false)}
                        className="rounded-lg px-2.5 py-1 text-xs text-slate-400 hover:bg-white/5 hover:text-white"
                      >
                        {t.cancel}
                      </button>
                      <button
                        type="button"
                        onClick={clearChat}
                        className="rounded-lg bg-rose-500/20 border border-rose-500/40 px-2.5 py-1 text-xs font-medium text-rose-200 hover:bg-rose-500/30"
                      >
                        {t.confirm}
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </header>

            {/* Conversation Messages */}
            <div
              ref={logRef}
              onScroll={handleScroll}
              className={`min-h-0 flex-1 space-y-3.5 overflow-y-auto p-4 custom-scrollbar ${
                lang === "ur" ? "text-right" : "text-left"
              }`}
              role="log"
              aria-live="polite"
            >
              {/* Empty / Welcome State */}
              {!msgs.length && (
                <div className="space-y-4 pt-2">
                  <div className="flex items-center gap-3 rounded-2xl border border-violet-500/20 bg-gradient-to-br from-violet-500/10 via-purple-600/5 to-cyan-500/5 p-4 backdrop-blur-md">
                    <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-violet-500/30 to-indigo-600/20 text-violet-300 border border-violet-400/20 shadow-md">
                      <Sparkles size={22} className="drop-shadow-[0_0_8px_rgba(167,139,250,0.7)]" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-white text-sm">
                        {t.welcomeTitle}
                      </h4>
                      <p className="mt-1 text-xs leading-relaxed text-slate-300">
                        {t.welcome}
                      </p>
                    </div>
                  </div>

                  <div>
                    <div className="mb-2.5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      <MessageSquare size={13} className="text-violet-400" />
                      <span>{t.promptsTitle}</span>
                    </div>
                    <div className="flex flex-col gap-2">
                      {t.prompts.map((prompt) => (
                        <button
                          key={prompt}
                          type="button"
                          onClick={() => void send(prompt)}
                          className="group flex items-center justify-between rounded-xl border border-violet-400/15 bg-white/[0.03] px-3.5 py-2.5 text-xs leading-relaxed text-slate-200 transition-all hover:border-violet-400/40 hover:bg-violet-500/10 hover:text-white"
                        >
                          <span className="text-start">{prompt}</span>
                          <CornerDownLeft
                            size={12}
                            className="opacity-0 transition-opacity group-hover:opacity-100 text-violet-300 shrink-0"
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Messages list */}
              {msgs.map((m) => (
                <div
                  key={m.id}
                  className={`flex flex-col gap-1.5 ${
                    m.role === "user" ? "items-end" : "items-start"
                  }`}
                >
                  <div
                    className={`max-w-[88%] rounded-2xl px-4 py-3 text-[13px] leading-relaxed transition-all shadow-md ${
                      m.role === "user"
                        ? "rounded-tr-xs bg-gradient-to-br from-violet-600 to-indigo-600 text-white shadow-violet-950/40"
                        : m.error
                        ? "rounded-tl-xs border border-rose-500/30 bg-rose-500/10 text-rose-200"
                        : "rounded-tl-xs border border-white/[0.09] bg-white/[0.045] text-slate-100 backdrop-blur-md"
                    }`}
                  >
                    <p className="whitespace-pre-wrap font-normal">{m.content}</p>

                    {/* Sources / Citations */}
                    {m.sources && m.sources.length > 0 && (
                      <div className="mt-3 border-t border-white/[0.08] pt-2.5" dir="ltr">
                        <div className="flex flex-wrap gap-1.5">
                          {m.sources.map((s) => {
                            const zoneName = isZoneId(s.zone)
                              ? ZONE_BY_ID[s.zone as ZoneId]?.name || s.zone
                              : s.zone;
                            return (
                              <button
                                key={s.title}
                                type="button"
                                onClick={() => handleSourceClick(s.zone)}
                                title={s.snippet}
                                className="group inline-flex items-center gap-1.5 rounded-full border border-cyan-400/25 bg-cyan-500/10 px-2.5 py-1 text-[11px] font-medium text-cyan-200 transition-all hover:border-cyan-400/50 hover:bg-cyan-500/20 hover:text-white"
                              >
                                {isGameRoute ? (
                                  <Compass size={11} className="text-cyan-400" />
                                ) : (
                                  <ExternalLink size={11} className="text-cyan-400" />
                                )}
                                <span>{s.title}</span>
                                <span className="opacity-70 text-[10px]">· {zoneName}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Assistant Message Actions (Copy & Read Aloud) */}
                    {m.role === "assistant" && !m.error && (
                      <div
                        className="mt-2.5 flex items-center justify-between border-t border-white/[0.06] pt-2"
                        dir="ltr"
                      >
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => copyMessage(m.id, m.content)}
                            title={t.copy}
                            aria-label={t.copy}
                            className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] text-slate-400 transition hover:bg-white/10 hover:text-slate-100"
                          >
                            {copiedId === m.id ? (
                              <>
                                <Check size={12} className="text-emerald-400" />
                                <span className="text-emerald-400">{t.copied}</span>
                              </>
                            ) : (
                              <>
                                <Copy size={12} />
                                <span>{t.copy}</span>
                              </>
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => speakAnswer(m.id, m.content)}
                            title={speakingId === m.id ? t.stop : t.listen}
                            aria-label={speakingId === m.id ? t.stop : t.listen}
                            className={`flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] transition ${
                              speakingId === m.id
                                ? "bg-violet-500/25 text-violet-200"
                                : "text-slate-400 hover:bg-white/10 hover:text-slate-100"
                            }`}
                          >
                            {speakingId === m.id ? (
                              <>
                                <VolumeX size={12} className="text-rose-400" />
                                <span className="text-rose-300">{t.stop}</span>
                              </>
                            ) : (
                              <>
                                <Volume2 size={12} />
                                <span>{t.listen}</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Retry Button on Error */}
                    {m.error && (
                      <button
                        type="button"
                        onClick={() => void send(lastQuestion.current)}
                        className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg border border-violet-400/30 bg-violet-500/10 px-2.5 py-1 text-[11px] font-medium text-violet-200 transition hover:bg-violet-500/20 hover:text-white"
                      >
                        <RotateCcw size={12} />
                        <span>{t.retry}</span>
                      </button>
                    )}
                  </div>

                  {/* Context-Aware Follow-Up Chips */}
                  {m.role === "assistant" &&
                    !m.error &&
                    m.followUps &&
                    m.followUps.length > 0 &&
                    m.id === msgs[msgs.length - 1]?.id && (
                      <div className="mt-1 flex max-w-[90%] flex-wrap gap-1.5">
                        {m.followUps.map((chip) => (
                          <button
                            key={chip}
                            type="button"
                            onClick={() => void send(chip)}
                            className="inline-flex items-center gap-1 rounded-full border border-violet-400/20 bg-violet-500/[0.07] px-3 py-1.5 text-xs text-violet-200 transition-all hover:border-violet-400/40 hover:bg-violet-500/20 hover:text-white"
                          >
                            <span>{chip}</span>
                            <CornerDownLeft size={10} className="opacity-70" />
                          </button>
                        ))}
                      </div>
                    )}
                </div>
              ))}

              {/* Smart Typing Indicator */}
              {busy && (
                <div className="flex items-center gap-2.5 rounded-2xl border border-white/[0.08] bg-white/[0.035] px-4 py-2.5 text-xs text-slate-300 backdrop-blur-md w-fit">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 animate-bounce rounded-full bg-violet-400 shadow-[0_0_8px_rgba(167,139,250,0.8)]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-indigo-400 [animation-delay:150ms] shadow-[0_0_8px_rgba(129,140,248,0.8)]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-cyan-400 [animation-delay:300ms] shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
                  </span>
                  <span className="font-medium text-slate-300">{t.thinking}</span>
                </div>
              )}
            </div>

            {/* Scroll Down Floating Indicator */}
            {userScrolledUp && (
              <div className="relative px-4">
                <button
                  type="button"
                  onClick={scrollToBottom}
                  className="absolute -top-10 left-1/2 -translate-x-1/2 flex items-center gap-1.5 rounded-full border border-violet-400/30 bg-[#0d122b]/90 px-3 py-1 text-xs text-violet-200 shadow-lg backdrop-blur-md transition hover:bg-violet-500/20 hover:text-white"
                >
                  <ChevronDown size={14} className="animate-bounce" />
                  <span>{t.scrollDown}</span>
                </button>
              </div>
            )}

            {/* Form Input Bar */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void send(input);
              }}
              className="border-t border-white/[0.08] bg-[#070a18]/80 p-3.5 backdrop-blur-md"
              dir="ltr"
            >
              <div className="flex items-end gap-2">
                {/* Voice Recognition Button */}
                <button
                  type="button"
                  onClick={toggleVoice}
                  title={listening ? t.micStop : t.mic}
                  aria-label={listening ? t.micStop : t.mic}
                  className={`relative grid h-10 w-10 shrink-0 place-items-center rounded-xl border transition-all ${
                    listening
                      ? "border-rose-400/60 bg-rose-500/20 text-rose-200 shadow-[0_0_15px_rgba(244,63,94,0.4)]"
                      : "border-white/10 bg-white/[0.04] text-slate-400 hover:border-violet-400/40 hover:text-white"
                  }`}
                >
                  {listening ? (
                    <>
                      <MicOff size={16} />
                      <span className="absolute inset-0 animate-ping rounded-xl border border-rose-400/50 opacity-40" />
                    </>
                  ) : (
                    <Mic size={16} />
                  )}
                </button>

                {/* Multiline Textarea */}
                <div className="relative flex-1">
                  <textarea
                    ref={textareaRef}
                    rows={1}
                    maxLength={500}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      e.stopPropagation();
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void send(input);
                      }
                    }}
                    onKeyUp={(e) => e.stopPropagation()}
                    onKeyPress={(e) => e.stopPropagation()}
                    dir={lang === "ur" ? "rtl" : "ltr"}
                    placeholder={listening ? t.micListening : t.placeholder}
                    className="max-h-28 min-h-[42px] w-full resize-none rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-sm text-white outline-none placeholder:text-slate-500 transition focus:border-violet-400/60 focus:bg-white/[0.06] focus:ring-1 focus:ring-violet-400/40"
                  />
                </div>

                {/* Submit / Send Button */}
                <button
                  type="submit"
                  disabled={busy || !input.trim()}
                  title={t.send}
                  aria-label={t.send}
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 text-white shadow-md shadow-violet-900/40 transition-all hover:scale-105 hover:brightness-110 active:scale-95 disabled:pointer-events-none disabled:opacity-40"
                >
                  <Send size={16} className={lang === "ur" ? "rotate-180" : ""} />
                </button>
              </div>

              {/* Bottom Info Bar: Character Count & Shortcut Hint */}
              <div className="mt-2 flex items-center justify-between px-1 text-[10px] text-slate-500">
                <span>{t.enterHint}</span>
                <span>
                  {input.length} {t.charCount}
                </span>
              </div>
            </form>
          </motion.section>
        )}
      </AnimatePresence>

      {/* Floating Launcher Button */}
      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={toggleOpen}
          aria-expanded={open}
          aria-label={open ? t.closeAria : t.launcherAria}
          title={t.launcherTooltip}
          className="group relative grid h-14 w-14 place-items-center rounded-full border border-violet-300/30 bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 text-white shadow-[0_8px_35px_rgba(124,58,237,0.45),0_0_20px_rgba(139,92,246,0.3)] transition-all duration-300 hover:scale-105 hover:shadow-[0_8px_45px_rgba(124,58,237,0.65),0_0_25px_rgba(139,92,246,0.5)] focus-visible:outline-2 focus-visible:outline-cyan-300"
        >
          {/* Ambient Glow Ring */}
          <span className="absolute -inset-1 -z-10 animate-pulse rounded-full bg-gradient-to-r from-violet-600 to-cyan-500 opacity-30 blur-md group-hover:opacity-60 transition duration-500" />

          {open ? (
            <ChevronDown size={24} className="transition-transform group-hover:scale-110" />
          ) : (
            <>
              <Bot size={25} className="drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]" />

              {/* Online Green Status Dot */}
              <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-[#080c1d] bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]" />

              {/* Unread Message / Notification Pulse Badge */}
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-r from-cyan-400 to-blue-500 text-[10px] font-bold text-slate-950 shadow-[0_0_12px_rgba(34,211,238,0.8)] animate-pulse">
                  {unreadCount}
                </span>
              )}
            </>
          )}
        </button>
      </div>
    </div>
  );
}
