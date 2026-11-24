import type { ReactNode } from "react";

/**
 * A tiny, safe renderer for chatbot answers: paragraphs, bullet / numbered lists, **bold**,
 * `code`, [links](https://…) and bare URLs / emails. It builds React nodes (never HTML strings)
 * and only ever links to http(s) and mailto, so a model reply can't inject markup or scripts.
 */
export type Block =
  | { type: "p"; text: string }
  | { type: "ul" | "ol"; items: string[] };

const BULLET = /^\s*[-*•]\s+(.*)$/;
const ORDERED = /^\s*\d+[.)]\s+(.*)$/;

export function parseBlocks(text: string): Block[] {
  const blocks: Block[] = [];
  let para: string[] = [];
  let list: { type: "ul" | "ol"; items: string[] } | null = null;

  const flushPara = () => {
    if (para.length) blocks.push({ type: "p", text: para.join("\n") });
    para = [];
  };
  const flushList = () => {
    if (list) blocks.push(list);
    list = null;
  };

  for (const raw of text.replace(/\r\n/g, "\n").split("\n")) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      flushPara();
      flushList();
      continue;
    }
    const bullet = BULLET.exec(line);
    const ordered = bullet ? null : ORDERED.exec(line);
    const hit = bullet ?? ordered;
    if (hit) {
      flushPara();
      const type = bullet ? "ul" : "ol";
      if (!list || list.type !== type) {
        flushList();
        list = { type, items: [] };
      }
      list.items.push(hit[1]);
    } else {
      flushList();
      para.push(line);
    }
  }
  flushPara();
  flushList();
  return blocks;
}

const TOKEN =
  /(\*\*[^*\n]+\*\*|`[^`\n]+`|\[[^\]\n]+\]\((?:https?:\/\/|mailto:)[^)\s]+\)|https?:\/\/[^\s<>()]*[^\s<>().,;:!?'"]|[\w.+-]+@[\w-]+(?:\.[\w-]+)+)/g;

export function renderInline(text: string, prefix = ""): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let i = 0;
  for (const m of text.matchAll(TOKEN)) {
    const at = m.index ?? 0;
    const tok = m[0];
    if (at > last) out.push(text.slice(last, at));
    const key = `${prefix}t${i++}`;
    if (tok.startsWith("**")) {
      out.push(<strong key={key}>{tok.slice(2, -2)}</strong>);
    } else if (tok.startsWith("`")) {
      out.push(<code key={key} className="chat-code">{tok.slice(1, -1)}</code>);
    } else if (tok.startsWith("[")) {
      const parts = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(tok);
      out.push(parts ? <a key={key} href={parts[2]} target="_blank" rel="noopener noreferrer" className="chat-link">{parts[1]}</a> : tok);
    } else if (/^https?:\/\//.test(tok)) {
      out.push(<a key={key} href={tok} target="_blank" rel="noopener noreferrer" className="chat-link">{tok.replace(/^https?:\/\/(www\.)?/, "")}</a>);
    } else {
      out.push(<a key={key} href={`mailto:${tok}`} className="chat-link">{tok}</a>);
    }
    last = at + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function lines(text: string): ReactNode[] {
  return text.split("\n").flatMap((l, i) => (i === 0 ? renderInline(l, "l0-") : [<br key={`br${i}`} />, ...renderInline(l, `l${i}-`)]));
}

export function RichText({ text, dir, typing }: { text: string; dir?: "ltr" | "rtl"; typing?: boolean }) {
  return (
    <div className="chat-rich" dir={dir} data-typing={typing || undefined}>
      {parseBlocks(text).map((b, i) =>
        b.type === "p" ? (
          <p key={i}>{lines(b.text)}</p>
        ) : b.type === "ul" ? (
          <ul key={i}>{b.items.map((it, j) => <li key={j}>{renderInline(it)}</li>)}</ul>
        ) : (
          <ol key={i}>{b.items.map((it, j) => <li key={j}>{renderInline(it)}</li>)}</ol>
        ),
      )}
    </div>
  );
}
