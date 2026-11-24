"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Download, Maximize2, Minimize2, Sparkles, SquarePen, X } from "lucide-react";
import { isZoneId, travelToZone } from "@/lib/game/travel";
import { useGame } from "@/lib/game/store";
import type { ZoneId } from "@/lib/game/zones";
import { AssistantOrb, ChatThread, Composer, IconBtn, LangSwitch } from "./ChatUI";
import { ZONE_TO_SECTION } from "./chatUtils";
import { useChatContext } from "./useChatContext";
import { useChatController } from "./useChatController";

const TEASED_KEY = "farrukh-chat-teased";

const sectionFor = (zone: string) => document.getElementById(ZONE_TO_SECTION[zone.toLowerCase()] ?? zone.toLowerCase());

/**
 * The always-there assistant: a launcher in the corner that opens a drawer.
 *
 * Layout rule that fixes the "opens beyond the screen" bug: the drawer is positioned from the
 * viewport edge (never stacked on top of the launcher, which sits 13.5rem up inside /play) and
 * sized with min(…, 100dvh − margins), so it fits on any screen. On phones it becomes a bottom sheet.
 *
 * `side` moves the launcher and drawer to the other corner.
 */
export default function FloatingChat({ side = "right" }: { side?: "left" | "right" }) {
  const pathname = usePathname();
  const isGame = pathname === "/play";
  const reduce = useReducedMotion();

  const [open, setOpen] = useState(false);
  const [wide, setWide] = useState(false);
  const [teaser, setTeaser] = useState(false);
  const [seen, setSeen] = useState<number | null>(null);

  const c = useChatController();
  const { t } = c;
  const context = useChatContext(isGame, open);
  const oraclePanelOpen = useGame((s) => s.openPanel === "oracle");

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);

  const answers = c.msgs.reduce((n, m) => n + (m.role === "assistant" && !m.error ? 1 : 0), 0);
  const unread = open || seen === null ? 0 : Math.max(0, answers - seen);

  const openChat = useCallback(() => {
    setTeaser(false);
    setOpen(true);
  }, []);
  const closeChat = useCallback(() => setOpen(false), []);

  // the in-game Oracle terminal is the same chat: don't show two at once
  useEffect(() => {
    if (oraclePanelOpen) setOpen(false);
  }, [oraclePanelOpen]);

  // replies count as read while the drawer is open
  useEffect(() => {
    if (open) setSeen(answers);
  }, [open, answers]);

  // focus: into the field on open (desktop only, so phones don't pop the keyboard), back to the launcher on close
  useEffect(() => {
    if (open) {
      wasOpen.current = true;
      if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
        const id = window.setTimeout(() => inputRef.current?.focus(), 180);
        return () => window.clearTimeout(id);
      }
    } else if (wasOpen.current) {
      wasOpen.current = false;
      requestAnimationFrame(() => launcherRef.current?.focus());
    }
  }, [open]);

  // a one-time nudge on the normal site: never in the game, never again once shown
  useEffect(() => {
    if (isGame || open) return;
    try {
      if (sessionStorage.getItem(TEASED_KEY)) return;
    } catch {
      return;
    }
    const show = window.setTimeout(() => {
      setTeaser(true);
      try {
        sessionStorage.setItem(TEASED_KEY, "1");
      } catch {
        /* nothing to remember */
      }
    }, 5000);
    const hide = window.setTimeout(() => setTeaser(false), 15000);
    return () => {
      window.clearTimeout(show);
      window.clearTimeout(hide);
    };
  }, [isGame, open]);

  const onSource = useCallback(
    (zone: string) => {
      if (isGame) {
        if (isZoneId(zone)) travelToZone(zone as ZoneId);
        return;
      }
      sectionFor(zone)?.scrollIntoView({ behavior: "smooth", block: "start" });
      if (window.matchMedia("(max-width: 639px)").matches) setOpen(false); // the sheet would cover the section
    },
    [isGame],
  );
  const canNavigate = useCallback((zone: string) => (isGame ? isZoneId(zone) : !!sectionFor(zone)), [isGame]);

  if (oraclePanelOpen) return null;

  return (
    <div className="chat-shell" data-side={side} data-game={isGame || undefined} onKeyDown={(e) => e.stopPropagation()} onKeyUp={(e) => e.stopPropagation()}>
      <AnimatePresence>
        {open && (
          <motion.div
            key="scrim"
            className="chat-scrim"
            onClick={closeChat}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduce ? 0 : 0.2 }}
            aria-hidden
          />
        )}
        {open && (
          <motion.section
            key="drawer"
            className="chat-root chat-drawer"
            data-side={side}
            data-wide={wide || undefined}
            role="dialog"
            aria-label={t.title}
            dir={c.lang === "ur" ? "rtl" : "ltr"}
            style={{ transformOrigin: side === "right" ? "bottom right" : "bottom left" }}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 22, scale: 0.96 }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.97 }}
            transition={reduce ? { duration: 0 } : { type: "spring", damping: 28, stiffness: 340 }}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.stopPropagation();
                closeChat();
              }
            }}
          >
            <header className="chat-head">
              <AssistantOrb size={38} state={c.orb} />
              <div className="chat-head__text">
                <h2 className="chat-title">{t.title}</h2>
                <p className="chat-sub" data-busy={c.busy || undefined}>
                  <span className="chat-dot" aria-hidden />
                  <span>{c.busy ? t.statusThinking : t.subtitle}</span>
                </p>
              </div>
              <div className="chat-head__actions" dir="ltr">
                <IconBtn label={wide ? t.collapse : t.expand} onClick={() => setWide((v) => !v)} className="chat-desktop-only">
                  {wide ? <Minimize2 size={15} aria-hidden /> : <Maximize2 size={15} aria-hidden />}
                </IconBtn>
                <IconBtn label={t.close} onClick={closeChat}>
                  <X size={17} aria-hidden />
                </IconBtn>
              </div>
            </header>

            <div className="chat-bar" dir="ltr">
              <LangSwitch lang={c.lang} onChange={c.changeLang} />
              {c.msgs.length > 0 && (
                <div className="chat-bar__actions">
                  <IconBtn label={t.export} onClick={c.exportChat}>
                    <Download size={15} aria-hidden />
                  </IconBtn>
                  <IconBtn label={t.newChat} onClick={c.newChat}>
                    <SquarePen size={15} aria-hidden />
                  </IconBtn>
                </div>
              )}
            </div>

            <ChatThread c={c} contextKey={context} sourceMode={isGame ? "travel" : "scroll"} onSource={onSource} canNavigate={canNavigate} />
            <Composer c={c} inputRef={inputRef} />
          </motion.section>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {!open && (
          <motion.div
            key="launcher"
            className="chat-launcher-wrap"
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.8 }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.85 }}
            transition={{ duration: reduce ? 0 : 0.22 }}
          >
            <AnimatePresence>
              {teaser && (
                <motion.div
                  key="teaser"
                  className="chat-teaser"
                  initial={reduce ? { opacity: 0 } : { opacity: 0, x: side === "right" ? 12 : -12 }}
                  animate={reduce ? { opacity: 1 } : { opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: reduce ? 0 : 0.3 }}
                >
                  <button type="button" className="chat-teaser__text" onClick={openChat}>{t.teaser}</button>
                  <button type="button" className="chat-teaser__close" onClick={() => setTeaser(false)} aria-label={t.teaserClose} title={t.teaserClose}>
                    <X size={13} aria-hidden />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            <button ref={launcherRef} type="button" className="chat-launcher" onClick={openChat} aria-label={t.open} aria-expanded={false} title={t.open}>
              <AssistantOrb size={56} state={c.orb}>
                <Sparkles size={22} />
              </AssistantOrb>
              {unread > 0 && <span className="chat-badge" aria-label={`${unread}`}>{unread}</span>}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
