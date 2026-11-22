/**
 * Privacy-friendly analytics: the event vocabulary shared by the browser and the server.
 * Events never carry personal data - no message text, no names, no emails. Only a type and
 * a short label such as "zone:projects" or "oracle:ur".
 */
export const EVENT_TYPES = [
  "pageview", // name = route ("/" or "/play")
  "zone", // a world zone was discovered
  "panel", // a zone panel was opened
  "skill", // a skill orb was collected
  "achievement", // an achievement was unlocked
  "oracle", // a chatbot question was asked (name = language only)
  "contact", // a contact message was sent
  "emote", // the avatar performed a gesture
  "setting", // an accessibility / display setting changed
] as const;

export type EventType = (typeof EVENT_TYPES)[number];

export interface AnalyticsEvent {
  type: EventType;
  name: string;
}

export const MAX_EVENTS_PER_REQUEST = 10;
export const MAX_NAME_LENGTH = 40;
/** Letters, digits and a few separators only: no spaces, no free text. */
const NAME_RE = /^[a-z0-9/-][a-z0-9_:/.-]*$/i;

/** Validates an untrusted request body. Returns null when the whole request is malformed. */
export function parseEvents(body: unknown): AnalyticsEvent[] | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const list = (body as { events?: unknown }).events;
  if (!Array.isArray(list) || list.length === 0 || list.length > MAX_EVENTS_PER_REQUEST) return null;

  const out: AnalyticsEvent[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") return null;
    const { type, name } = item as { type?: unknown; name?: unknown };
    if (typeof type !== "string" || !(EVENT_TYPES as readonly string[]).includes(type)) return null;
    const label = name === undefined ? "-" : name;
    if (typeof label !== "string" || label.length === 0 || label.length > MAX_NAME_LENGTH || !NAME_RE.test(label)) return null;
    out.push({ type: type as EventType, name: label });
  }
  return out;
}
