"""Step 2: turn text into vectors.

Two interchangeable embedders:
  * MiniLMEmbedder  - real neural sentence embeddings (sentence-transformers). Best quality;
                      recommended in production. Needs `pip install sentence-transformers`.
  * LocalEmbedder   - dependency-free "hashing TF-IDF" dense vectors. Works offline, instantly,
                      and is accurate enough for a small, keyword-rich portfolio corpus.
Both return L2-normalised float32 matrices, so cosine similarity == inner product.
"""
from __future__ import annotations

import hashlib
import logging
import math
import re
from collections import Counter
from typing import Protocol

import numpy as np

log = logging.getLogger("rag.embeddings")


class Embedder(Protocol):
    kind: str
    dim: int

    def fit(self, texts: list[str]) -> None: ...
    def embed(self, texts: list[str]) -> np.ndarray: ...        # documents
    def embed_query(self, text: str) -> np.ndarray: ...          # one search query
    def state(self) -> dict: ...


STOP = set(
    "a an the of and or to in on for with is are was were be been by at as from that this it its his he her she "
    "they their about what which who whom how do does did can could would should has have had i you your me my we our "
    "not no yes any all some there here tell please also so if then than too very just farrukh "
    "where when why many much good great best well use used using get got give list show "
    "could please hey quick summary kind comfortable recruiter wondering explain example someone looking involved far "
    "like love whether mind curious interested say recommend describe overview details detail bit little actually "
    "really maybe probably want need try find out sort type called ever still already enough around more else another other further".split()
)
TOKEN_RE = re.compile(r"[a-z0-9][a-z0-9#+.\-]*")


def tokenize(text: str) -> list[str]:
    """Lower-case, drop stop-words, and apply a tiny stemmer (truncate long words, strip plural s)."""
    out = []
    for t in TOKEN_RE.findall(text.lower()):
        t = t.rstrip(".-")
        if len(t) < 2 or t in STOP:
            continue
        if t.isalpha():
            if len(t) > 6:
                t = t[:6]  # developer/development -> develo, internship -> intern
            elif t.endswith("s") and len(t) > 3:
                t = t[:-1]
        out.append(t)
    return out


def _features(text: str) -> Counter:
    toks = tokenize(text)
    feats = Counter(toks)
    for a, b in zip(toks, toks[1:]):
        feats[f"{a}_{b}"] += 0.6  # bigrams carry phrase meaning ("game jam", "full stack")
    return feats


# Words that mean (almost) the same thing for this domain. Applied to QUERIES only, so a
# visitor asking about "studying" still finds the Education entry. A neural embedder
# (MiniLM) learns this for free; this keeps the offline fallback useful.
SYNONYM_GROUPS = [
    "intern internship job work employer experience career role company position",
    "study studying education degree university college school student",
    "certificate certification certified course credential diploma",
    "story background journey biography bio about",
    "ai ml machine learning neural",
    "vr xr virtual reality headset",
    "skill technology technologies tools stack know language framework",
    "project built build made created game app application",
]
_GROUPS = [frozenset(tokenize(g)) for g in SYNONYM_GROUPS]


def _expand(feats: Counter) -> Counter:
    out = Counter(feats)
    for group in _GROUPS:
        hit = [t for t in group if t in feats]
        if hit:
            for t in group:
                if t not in feats:
                    out[t] += 0.35
    return out


def _hash(token: str, dim: int) -> tuple[int, float]:
    h = int.from_bytes(hashlib.blake2b(token.encode(), digest_size=8).digest(), "big")
    return h % dim, 1.0 if (h >> 40) & 1 else -1.0


class LocalEmbedder:
    """BM25 term weights hashed into a fixed-size vector.

    document vector  d_f = idf(f) * tf*(k1+1) / (tf + k1*(1-b+b*len/avglen))
    query vector     q_f = idf(f) / sum(idf over query features)
    so  <q, d>  is a BM25 score rescaled to ~[0, 1]: "what fraction of the query's
    (idf-weighted) terms does this chunk cover?". Inner product search (FAISS) works as-is.
    """

    kind = "local"
    K1, B = 1.4, 0.7

    def __init__(self, dim: int = 4096, idf: dict[str, float] | None = None, n_docs: int = 0, avgdl: float = 1.0):
        self.dim, self.idf, self.n_docs, self.avgdl = dim, idf or {}, n_docs, avgdl

    def fit(self, texts: list[str]) -> None:
        df: Counter = Counter()
        lengths = []
        for t in texts:
            feats = _features(t)
            df.update(set(feats))
            lengths.append(len(tokenize(t)))
        self.n_docs = len(texts)
        self.avgdl = max(1.0, sum(lengths) / max(1, len(lengths)))
        self.idf = {k: math.log(1 + (self.n_docs - v + 0.5) / (v + 0.5)) for k, v in df.items()}

    def _idf(self, token: str) -> float:
        return self.idf.get(token, math.log(1 + (self.n_docs + 0.5) / 0.5))

    def embed(self, texts: list[str]) -> np.ndarray:
        out = np.zeros((len(texts), self.dim), dtype=np.float32)
        for i, t in enumerate(texts):
            dl = max(1, len(tokenize(t)))
            norm = self.K1 * (1 - self.B + self.B * dl / self.avgdl)
            for tok, tf in _features(t).items():
                idx, sign = _hash(tok, self.dim)
                out[i, idx] += sign * self._idf(tok) * tf * (self.K1 + 1) / (tf + norm)
        return out

    def is_known(self, token: str) -> bool:
        """True if a (normalised) word appears anywhere in the knowledge base."""
        return token in self.idf

    def specificity(self, token: str) -> float:
        """IDF of a word: ~0.3 for generic words (skills, experience), 2.5+ for names (Docker, VR, Mask)."""
        return self.idf.get(token, 0.0)

    def embed_query(self, text: str) -> np.ndarray:
        feats = _expand(_features(text))
        vec = np.zeros(self.dim, dtype=np.float32)
        total = 0.0
        for tok, w in feats.items():
            if tok not in self.idf:  # unseen words can't match anything; they only dilute the score
                total += self._idf(tok) * min(w, 1.0) * (self.K1 + 1)
                continue
            idx, sign = _hash(tok, self.dim)
            weight = self._idf(tok) * min(w, 1.0)
            vec[idx] += sign * weight
            total += weight * (self.K1 + 1)
        return vec / max(total, 1e-9)

    def state(self) -> dict:
        return {"kind": self.kind, "dim": self.dim, "idf": self.idf, "n_docs": self.n_docs, "avgdl": self.avgdl}


class MiniLMEmbedder:
    kind = "minilm"

    def __init__(self, model_name: str):
        from sentence_transformers import SentenceTransformer  # heavy import, only when requested

        self.model_name = model_name
        self.model = SentenceTransformer(model_name)
        self.dim = int(self.model.get_sentence_embedding_dimension())

    def fit(self, texts: list[str]) -> None:  # pretrained: nothing to learn
        pass

    def embed(self, texts: list[str]) -> np.ndarray:
        v = self.model.encode(texts, normalize_embeddings=True, show_progress_bar=False)
        return np.asarray(v, dtype=np.float32)

    def embed_query(self, text: str) -> np.ndarray:
        return self.embed([text])[0]

    def state(self) -> dict:
        return {"kind": self.kind, "model": self.model_name, "dim": self.dim}


def build_embedder(choice: str, minilm_model: str) -> Embedder:
    if choice in ("auto", "minilm"):
        try:
            return MiniLMEmbedder(minilm_model)
        except Exception as e:  # not installed, or model can't be downloaded
            if choice == "minilm":
                raise
            log.warning("MiniLM unavailable (%s) - falling back to the local embedder", type(e).__name__)
    return LocalEmbedder()


def embedder_from_state(state: dict, minilm_model: str) -> Embedder:
    if state["kind"] == "minilm":
        return MiniLMEmbedder(state.get("model", minilm_model))
    return LocalEmbedder(dim=state["dim"], idf=state["idf"], n_docs=state["n_docs"], avgdl=state.get("avgdl", 1.0))
