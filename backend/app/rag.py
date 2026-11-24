"""The RAG pipeline: sanitise -> (translate) -> retrieve -> ground-check -> generate -> cite."""
from __future__ import annotations

import logging
import re
import unicodedata

from .chunking import load_chunks
from .config import Settings
from .embeddings import _GROUPS, Embedder, build_embedder, embedder_from_state, tokenize
from .llm import LLM, LLMError, build_llm
from .vector_index import VectorIndex

log = logging.getLogger("rag.engine")

# Retrieval score below which we refuse instead of answering. Calibrated with
# `python -m tests.calibrate` on tests/eval_set.py. Stricter without an LLM, because then
# nothing downstream can notice that the retrieved text doesn't really answer the question.
DEFAULT_MIN_SCORE = {
    ("local", "anthropic"): 0.15,
    ("local", "extractive"): 0.25,
    ("minilm", "anthropic"): 0.30,   # re-run tests.calibrate after switching embedders
    ("minilm", "extractive"): 0.35,
}
FOLLOW_UP_MAX_IDF = 2.0  # words rarer than this name a topic of their own
REWRITE_FLOOR = 0.02  # below this nothing matched at all, so a rewrite can't help

TEXT = {
    "en": {
        "refuse": "I couldn't find that in Farrukh's portfolio, so I won't guess. You can ask about his projects, skills, experience, education or certificates, or send him a message from the Comms Tower.",
        "hello": "Hi! I'm Farrukh's portfolio assistant. Ask me about his projects, skills, experience, education or certificates.",
        "thanks": "You're welcome! Ask me anything else about Farrukh's work.",
        "about": "I'm an AI assistant that answers questions about Farrukh using only the information in this portfolio. If something isn't there, I'll tell you instead of guessing.",
        "no_urdu": "Urdu replies need the AI language model, which isn't connected right now. Please ask in English and I'll answer from Farrukh's portfolio.",
        "error": "Sorry, I couldn't generate an answer just now. Please try again in a moment.",
        "scope": "I can only help with questions about Farrukh's portfolio, so I can't do that. Try asking about his projects, skills, experience, education or certificates.",
    },
    "ur": {
        "refuse": "مجھے فرخ کے پورٹ فولیو میں یہ معلومات نہیں ملیں، اس لیے میں اندازے سے جواب نہیں دوں گا۔ آپ ان کے پروجیکٹس، مہارتوں، تجربے، تعلیم یا سرٹیفکیٹس کے بارے میں پوچھ سکتے ہیں، یا Comms Tower سے انہیں پیغام بھیج سکتے ہیں۔",
        "hello": "السلام علیکم! میں فرخ کے پورٹ فولیو کا اسسٹنٹ ہوں۔ ان کے پروجیکٹس، مہارتوں، تجربے، تعلیم یا سرٹیفکیٹس کے بارے میں پوچھیں۔",
        "thanks": "خوش آمدید! فرخ کے کام کے بارے میں کچھ اور پوچھنا چاہیں تو ضرور پوچھیں۔",
        "about": "میں ایک AI اسسٹنٹ ہوں جو صرف اس پورٹ فولیو کی معلومات کی بنیاد پر فرخ کے بارے میں سوالات کے جواب دیتا ہے۔",
        "no_urdu": "اردو جوابات کے لیے AI لینگویج ماڈل درکار ہے جو ابھی منسلک نہیں ہے۔ براہِ کرم انگریزی میں پوچھیں۔",
        "error": "معذرت، ابھی جواب تیار نہیں ہو سکا۔ براہِ کرم تھوڑی دیر بعد دوبارہ کوشش کریں۔",
        "scope": "میں صرف فرخ کے پورٹ فولیو سے متعلق سوالات میں مدد کر سکتا ہوں۔ ان کے پروجیکٹس، مہارتوں، تجربے یا سرٹیفکیٹس کے بارے میں پوچھیں۔",
    },
}

GREETING_RE = re.compile(
    r"^\s*(hi|hello|hey|hiya|good\s+(morning|afternoon|evening)|salam|assalam[\w\s-]*|adaab|السلام\s+علیکم|سلام|ہیلو|کیسے\s+ہو|کیا\s+حال\s+ہے)\W*\s*$",
    re.I,
)
THANKS_RE = re.compile(
    r"^\s*(thanks|thank\s+you|thx|ty|shukriya|meherbani|bohot\s+shukriya|bahut\s+shukriya|شکریہ|بہت\s+شکریہ|مہربانی)\W*\s*$",
    re.I,
)
ABOUT_RE = re.compile(
    r"^\s*(who\s+are\s+you|what\s+are\s+you|what\s+can\s+you\s+do|help|what\s+can\s+i\s+ask|aap\s+kaun\s+hain|aap\s+kon\s+hain|tum\s+kon\s+ho|tum\s+kaun\s+ho|aap\s+kya\s+kar\s+sakte\s+hain|kya\s+madad\s+kar\s+sakte\s+ho|آپ\s+کون\s+ہیں|کیا\s+کر\s+سکتے\s+ہیں|مدد)\W*\s*$",
    re.I,
)


# Obvious prompt-injection / prompt-extraction phrasing. This is a cheap first filter
# (defence in depth); the real protection is that the model only ever sees retrieved
# facts plus rules that tell it to treat the question as data.
INJECTION_RE = re.compile(
    r"(ignore|disregard|forget|override)\s+(all\s+|any\s+|your\s+|the\s+|previous\s+|prior\s+|above\s+|earlier\s+)+"
    r"(instructions?|rules?|prompts?|guidelines?|directions?|restrictions?)"
    r"|(reveal|show|print|repeat|output|leak|display)\s+(me\s+)?(your\s+|the\s+)(system\s+)?(prompt|instructions|rules)"
    r"|system\s+prompt|you\s+are\s+now\b|pretend\s+(to\s+be|you)|jailbreak|developer\s+mode|\bDAN\b",
    re.I,
)


def sanitize(text: str, max_chars: int) -> str:
    text = unicodedata.normalize("NFKC", text)
    text = "".join(ch for ch in text if ch == "\n" or unicodedata.category(ch)[0] != "C")
    return re.sub(r"\s+", " ", text).strip()[:max_chars]


# Words that unmistakably indicate Roman Urdu (low-to-zero false positive on English text)
DISTINCTIVE_ROMAN_URDU = {
    "kya", "kaise", "kaisay", "kidhar", "kahan", "batao", "bataiye", "bataen",
    "dikhao", "dikhayein", "unka", "unki", "unke", "aapka", "aapki", "aapke",
    "mujhe", "shukriya", "meherbani", "tajurba", "taleem", "parhai", "kaam",
    "humein", "humara", "humari", "humare", "tumhara", "tumhari", "tumhare",
    "karta", "karti", "karte", "honge", "nahin", "bohot", "bahut", "zyada"
}

ROMAN_URDU_MARKERS = {
    "kya", "kyun", "kyon", "kaise", "kaisay", "kab", "kahan", "kidhar", "kon", "kaun",
    "kis", "kisi", "kisne", "kisko", "kiska", "kiski", "kiske",
    "mujhe", "mera", "meri", "mere", "humein", "humara", "humari", "humare",
    "aap", "aapka", "aapki", "aapke", "tum", "tumhara", "tumhari", "tumhare",
    "uska", "uski", "uske", "unka", "unki", "unke", "inhe", "inka", "inki", "inke",
    "kuch", "koi", "sab", "yeh", "woh",
    "hai", "hain", "ho", "hoon", "tha", "thi", "the", "hoga", "hogi", "honge",
    "karta", "karti", "karte", "karna", "karein", "karo", "kiya", "kiye", "gaya",
    "batao", "bataiye", "bataen", "dikhao", "dikhayein",
    "aur", "ya", "lekin", "magar", "bhi", "nahi", "nahin", "bohot", "bahut", "zyada",
    "shukriya", "meherbani", "bare", "mein", "wali", "wala", "wale",
    "parhai", "taleem", "tajurba", "kaam", "maloomat"
}


def detect_language(text: str) -> str:
    letters = [c for c in text if c.isalpha()]
    if not letters:
        return "en"
    # Arabic / Urdu script characters
    arabic = sum(1 for c in letters if ("\u0600" <= c <= "\u06ff") or ("\u0750" <= c <= "\u077f") or ("\ufb50" <= c <= "\ufdff") or ("\ufe70" <= c <= "\ufeff"))
    if arabic > 0 and (arabic / len(letters) > 0.15 or arabic >= 2):
        return "ur"

    tokens = [w.lower().strip("?,.!:;\"'()[]{}~`-_") for w in text.split()]
    tokens = [t for t in tokens if t]
    if not tokens:
        return "en"

    distinctive_hits = sum(1 for t in tokens if t in DISTINCTIVE_ROMAN_URDU)
    general_hits = sum(1 for t in tokens if t in ROMAN_URDU_MARKERS)

    if distinctive_hits >= 1 or general_hits >= 2:
        return "ur"

    return "en"


class RagEngine:
    def __init__(self, settings: Settings, embedder: Embedder, index: VectorIndex, chunks: list[dict], llm: LLM):
        self.settings, self.embedder, self.index, self.chunks, self.llm = settings, embedder, index, chunks, llm
        self.min_score = settings.min_score if settings.min_score is not None else DEFAULT_MIN_SCORE.get((embedder.kind, llm.name), 0.25)
        self.rewrite_below = max(0.35, self.min_score * 2)

    # ---- building / loading ------------------------------------------------
    @classmethod
    def build(cls, settings: Settings, llm: LLM | None = None) -> "RagEngine":
        chunk_objs = load_chunks(settings.knowledge_dir)
        if not chunk_objs:
            raise RuntimeError(f"No documents found in {settings.knowledge_dir}")
        embedder = build_embedder(settings.embedder, settings.minilm_model)
        embedder.fit([c.text for c in chunk_objs])
        vectors = embedder.embed([c.text for c in chunk_objs])
        index = VectorIndex(vectors)
        chunks = [c.to_dict() for c in chunk_objs]
        index.save(settings.index_dir, chunks, embedder.state())
        log.info("indexed %d chunks with %s (%s)", len(chunks), embedder.kind, index.backend)
        return cls(settings, embedder, index, chunks, llm or build_llm(settings.llm_provider, settings.anthropic_api_key, settings.anthropic_model))

    @classmethod
    def load(cls, settings: Settings, llm: LLM | None = None) -> "RagEngine":
        index, chunks, state = VectorIndex.load(settings.index_dir)
        embedder = embedder_from_state(state, settings.minilm_model)
        return cls(settings, embedder, index, chunks, llm or build_llm(settings.llm_provider, settings.anthropic_api_key, settings.anthropic_model))

    @classmethod
    def load_or_build(cls, settings: Settings, llm: LLM | None = None) -> "RagEngine":
        try:
            return cls.load(settings, llm)
        except Exception:
            return cls.build(settings, llm)

    # ---- retrieval ---------------------------------------------------------
    HEADING_BOOST = 0.30

    def retrieve(self, query: str, k: int | None = None) -> list[dict]:
        """Vector search, then a small re-rank that favours chunks whose HEADING names what was asked.

        `base` is the raw similarity and is what decides answer-vs-refuse; `score` includes the
        boost and is only used for ordering, so a boost can never turn a non-answer into an answer.

        Without it, an overview chunk that merely lists every project title can outrank the
        chunk that is actually about the project the visitor named.
        """
        k = k or self.settings.top_k
        vec = self.embedder.embed_query(query)
        hits = self.index.search(vec, min(len(self.chunks), k * 3))
        q_tokens = set(tokenize(query))
        wanted = set(q_tokens)
        for group in _GROUPS:  # "studying" should also match a heading that says "Education"
            if group & q_tokens:
                wanted |= group
        ranked = []
        for i, score in hits:
            c = self.chunks[i]
            overlap = min(1.0, len(wanted & set(tokenize(c["heading"]))) / len(q_tokens)) if q_tokens and score > 0 else 0.0
            ranked.append({**c, "_rank": score + self.HEADING_BOOST * overlap, "base": round(min(1.0, score), 4)})
        ranked.sort(key=lambda h: h["_rank"], reverse=True)  # sort BEFORE capping, or ties hide the best chunk
        for h in ranked:
            h["score"] = round(min(1.0, h.pop("_rank")), 4)
        return ranked[:k]

    def _is_follow_up(self, message: str) -> bool:
        """A short, elliptical question that leans on the previous one ("and his skills?").

        A short question about something NEW ("what is his salary?") must not borrow the previous
        topic, or the old topic would silently answer a question nobody asked. So every content word
        has to be known to the knowledge base; with a model that can't tell us (MiniLM) we only
        merge when an LLM sits behind it to notice a mismatch.
        """
        if len(message.split()) > 6:
            return False
        known = getattr(self.embedder, "is_known", None)
        if known:
            tokens = tokenize(message)
            # every word known, and none of them a specific name (a rare word like "VR" or "Docker"
            # means the visitor is naming a NEW topic, not elaborating on the last one)
            return all(known(t) for t in tokens) and all(self.embedder.specificity(t) < FOLLOW_UP_MAX_IDF for t in tokens)
        return self.llm.name != "extractive"

    # ---- the full pipeline -------------------------------------------------
    def chat(self, message: str, history: list[dict] | None = None, lang: str | None = None) -> dict:
        s = self.settings
        message = sanitize(message, s.max_message_chars)
        language = lang if lang in ("en", "ur") else detect_language(message)
        t = TEXT[language]
        base = {"language": language, "mode": self.llm.name}

        def reply(text: str, grounded: bool, sources: list | None = None) -> dict:
            return {"answer": text, "grounded": grounded, "sources": sources or [], **base}

        # small talk never needs retrieval
        if GREETING_RE.match(message):
            return reply(t["hello"], True)
        if THANKS_RE.match(message):
            return reply(t["thanks"], True)
        if ABOUT_RE.match(message):
            return reply(t["about"], True)

        if INJECTION_RE.search(message):
            return reply(t["scope"], False)

        # retrieval query: English text. Urdu is translated first (needs the LLM).
        query = message
        if language == "ur":
            english = self.llm.translate_to_english(message)
            if not english:
                return reply(t["no_urdu"], False)
            query = english

        history = [h for h in (history or []) if h.get("role") in ("user", "assistant")][-6:]
        last_user = next((h["content"] for h in reversed(history) if h["role"] == "user"), "")
        if last_user and self._is_follow_up(query):
            query = f"{last_user} {query}"  # "what technologies?" -> keep the topic of the previous question

        candidates = self.retrieve(query)
        best = max((h["base"] for h in candidates), default=0.0)
        rewrite = getattr(self.llm, "rewrite_query", None)
        if rewrite and REWRITE_FLOOR <= best < self.rewrite_below:
            # weak but non-zero match: let the model turn the chatty question into keywords and retry
            rewritten = rewrite(query)
            if rewritten and rewritten.lower() != query.lower():
                retry = self.retrieve(rewritten)
                retry_best = max((h["base"] for h in retry), default=0.0)
                if retry_best > best:
                    candidates, best = retry, retry_best
        hits = [h for h in candidates if h["score"] >= self.min_score] if best >= self.min_score else []
        if not hits:
            return reply(t["refuse"], False)

        context = "\n\n".join(f'<doc id="{i + 1}" title="{h["doc_title"]} - {h["heading"]}">\n{h["body"]}\n</doc>' for i, h in enumerate(hits))
        convo = [{"role": h["role"], "content": sanitize(h["content"], 600)} for h in history]
        while convo and convo[0]["role"] != "user":
            convo.pop(0)
        convo.append({"role": "user", "content": f"<context>\n{context}\n</context>\n\n[Instruction: Reply in {language.upper()}]\nVisitor question: {message}"})

        try:
            answer = self.llm.generate(query, convo, language, hits, s.max_output_tokens)
        except LLMError as e:
            log.warning("LLM failed, falling back to extractive answer: %s", e)
            from .llm import ExtractiveLLM

            # The extractive fallback cannot translate. Never return English snippets for an Urdu request.
            answer = t["no_urdu"] if language == "ur" else ExtractiveLLM().generate(query, convo, language, hits, s.max_output_tokens)
        if not answer:
            return reply(t["error"], False)

        sources, seen = [], set()
        for h in hits:
            key = h["heading"]
            if key in seen:
                continue
            seen.add(key)
            sources.append({"title": h["heading"], "doc": h["doc_title"], "zone": h["zone"], "snippet": h["body"][:180], "score": h["score"]})
            if len(sources) == 3:
                break
        return reply(answer, True, sources)
