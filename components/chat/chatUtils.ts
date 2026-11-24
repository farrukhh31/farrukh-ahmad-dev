import { COPY, type ContextKey, type Lang } from "./chatCopy";
import type { ChatMessage } from "./chatStore";

/** Portfolio zone / source id -> the id of the matching section on the normal site. */
export const ZONE_TO_SECTION: Record<string, string> = {
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

/** Game zone -> chat context (used on /play so suggestions follow the island you're standing on). */
export const ZONE_TO_CONTEXT: Record<string, ContextKey> = {
  about: "about",
  plaza: "about",
  resume: "about",
  skills: "skills",
  projects: "projects",
  cinema: "projects",
  quest: "experience",
  trophy: "certificates",
  comms: "contact",
  hire: "contact",
};

let counter = 0;
export const uid = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${(counter++).toString(36)}`;

export function cleanForSpeech(text: string): string {
  return text
    .replace(/<[^>]*>/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*_#`~[\]]/g, "")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/^\s*[-•]\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}

const FOLLOW_UPS: Record<Lang, Record<"game" | "stack" | "work" | "default", string[]>> = {
  en: {
    game: ["What game engines & tools does he use?", "Tell me about his other projects", "How can I contact Farrukh?"],
    stack: ["What are his core technical skills?", "Does he have production work experience?", "Show me his certifications"],
    work: ["What were his key achievements there?", "What is his educational background?", "Explore his featured projects"],
    default: ["Tell me about his top projects", "What is his full tech stack?", "How can recruiters contact him?"],
  },
  ur: {
    game: ["وہ کون سے گیم انجن اور ٹولز استعمال کرتے ہیں؟", "ان کے دوسرے پروجیکٹس بتائیں", "فرخ سے رابطہ کیسے کریں؟"],
    stack: ["ان کی بنیادی تکنیکی مہارتیں کیا ہیں؟", "کیا ان کے پاس صنعتی تجربہ ہے؟", "ان کے سرٹیفکیٹس دکھائیں"],
    work: ["ان کی اہم کامیابیاں کیا تھیں؟", "ان کی تعلیمی قابلیت کیا ہے؟", "ان کے نمایاں پروجیکٹس دکھائیں"],
    default: ["اہم پروجیکٹس کی تفصیل بتائیں", "ان کا مکمل ٹیک اسٹیک کیا ہے؟", "فرخ سے رابطہ کیسے کریں؟"],
  },
};

/** Up to three related questions, skipping anything the visitor has already asked. */
export function generateFollowUps(answer: string, lang: Lang, asked: string[] = []): string[] {
  const l = answer.toLowerCase();
  const kind: "game" | "stack" | "work" | "default" =
    /unity|game|mask|ragdoll|گیم/.test(l) ? "game"
    : /docker|devops|react|next|fastapi/.test(l) ? "stack"
    : /intern|educative|devsinc|experience|تجربہ/.test(l) ? "work"
    : "default";
  const seen = new Set(asked.map((q) => q.trim().toLowerCase()));
  const pool = [...FOLLOW_UPS[lang][kind], ...FOLLOW_UPS[lang].default];
  const out: string[] = [];
  for (const q of pool) {
    if (!seen.has(q.toLowerCase()) && !out.includes(q)) out.push(q);
    if (out.length === 3) break;
  }
  return out;
}

export function formatTime(ts: number, lang: Lang): string {
  try {
    return new Date(ts).toLocaleTimeString(lang === "ur" ? "ur-PK" : "en-US", { hour: "numeric", minute: "2-digit" });
  } catch {
    return "";
  }
}

/** The conversation as a small Markdown file a recruiter can keep. */
export function buildTranscript(msgs: ChatMessage[], lang: Lang, now = new Date()): string {
  const t = COPY[lang];
  const lines = [`# ${t.transcriptTitle}`, "", `_${now.toISOString().slice(0, 10)}_`, ""];
  for (const m of msgs) {
    if (m.error) continue;
    lines.push(`**${m.role === "user" ? t.you : t.assistant}:** ${m.content.trim()}`);
    if (m.sources?.length) lines.push("", `${t.sources}: ${m.sources.map((s) => s.title).join(", ")}`);
    lines.push("");
  }
  return lines.join("\n").trimEnd() + "\n";
}

export function downloadText(filename: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/markdown;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
