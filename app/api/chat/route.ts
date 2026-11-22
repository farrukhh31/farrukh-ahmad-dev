import { NextResponse } from "next/server";

/**
 * Server-side proxy to the Python RAG service.
 *  - the backend URL and shared secret stay on the server (never sent to the browser)
 *  - input is validated here too, before anything is forwarded
 *  - the visitor's IP is passed on so the backend can rate-limit per person
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_MESSAGE = 500;
const MAX_HISTORY = 8;

type Turn = { role: "user" | "assistant"; content: string };

function bad(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

export async function POST(req: Request) {
  const base = process.env.CHAT_API_URL;
  if (!base) return bad("The chatbot is not configured yet.", 503);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return bad("Invalid request.");
  }
  const b = (body ?? {}) as { message?: unknown; history?: unknown; lang?: unknown };

  const message = typeof b.message === "string" ? b.message.trim() : "";
  if (!message) return bad("Please type a question.");
  if (message.length > MAX_MESSAGE) return bad(`Please keep your question under ${MAX_MESSAGE} characters.`);

  const history: Turn[] = Array.isArray(b.history)
    ? b.history
        .filter((t): t is Turn => !!t && typeof t === "object" && ["user", "assistant"].includes((t as Turn).role) && typeof (t as Turn).content === "string")
        .slice(-MAX_HISTORY)
        .map((t) => ({ role: t.role, content: t.content.slice(0, 600) }))
    : [];
  const lang = b.lang === "ur" || b.lang === "en" ? b.lang : undefined;

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

  try {
    const upstream = await fetch(`${base.replace(/\/$/, "")}/api/chat`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-chat-secret": process.env.CHAT_SHARED_SECRET ?? "",
        "x-client-ip": ip,
      },
      body: JSON.stringify({ message, history, lang }),
      signal: AbortSignal.timeout(25_000),
      cache: "no-store",
    });

    if (upstream.status === 429) {
      return NextResponse.json(
        { error: "You're sending messages too quickly. Please wait a moment." },
        { status: 429, headers: { "retry-after": upstream.headers.get("retry-after") ?? "30" } },
      );
    }
    if (!upstream.ok) return bad("The assistant is unavailable right now. Please try again shortly.", 502);
    return NextResponse.json(await upstream.json());
  } catch {
    return bad("The assistant is unavailable right now. Please try again shortly.", 502);
  }
}
