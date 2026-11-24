"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import {
  ArrowDown,
  ArrowUp,
  Award,
  Briefcase,
  Check,
  Compass,
  Copy,
  CornerDownLeft,
  Gamepad2,
  Hash,
  Layers,
  Mic,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Square,
  Volume2,
  VolumeX,
} from "lucide-react";
import { isZoneId } from "@/lib/game/travel";
import { ZONE_BY_ID, type ZoneId } from "@/lib/game/zones";
import { COPY, CONTEXT_PROMPTS, STARTERS, type ContextKey, type Lang, type StarterIcon } from "./chatCopy";
import { MAX_LEN, type ChatMessage } from "./chatStore";
import { formatTime } from "./chatUtils";
import { RichText } from "./markdown";
import type { ChatController } from "./useChatController";

/* ───────────── the orb: the assistant's face, and its status light ───────────── */

export type OrbState = "idle" | "thinking" | "listening" | "speaking";

export function AssistantOrb({ state = "idle", size = 40, children }: { state?: OrbState; size?: number; children?: ReactNode }) {
  return (
    <span className="chat-orb" data-state={state} style={{ ["--orb" as string]: `${size}px` }} aria-hidden>
      <span className="chat-orb__halo" />
      <span className="chat-orb__body" />
      {children ? <span className="chat-orb__glyph">{children}</span> : null}
    </span>
  );
}

/* ───────────── small controls ───────────── */

export function IconBtn({
  label,
  onClick,
  children,
  pressed,
  className = "",
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
  pressed?: boolean;
  className?: string;
}) {
  return (
    <button type="button" className={`chat-icon ${className}`} onClick={onClick} title={label} aria-label={label} aria-pressed={pressed}>
      {children}
    </button>
  );
}

export function LangSwitch({ lang, onChange }: { lang: Lang; onChange: (l: Lang) => void }) {
  return (
    <div className="chat-seg" data-lang={lang} role="group" aria-label={COPY[lang].language} dir="ltr">
      <span className="chat-seg__thumb" aria-hidden />
      {(["en", "ur"] as Lang[]).map((l) => (
        <button key={l} type="button" aria-pressed={lang === l} onClick={() => onChange(l)} lang={l}>
          {l === "en" ? "EN" : "اردو"}
        </button>
      ))}
    </div>
  );
}

/* ───────────── an answer that types itself out (click to skip) ───────────── */

function TypedText({ text, active, dir, onDone }: { text: string; active: boolean; dir: "ltr" | "rtl"; onDone: () => void }) {
  const tokens = useMemo(() => text.split(/(\s+)/), [text]);
  const len = tokens.length;
  const step = Math.max(2, Math.ceil(len / 64)); // long answers still finish in about two seconds
  const [n, setN] = useState(active ? 0 : Number.MAX_SAFE_INTEGER);

  useEffect(() => {
    if (!active) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setN(len);
      return;
    }
    const id = window.setInterval(() => setN((v) => Math.min(len, v + step)), 26);
    return () => window.clearInterval(id);
  }, [active, len, step]);

  const done = !active || n >= len;
  useEffect(() => {
    if (active && done) onDone();
  }, [active, done, onDone]);

  return (
    <div onClick={done ? undefined : () => setN(len)}>
      {!done && <span className="sr-only">{text}</span>}
      <div aria-hidden={!done || undefined}>
        <RichText text={done ? text : tokens.slice(0, n).join("")} dir={dir} typing={!done} />
      </div>
    </div>
  );
}

/* ───────────── sources ───────────── */

export type SourceMode = "scroll" | "travel";

function SourceChips({
  msg,
  lang,
  mode,
  onSource,
  canNavigate,
}: {
  msg: ChatMessage;
  lang: Lang;
  mode: SourceMode;
  onSource: (zone: string) => void;
  canNavigate: (zone: string) => boolean;
}) {
  const t = COPY[lang];
  const Icon = mode === "travel" ? Compass : Hash;
  const seen = new Set<string>();
  const sources = (msg.sources ?? []).filter((s) => (seen.has(s.title) ? false : (seen.add(s.title), true)));
  if (!sources.length) return null;
  return (
    <ul className="chat-sources" dir="ltr" aria-label={t.sources}>
      {sources.map((s) => {
        const go = canNavigate(s.zone);
        const zoneName = isZoneId(s.zone) ? ZONE_BY_ID[s.zone as ZoneId]?.name : null;
        return (
          <li key={s.title}>
            <button type="button" className="chat-source" disabled={!go} onClick={() => onSource(s.zone)} title={s.snippet}>
              <Icon size={12} aria-hidden />
              <span className="chat-source__title">{s.title}</span>
              {zoneName && mode === "travel" ? <em>{zoneName}</em> : null}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/* ───────────── one message ───────────── */

interface MessageItemProps {
  c: ChatController;
  msg: ChatMessage;
  isLast: boolean;
  showFollowUps: boolean;
  sourceMode: SourceMode;
  onSource: (zone: string) => void;
  canNavigate: (zone: string) => boolean;
}

function MessageItem({ c, msg, isLast, showFollowUps, sourceMode, onSource, canNavigate }: MessageItemProps) {
  const { lang, t } = c;
  const dir = lang === "ur" ? "rtl" : "ltr";
  const isAssistant = msg.role === "assistant";
  const revealing = c.revealId === msg.id;
  const speaking = c.speaker.speakingId === msg.id;
  const { finishReveal } = c;
  const onDone = useCallback(() => finishReveal(msg.id), [finishReveal, msg.id]);

  return (
    <article className="chat-msg" data-role={msg.role} data-error={msg.error || undefined}>
      {isAssistant && <AssistantOrb size={26} state={revealing ? "speaking" : "idle"} />}
      <div className="chat-msg__col">
        <div className="chat-bubble">
          {isAssistant && !msg.error ? (
            <TypedText text={msg.content} active={revealing} dir={dir} onDone={onDone} />
          ) : (
            <p className="chat-plain" dir="auto">{msg.content}</p>
          )}
          {msg.error && msg.retry ? (
            <button type="button" className="chat-retry" onClick={() => c.retry(msg.id)}>
              <RotateCcw size={12} aria-hidden /> {t.retry}
            </button>
          ) : null}
        </div>

        {isAssistant && !msg.error && !revealing && (
          <>
            <SourceChips msg={msg} lang={lang} mode={sourceMode} onSource={onSource} canNavigate={canNavigate} />
            {msg.mode === "extractive" && msg.grounded && msg.sources?.length ? <p className="chat-note">{t.extractive}</p> : null}
          </>
        )}

        {!revealing && !msg.error && (
          <div className="chat-meta" dir="ltr">
            {isAssistant && (
              <>
                <button type="button" className="chat-act" onClick={() => c.copy(msg.id, msg.content)} title={t.copy} aria-label={t.copy}>
                  {c.copiedId === msg.id ? <Check size={13} aria-hidden /> : <Copy size={13} aria-hidden />}
                  {c.copiedId === msg.id && <span>{t.copied}</span>}
                </button>
                {c.speaker.supported && (
                  <button type="button" className="chat-act" data-on={speaking || undefined} onClick={() => c.speaker.speak(msg.id, msg.content)} title={speaking ? t.stopAudio : t.listen} aria-label={speaking ? t.stopAudio : t.listen}>
                    {speaking ? <VolumeX size={13} aria-hidden /> : <Volume2 size={13} aria-hidden />}
                  </button>
                )}
                {isLast && !c.busy && (
                  <button type="button" className="chat-act" onClick={c.regenerate} title={t.regenerate} aria-label={t.regenerate}>
                    <RefreshCw size={13} aria-hidden />
                  </button>
                )}
              </>
            )}
            <time className="chat-time" dateTime={new Date(msg.timestamp).toISOString()}>{formatTime(msg.timestamp, lang)}</time>
          </div>
        )}

        {showFollowUps && msg.followUps?.length ? (
          <div className="chat-chips">
            {msg.followUps.map((q) => (
              <button key={q} type="button" className="chat-chip" onClick={() => c.submit(q)}>
                <span>{q}</span>
                <CornerDownLeft size={11} aria-hidden />
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </article>
  );
}

/* ───────────── "thinking", in stages ───────────── */

function TypingIndicator({ lang }: { lang: Lang }) {
  const phases = COPY[lang].thinking;
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setI((v) => Math.min(v + 1, phases.length - 1)), 1800);
    return () => window.clearInterval(id);
  }, [phases.length]);
  return (
    <div className="chat-msg" data-role="assistant">
      <AssistantOrb size={26} state="thinking" />
      <div className="chat-typing" role="status">
        <span className="chat-dots" aria-hidden><i /><i /><i /></span>
        <span key={i} className="chat-typing__text">{phases[i]}</span>
      </div>
    </div>
  );
}

/* ───────────── empty state ───────────── */

const STARTER_ICON: Record<StarterIcon, typeof Layers> = { projects: Layers, skills: Sparkles, experience: Briefcase, game: Gamepad2 };

function Welcome({ c, contextKey }: { c: ChatController; contextKey: ContextKey | null }) {
  const { lang, t } = c;
  const contextual = contextKey ? CONTEXT_PROMPTS[lang][contextKey] : null;
  return (
    <div className="chat-welcome">
      <div className="chat-welcome__hero">
        <AssistantOrb size={60} state={c.orb} />
        <h3>{t.welcomeTitle}</h3>
        <p>{t.welcome}</p>
      </div>

      {contextual && contextKey && (
        <section aria-label={t.contextTitle(t.sections[contextKey])}>
          <p className="chat-label">{t.contextTitle(t.sections[contextKey])}</p>
          <div className="chat-chips" data-start>
            {contextual.map((q) => (
              <button key={q} type="button" className="chat-chip" onClick={() => c.submit(q)}>
                <span>{q}</span>
                <CornerDownLeft size={11} aria-hidden />
              </button>
            ))}
          </div>
        </section>
      )}

      <section aria-label={t.startersTitle}>
        <p className="chat-label">{t.startersTitle}</p>
        <div className="chat-starters">
          {STARTERS[lang].map((s) => {
            const Icon = STARTER_ICON[s.icon] ?? Award;
            return (
              <button key={s.text} type="button" className="chat-starter" onClick={() => c.submit(s.text)}>
                <Icon size={15} aria-hidden />
                <span>{s.text}</span>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}

/* ───────────── the scrolling log: sticks to the newest message, lets you read up ───────────── */

function ChatLog({ label, jump, resetKey, overlay, children }: { label: string; jump: string; resetKey: number; overlay?: ReactNode; children: ReactNode }) {
  const scroller = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const [away, setAway] = useState(false);

  const toBottom = (smooth: boolean) => {
    const el = scroller.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  };

  // follow the newest text, including while an answer types itself out
  useEffect(() => {
    const el = inner.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      if (stick.current) toBottom(false);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // sending a message always brings you back to the bottom
  useEffect(() => {
    stick.current = true;
    setAway(false);
    toBottom(true);
  }, [resetKey]);

  const onScroll = () => {
    const el = scroller.current;
    if (!el) return;
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < 72;
    stick.current = near;
    setAway(!near);
  };

  return (
    <div className="chat-logwrap">
      <div ref={scroller} onScroll={onScroll} className="chat-log" role="log" aria-live="polite" aria-relevant="additions" aria-label={label} tabIndex={0} data-lenis-prevent>
        <div ref={inner} className="chat-log__inner">{children}</div>
      </div>
      {away && (
        <button
          type="button"
          className="chat-jump"
          onClick={() => {
            stick.current = true;
            setAway(false);
            toBottom(true);
          }}
        >
          <ArrowDown size={13} aria-hidden /> {jump}
        </button>
      )}
      {overlay}
    </div>
  );
}

/* ───────────── thread = log + welcome + messages + status ───────────── */

export function ChatThread({
  c,
  contextKey,
  sourceMode,
  onSource,
  canNavigate,
}: {
  c: ChatController;
  contextKey: ContextKey | null;
  sourceMode: SourceMode;
  onSource: (zone: string) => void;
  canNavigate: (zone: string) => boolean;
}) {
  const { msgs, t } = c;
  const lastIndex = msgs.length - 1;
  const lastAnswer = (() => {
    for (let i = msgs.length - 1; i >= 0; i--) if (msgs[i].role === "assistant" && !msgs[i].error) return msgs[i].id;
    return null;
  })();
  const userCount = msgs.reduce((n, m) => n + (m.role === "user" ? 1 : 0), 0);

  return (
    <ChatLog
      label={t.title}
      jump={t.jump}
      resetKey={userCount}
      overlay={
        c.cleared ? (
          <div className="chat-undo" role="status">
            <span>{t.cleared}</span>
            <button type="button" onClick={c.undoClear}>{t.undo}</button>
          </div>
        ) : null
      }
    >
      {msgs.length === 0 ? (
        <Welcome c={c} contextKey={contextKey} />
      ) : (
        msgs.map((m, i) => (
          <MessageItem
            key={m.id}
            c={c}
            msg={m}
            isLast={m.id === lastAnswer && i === lastIndex}
            showFollowUps={m.id === lastAnswer && i === lastIndex && !c.busy && c.revealId !== m.id}
            sourceMode={sourceMode}
            onSource={onSource}
            canNavigate={canNavigate}
          />
        ))
      )}
      {c.busy && <TypingIndicator lang={c.lang} />}
    </ChatLog>
  );
}

/* ───────────── composer ───────────── */

export function Composer({ c, inputRef }: { c: ChatController; inputRef: RefObject<HTMLTextAreaElement | null> }) {
  const { t, lang, voice } = c;
  const len = c.input.length;

  // grow with the text, up to about six lines
  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 132)}px`;
  }, [c.input, inputRef]);

  return (
    <form
      className="chat-composer"
      dir="ltr"
      onSubmit={(e) => {
        e.preventDefault();
        c.submit();
      }}
    >
      {voice.listening && (
        <div className="chat-listening" role="status">
          <span className="chat-wave" aria-hidden><i /><i /><i /><i /><i /></span>
          <span dir="auto">{voice.interim || t.listening}</span>
        </div>
      )}
      <div className="chat-field">
        {voice.supported && (
          <button type="button" className="chat-mic" data-on={voice.listening || undefined} onClick={voice.toggle} aria-pressed={voice.listening} aria-label={voice.listening ? t.micStop : t.mic} title={voice.listening ? t.micStop : t.mic}>
            <Mic size={17} aria-hidden />
          </button>
        )}
        <textarea
          ref={inputRef}
          rows={1}
          maxLength={MAX_LEN}
          value={c.input}
          onChange={(e) => c.setInput(e.target.value)}
          onKeyDown={(e) => {
            e.stopPropagation(); // typing must never move the avatar
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              c.submit();
            }
          }}
          onKeyUp={(e) => e.stopPropagation()}
          dir={lang === "ur" ? "rtl" : "ltr"}
          placeholder={t.placeholder}
          aria-label={t.placeholder}
          enterKeyHint="send"
          data-lenis-prevent
          className="chat-input"
        />
        {c.busy ? (
          <button type="button" className="chat-send" data-stop onClick={c.stop} aria-label={t.stop} title={t.stop}>
            <Square size={12} fill="currentColor" aria-hidden />
          </button>
        ) : (
          <button type="submit" className="chat-send" disabled={!c.input.trim()} aria-label={t.send} title={t.send}>
            <ArrowUp size={17} strokeWidth={2.4} aria-hidden />
          </button>
        )}
      </div>
      <div className="chat-foot">
        <span className="chat-hint">{t.hint}</span>
        {len >= 400 && <span className="chat-count" data-warn={len >= 480 || undefined}>{len}/{MAX_LEN}</span>}
      </div>
    </form>
  );
}
