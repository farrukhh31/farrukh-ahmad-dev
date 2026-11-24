"use client";

import { useCallback, useRef, useState } from "react";
import { Download, ShieldCheck, SquarePen, Volume2, VolumeX } from "lucide-react";

import { isZoneId, travelToZone } from "@/lib/game/travel";
import { useGame } from "@/lib/game/store";
import { ZONE_BY_ID, type ZoneId } from "@/lib/game/zones";
import { AssistantOrb, ChatThread, Composer, IconBtn, LangSwitch } from "@/components/chat/ChatUI";
import { useChatController } from "@/components/chat/useChatController";

/**
 * The Oracle Terminal. Same conversation as the floating chat (they share one store), so you can
 * ask on the site, walk into the game and carry on.
 */
export default function OraclePanel() {
  const [autoRead, setAutoRead] = useState(false);
  const c = useChatController({ autoRead });
  const { t } = c;
  const closePanel = useGame((s) => s.openZonePanel);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const goto = useCallback(
    (zone: string) => {
      if (!isZoneId(zone)) return;
      closePanel(null);
      travelToZone(zone as ZoneId);
    },
    [closePanel],
  );
  const canNavigate = useCallback((zone: string) => isZoneId(zone), []);

  const toggleRead = () => {
    if (autoRead) c.speaker.stop();
    setAutoRead((v) => !v);
  };

  return (
    <div className="chat-root chat-panel" data-variant="panel" dir={c.lang === "ur" ? "rtl" : "ltr"} style={{ ["--chat-accent" as string]: ZONE_BY_ID.oracle.color }}>
      <div className="chat-bar" dir="ltr">
        <span className="chat-panel__orb" aria-hidden>
          <AssistantOrb size={30} state={c.orb} />
        </span>
        <LangSwitch lang={c.lang} onChange={c.changeLang} />
        <p className="chat-trust">
          <ShieldCheck size={13} aria-hidden />
          <span>{c.busy ? t.statusThinking : t.subtitle}</span>
        </p>
        <div className="chat-bar__actions">
          {c.speaker.supported && (
            <IconBtn label={autoRead ? t.readAloudOff : t.readAloud} onClick={toggleRead} pressed={autoRead}>
              {autoRead ? <Volume2 size={15} aria-hidden /> : <VolumeX size={15} aria-hidden />}
            </IconBtn>
          )}
          {c.msgs.length > 0 && (
            <>
              <IconBtn label={t.export} onClick={c.exportChat}>
                <Download size={15} aria-hidden />
              </IconBtn>
              <IconBtn label={t.newChat} onClick={c.newChat}>
                <SquarePen size={15} aria-hidden />
              </IconBtn>
            </>
          )}
        </div>
      </div>

      <ChatThread c={c} contextKey={null} sourceMode="travel" onSource={goto} canNavigate={canNavigate} />
      <Composer c={c} inputRef={inputRef} />
    </div>
  );
}
