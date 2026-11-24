"use client";

import { create } from "zustand";
import { track } from "@/lib/analytics/client";
import { COPY, type Lang } from "./chatCopy";
import { generateFollowUps, uid } from "./chatUtils";

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
  timestamp: number;
  sources?: SourceCitation[];
  followUps?: string[];
  grounded?: boolean;
  mode?: string;
  error?: boolean;
  /** the question to resend when the visitor taps "Try again" on an error */
  retry?: string;
}

export const MAX_LEN = 500;
const STORAGE_KEY = "farrukh-chat-v1";
const MAX_STORED = 40;

/** The request in flight, so "Stop" can cancel it. */
let controller: AbortController | null = null;

interface ChatState {
  lang: Lang;
  msgs: ChatMessage[];
  busy: boolean;
  /** the answer that is currently being typed out */
  revealId: string | null;
  /** the conversation that "New chat" just cleared, kept briefly so it can be undone */
  cleared: ChatMessage[] | null;
  hydrated: boolean;

  hydrate: () => void;
  setLang: (l: Lang) => void;
  send: (raw: string) => Promise<void>;
  stop: () => void;
  regenerate: () => void;
  retry: (id: string) => void;
  clear: () => void;
  undoClear: () => void;
  dismissUndo: () => void;
  finishReveal: (id: string) => void;
}

const isMsg = (m: unknown): m is ChatMessage =>
  !!m &&
  typeof m === "object" &&
  ((m as ChatMessage).role === "user" || (m as ChatMessage).role === "assistant") &&
  typeof (m as ChatMessage).content === "string" &&
  typeof (m as ChatMessage).id === "string";

export const useChatStore = create<ChatState>()((set, get) => ({
  lang: "en",
  msgs: [],
  busy: false,
  revealId: null,
  cleared: null,
  hydrated: false,

  hydrate: () => {
    if (get().hydrated) return;
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as { lang?: unknown; msgs?: unknown };
        const msgs = Array.isArray(saved.msgs) ? saved.msgs.filter(isMsg).filter((m) => !m.error).slice(-MAX_STORED) : [];
        set({ lang: saved.lang === "ur" ? "ur" : "en", msgs });
      }
    } catch {
      /* private mode or corrupt data: start fresh */
    }
    set({ hydrated: true });
  },

  setLang: (lang) => set({ lang }),

  send: async (raw) => {
    const text = raw.trim();
    const { busy, lang, msgs } = get();
    if (!text || busy) return;

    if (text.length > MAX_LEN) {
      set({ msgs: [...msgs, { id: uid("err"), role: "assistant", content: COPY[lang].errors.tooLong, error: true, timestamp: Date.now() }] });
      return;
    }

    const history = msgs.filter((m) => !m.error).slice(-8).map((m) => ({ role: m.role, content: m.content }));
    const asked = msgs.filter((m) => m.role === "user").map((m) => m.content).concat(text);
    set({ msgs: [...msgs, { id: uid("u"), role: "user", content: text, timestamp: Date.now() }], busy: true, cleared: null });
    track("oracle", lang); // language only, never the question

    const ctrl = new AbortController();
    controller = ctrl;
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: text, history, lang }),
        signal: ctrl.signal,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || typeof data?.answer !== "string") throw new Error(data?.error || COPY[lang].errors.generic);

      const reply: ChatMessage = {
        id: uid("a"),
        role: "assistant",
        content: data.answer,
        sources: Array.isArray(data.sources) ? data.sources : undefined,
        grounded: data.grounded,
        mode: data.mode,
        followUps: generateFollowUps(data.answer, lang, asked),
        timestamp: Date.now(),
      };
      set((s) => ({ msgs: [...s.msgs, reply], busy: false, revealId: reply.id }));
    } catch (e) {
      if (ctrl.signal.aborted) {
        if (controller === ctrl) set({ busy: false });
        return;
      }
      const message = e instanceof Error && e.message && !/fetch|network|failed/i.test(e.message) ? e.message : COPY[lang].errors.generic;
      set((s) => ({
        msgs: [...s.msgs, { id: uid("err"), role: "assistant", content: message, error: true, retry: text, timestamp: Date.now() }],
        busy: false,
      }));
    } finally {
      if (controller === ctrl) controller = null;
    }
  },

  stop: () => {
    controller?.abort();
    controller = null;
    set({ busy: false });
  },

  regenerate: () => {
    const { msgs, busy } = get();
    if (busy) return;
    let at = -1;
    for (let i = msgs.length - 1; i >= 0; i--) {
      if (msgs[i].role === "user") {
        at = i;
        break;
      }
    }
    if (at < 0) return;
    const text = msgs[at].content;
    set({ msgs: msgs.slice(0, at), revealId: null });
    void get().send(text);
  },

  retry: (id) => {
    const { msgs, busy } = get();
    if (busy) return;
    const at = msgs.findIndex((m) => m.id === id);
    const text = msgs[at]?.retry;
    if (!text) return;
    // drop the error and the question that caused it; send() adds the question back
    const from = at > 0 && msgs[at - 1].role === "user" && msgs[at - 1].content === text ? at - 1 : at;
    set({ msgs: [...msgs.slice(0, from), ...msgs.slice(at + 1)] });
    void get().send(text);
  },

  clear: () => {
    controller?.abort();
    controller = null;
    const { msgs } = get();
    set({ msgs: [], busy: false, revealId: null, cleared: msgs.length ? msgs : null });
  },

  undoClear: () => {
    const { cleared } = get();
    if (cleared) set({ msgs: cleared, cleared: null });
  },

  dismissUndo: () => set({ cleared: null }),

  finishReveal: (id) => {
    if (get().revealId === id) set({ revealId: null });
  },
}));

// Keep the conversation for this browser tab, so it survives navigating between the site and /play.
if (typeof window !== "undefined") {
  useChatStore.subscribe((s, prev) => {
    if (!s.hydrated || (s.msgs === prev.msgs && s.lang === prev.lang)) return;
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ lang: s.lang, msgs: s.msgs.filter((m) => !m.error).slice(-MAX_STORED) }));
    } catch {
      /* storage full or blocked: the chat still works, it just won't be remembered */
    }
  });
}
