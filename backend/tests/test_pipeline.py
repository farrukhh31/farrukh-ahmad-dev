import numpy as np
import pytest

from app.chunking import chunk_markdown, _split_long
from app.embeddings import LocalEmbedder, embedder_from_state, tokenize
from app.rag import detect_language, sanitize
from tests.eval_set import ANSWERABLE, UNANSWERABLE, VERBOSE_ANSWERABLE, VERBOSE_UNANSWERABLE


# ---------------------------------------------------------------- chunking
def test_chunking_reads_header_and_sections():
    md = "<!-- zone: projects | title: Demo -->\n# Demo\nIntro sentence for the whole document here.\n\n## Alpha\nAlpha is a project about robots and games.\n\n## Beta\nBeta is another project about web apps."
    chunks = chunk_markdown(md, "demo.md")
    assert [c.heading for c in chunks] == ["Demo", "Alpha", "Beta"]
    assert all(c.zone == "projects" and c.doc_title == "Demo" for c in chunks)
    assert "Alpha is a project" in chunks[1].body


def test_long_sections_are_split_with_overlap():
    body = " ".join(f"Sentence number {i} talks about something." for i in range(60))
    parts = _split_long(body, max_words=40)
    assert len(parts) > 2
    assert all(len(p.split()) <= 60 for p in parts)
    # overlap: the last sentence of a window starts the next one
    assert parts[0].split(". ")[-1].strip(". ") in parts[1]


def test_real_knowledge_is_chunked(engine):
    assert len(engine.chunks) >= 50
    zones = {c["zone"] for c in engine.chunks}
    assert {"projects", "skills", "quest", "trophy", "about", "plaza"} <= zones


# -------------------------------------------------------------- embeddings
def test_tokenizer_stems_and_drops_stopwords():
    assert tokenize("What is Farrukh's internship?") == ["intern"]
    assert tokenize("Developer development") == ["develo", "develo"]


def test_local_embedder_state_roundtrip():
    texts = ["unity game stealth", "react next typescript web", "docker kubernetes devops"]
    a = LocalEmbedder()
    a.fit(texts)
    b = embedder_from_state(a.state(), "x")
    q = a.embed_query("which game uses unity")
    assert np.allclose(q, b.embed_query("which game uses unity"))
    assert np.allclose(a.embed(texts), b.embed(texts))


def test_vectors_have_fixed_dimension(engine):
    assert engine.index.vectors.shape == (len(engine.chunks), engine.embedder.dim)


# --------------------------------------------------------------- retrieval
def test_retrieval_quality_hit_at_4(engine):
    ok = sum(any(pred(h) for h in engine.retrieve(q, 4)) for q, pred in ANSWERABLE)
    assert ok / len(ANSWERABLE) >= 0.90, f"hit@4 only {ok}/{len(ANSWERABLE)}"


@pytest.mark.parametrize("question", UNANSWERABLE)
def test_out_of_scope_questions_are_refused(engine, question):
    out = engine.chat(question)
    assert out["grounded"] is False and out["sources"] == []
    assert "won't guess" in out["answer"] or "can only help" in out["answer"]


def test_in_scope_questions_are_grounded_and_cited(engine):
    out = engine.chat("Tell me about the ragdoll fighting game")
    assert out["grounded"] and out["sources"]
    assert out["sources"][0]["zone"] == "projects"
    assert "ragdoll" in out["answer"].lower()


def test_extractive_answer_never_adds_words_that_are_not_in_sources(engine):
    out = engine.chat("Does he know Kubernetes?")
    corpus = " ".join(c["body"] for c in engine.chunks).lower()
    for word in set(tokenize(out["answer"])):
        assert word in set(tokenize(corpus)), word


def test_small_talk_skips_retrieval(engine):
    for msg in ("hi", "Hello!", "thanks", "who are you"):
        out = engine.chat(msg)
        assert out["grounded"] and out["sources"] == []


def test_follow_up_keeps_topic(engine):
    history = [{"role": "user", "content": "Tell me about Mask Jam"}, {"role": "assistant", "content": "It is a stealth game."}]
    out = engine.chat("what technologies?", history)
    assert out["grounded"] and "Mask Jam" in out["sources"][0]["title"]


def test_input_helpers():
    assert detect_language("Tell me about projects") == "en"
    assert detect_language("What are his skills and certifications?") == "en"
    assert detect_language("فرخ کے پروجیکٹس کیا ہیں؟") == "ur"
    assert detect_language("Farrukh ke projects kya hain?") == "ur"
    assert detect_language("Unka tajurba aur taleem batao") == "ur"
    assert detect_language("Farrukh kya karta hai?") == "ur"
    assert detect_language("Mujhe skills dikhao") == "ur"
    assert sanitize("  hello \u0000 \n\n world  ", 50) == "hello world"
    assert len(sanitize("x" * 1000, 500)) == 500


def test_roman_urdu_small_talk_and_explicit_lang(engine):
    # Roman Urdu greetings and thanks
    g1 = engine.chat("salam", lang="ur")
    assert g1["grounded"] and g1["language"] == "ur"
    assert "السلام علیکم" in g1["answer"]

    t1 = engine.chat("shukriya", lang="ur")
    assert t1["grounded"] and t1["language"] == "ur"
    assert "خوش آمدید" in t1["answer"]

    # Explicit override: message in English but lang="ur" -> language is "ur"
    e1 = engine.chat("hi", lang="ur")
    assert e1["language"] == "ur"
    assert "السلام علیکم" in e1["answer"]

    # Explicit override: message in Urdu or Roman Urdu but lang="en" -> language is "en"
    e2 = engine.chat("salam", lang="en")
    assert e2["language"] == "en"
    assert "Hi!" in e2["answer"]


def test_wordy_questions_still_find_the_right_chunk(engine):
    ok = sum(any(any(k.lower() in h["heading"].lower() for k in keys) for h in engine.retrieve(q, 4)) for q, keys in VERBOSE_ANSWERABLE)
    assert ok / len(VERBOSE_ANSWERABLE) >= 0.70, f"verbose hit@4 only {ok}/{len(VERBOSE_ANSWERABLE)}"


@pytest.mark.parametrize("question", VERBOSE_UNANSWERABLE)
def test_wordy_out_of_scope_questions_are_refused(engine, question):
    assert engine.chat(question)["grounded"] is False


def test_new_short_question_does_not_borrow_the_previous_topic(engine):
    history = [{"role": "user", "content": "What is Mask Jam?"}, {"role": "assistant", "content": "A stealth game."}]
    out = engine.chat("What is Farrukh's salary?", history)
    assert out["grounded"] is False and out["sources"] == []
    assert engine.chat("how about the VR project?", history)["grounded"] is True


def test_follow_up_that_names_its_own_topic_is_not_merged(engine):
    history = [{"role": "user", "content": "What is Mask Jam?"}, {"role": "assistant", "content": "A stealth game."}]
    out = engine.chat("how about the VR project?", history)
    assert out["grounded"] and "VR Pit Stop" in out["sources"][0]["title"]
    out = engine.chat("and what about Docker?", history)
    assert out["sources"][0]["title"] == "Skill: Docker"


def test_generic_follow_ups_keep_the_previous_topic(engine):
    history = [{"role": "user", "content": "What is Mask Jam?"}, {"role": "assistant", "content": "A stealth game."}]
    for q in ("what technologies?", "tell me more"):
        assert "Mask Jam" in engine.chat(q, history)["sources"][0]["title"], q
