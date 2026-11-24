import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parseBlocks, renderInline } from "@/components/chat/markdown";
import { buildTranscript, cleanForSpeech, generateFollowUps } from "@/components/chat/chatUtils";
import { useChatStore, type ChatMessage } from "@/components/chat/chatStore";

describe("answer formatting", () => {
  it("splits paragraphs and lists", () => {
    const blocks = parseBlocks("Intro line\n\n- one\n- two\n\n1. first\n2) second\n\nOutro");
    expect(blocks.map((b) => b.type)).toEqual(["p", "ul", "ol", "p"]);
    expect(blocks[1]).toEqual({ type: "ul", items: ["one", "two"] });
    expect(blocks[2]).toEqual({ type: "ol", items: ["first", "second"] });
  });

  it("keeps a leading *emphasis* word out of the bullet list", () => {
    expect(parseBlocks("*Note* this")[0].type).toBe("p");
  });

  it("links only http(s) and mailto, never javascript:", () => {
    const nodes = renderInline("[bad](javascript:alert(1)) and [ok](https://example.com) and me@site.dev");
    const hrefs = nodes.flatMap((n) => (typeof n === "object" && n && "props" in n && (n.props as { href?: string }).href ? [(n.props as { href: string }).href] : []));
    expect(hrefs).toEqual(["https://example.com", "mailto:me@site.dev"]);
  });
});

describe("helpers", () => {
  it("never suggests a question that was already asked", () => {
    const first = generateFollowUps("He built a Unity game", "en");
    const next = generateFollowUps("He built a Unity game", "en", [first[0].toUpperCase()]);
    expect(next).not.toContain(first[0]);
    expect(next).toHaveLength(3);
  });

  it("strips markup before reading aloud", () => {
    expect(cleanForSpeech("**Bold** [link](https://x.dev) and `code`\n- item")).toBe("Bold link and code item");
  });

  it("exports a readable transcript without error bubbles", () => {
    const msgs: ChatMessage[] = [
      { id: "1", role: "user", content: "Hi", timestamp: 1 },
      { id: "2", role: "assistant", content: "Hello", timestamp: 2, sources: [{ title: "About", doc: "d", zone: "about", snippet: "", score: 1 }] },
      { id: "3", role: "assistant", content: "boom", timestamp: 3, error: true },
    ];
    const md = buildTranscript(msgs, "en", new Date("2026-11-24T00:00:00Z"));
    expect(md).toContain("**You:** Hi");
    expect(md).toContain("**Farrukh AI:** Hello");
    expect(md).toContain("From the portfolio: About");
    expect(md).not.toContain("boom");
  });
});

describe("shared conversation store", () => {
  const reply = (answer: string) => ({ ok: true, status: 200, json: async () => ({ answer, sources: [], grounded: true, mode: "llm" }) });
  const reset = () => useChatStore.setState({ lang: "en", msgs: [], busy: false, revealId: null, cleared: null, hydrated: true });

  beforeEach(reset);
  afterEach(() => vi.unstubAllGlobals());

  it("sends a question and stores the answer", async () => {
    const fetchMock = vi.fn().mockResolvedValue(reply("Farrukh builds games."));
    vi.stubGlobal("fetch", fetchMock);
    await useChatStore.getState().send("  What does he build?  ");
    const s = useChatStore.getState();
    expect(s.msgs.map((m) => m.role)).toEqual(["user", "assistant"]);
    expect(s.msgs[0].content).toBe("What does he build?");
    expect(s.revealId).toBe(s.msgs[1].id);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ message: "What does he build?", lang: "en" });
  });

  it("ignores empty and over-long input without calling the server", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await useChatStore.getState().send("   ");
    await useChatStore.getState().send("x".repeat(501));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(useChatStore.getState().msgs).toHaveLength(1);
    expect(useChatStore.getState().msgs[0].error).toBe(true);
  });

  it("shows the server's message on failure and retries without duplicating the question", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 429, json: async () => ({ error: "Slow down." }) }));
    await useChatStore.getState().send("Hello?");
    let s = useChatStore.getState();
    expect(s.msgs[1]).toMatchObject({ error: true, content: "Slow down.", retry: "Hello?" });

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply("Hi!")));
    useChatStore.getState().retry(s.msgs[1].id);
    await vi.waitFor(() => expect(useChatStore.getState().busy).toBe(false));
    s = useChatStore.getState();
    expect(s.msgs.map((m) => m.content)).toEqual(["Hello?", "Hi!"]);
  });

  it("stops a request in flight", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((_url: string, init: RequestInit) => new Promise((_, reject) => init.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError"))))),
    );
    const pending = useChatStore.getState().send("Long one");
    expect(useChatStore.getState().busy).toBe(true);
    useChatStore.getState().stop();
    await pending;
    const s = useChatStore.getState();
    expect(s.busy).toBe(false);
    expect(s.msgs).toHaveLength(1); // the question stays, no error bubble
  });

  it("regenerates the last answer in place", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(reply("First.")).mockResolvedValueOnce(reply("Second.")));
    await useChatStore.getState().send("Q");
    useChatStore.getState().regenerate();
    await vi.waitFor(() => expect(useChatStore.getState().busy).toBe(false));
    expect(useChatStore.getState().msgs.map((m) => m.content)).toEqual(["Q", "Second."]);
  });

  it("clears the chat and can undo it", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply("A")));
    await useChatStore.getState().send("Q");
    useChatStore.getState().clear();
    expect(useChatStore.getState().msgs).toHaveLength(0);
    useChatStore.getState().undoClear();
    expect(useChatStore.getState().msgs).toHaveLength(2);
    expect(useChatStore.getState().cleared).toBeNull();
  });
});
