"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { COPY } from "./chatCopy";
import { useChatStore } from "./chatStore";
import { buildTranscript, downloadText } from "./chatUtils";
import { useSpeaker, useVoiceInput } from "./useChatSpeech";
import type { OrbState } from "./ChatUI";

/** Everything both chat surfaces need: the shared conversation, the composer draft, voice in and out. */
export function useChatController({ autoRead = false }: { autoRead?: boolean } = {}) {
  const lang = useChatStore((s) => s.lang);
  const msgs = useChatStore((s) => s.msgs);
  const busy = useChatStore((s) => s.busy);
  const revealId = useChatStore((s) => s.revealId);
  const cleared = useChatStore((s) => s.cleared);
  const hydrated = useChatStore((s) => s.hydrated);
  const { hydrate, send, stop, regenerate, retry, clear, undoClear, dismissUndo, finishReveal, setLang } = useChatStore.getState();

  useEffect(() => hydrate(), [hydrate]);

  const [input, setInput] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const speaker = useSpeaker(lang);
  const voice = useVoiceInput(lang, (heard) => void send(heard));

  const submit = useCallback(
    (text?: string) => {
      const value = (text ?? input).trim();
      if (!value || busy) return;
      setInput("");
      void send(value);
    },
    [busy, input, send],
  );

  const copy = useCallback((id: string, text: string) => {
    if (typeof navigator === "undefined" || !navigator.clipboard) return;
    void navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId((cur) => (cur === id ? null : cur)), 1800);
    });
  }, []);

  const changeLang = useCallback(
    (next: "en" | "ur") => {
      if (next === lang) return;
      speaker.stop();
      voice.stop();
      setLang(next);
    },
    [lang, setLang, speaker, voice],
  );

  const exportChat = useCallback(() => {
    if (!msgs.length) return;
    downloadText(`farrukh-ai-chat-${new Date().toISOString().slice(0, 10)}.md`, buildTranscript(msgs, lang));
  }, [lang, msgs]);

  const newChat = useCallback(() => {
    speaker.stop();
    clear();
    setInput("");
  }, [clear, speaker]);

  // Read each new answer aloud when "read aloud" is on. Restored history is never read out.
  const lastSeen = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (!hydrated) return;
    const last = msgs[msgs.length - 1];
    const lastId = last?.id ?? null;
    if (lastSeen.current === undefined) {
      lastSeen.current = lastId;
      return;
    }
    if (lastId === lastSeen.current) return;
    lastSeen.current = lastId;
    if (autoRead && last && last.role === "assistant" && !last.error) speaker.speak(last.id, last.content);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- speaker.speak changes identity while speaking
  }, [msgs, hydrated, autoRead]);

  // Auto-dismiss the undo bar.
  useEffect(() => {
    if (!cleared) return;
    const id = setTimeout(dismissUndo, 7000);
    return () => clearTimeout(id);
  }, [cleared, dismissUndo]);

  const orb: OrbState = voice.listening ? "listening" : busy ? "thinking" : speaker.speakingId ? "speaking" : "idle";
  const t = COPY[lang];

  return {
    lang,
    t,
    msgs,
    busy,
    revealId,
    cleared,
    input,
    setInput,
    submit,
    send,
    stop,
    regenerate,
    retry,
    undoClear,
    dismissUndo,
    finishReveal,
    copiedId,
    copy,
    speaker,
    voice,
    orb,
    changeLang,
    exportChat,
    newChat,
  };
}

export type ChatController = ReturnType<typeof useChatController>;
