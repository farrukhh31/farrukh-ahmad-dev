"""Step 3: store vectors and search them (FAISS if installed, otherwise NumPy)."""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np

try:
    import faiss  # type: ignore
except Exception:  # pragma: no cover
    faiss = None


class VectorIndex:
    def __init__(self, vectors: np.ndarray):
        self.vectors = np.ascontiguousarray(vectors, dtype=np.float32)
        self.backend = "faiss" if faiss is not None else "numpy"
        self._index = None
        if faiss is not None:
            self._index = faiss.IndexFlatIP(self.vectors.shape[1])  # inner product == cosine (vectors are normalised)
            self._index.add(self.vectors)

    def search(self, query: np.ndarray, k: int) -> list[tuple[int, float]]:
        q = np.ascontiguousarray(query.reshape(1, -1), dtype=np.float32)
        k = min(k, len(self.vectors))
        if self._index is not None:
            scores, ids = self._index.search(q, k)
            return [(int(i), float(s)) for i, s in zip(ids[0], scores[0]) if i >= 0]
        sims = (self.vectors @ q[0]).astype(np.float32)
        top = np.argsort(-sims)[:k]
        return [(int(i), float(sims[i])) for i in top]

    # persistence -----------------------------------------------------------
    def save(self, directory: Path, chunks: list[dict], embedder_state: dict) -> None:
        directory.mkdir(parents=True, exist_ok=True)
        np.save(directory / "vectors.npy", self.vectors)
        (directory / "chunks.json").write_text(json.dumps(chunks, ensure_ascii=False, indent=1), encoding="utf-8")
        (directory / "embedder.json").write_text(json.dumps(embedder_state), encoding="utf-8")

    @classmethod
    def load(cls, directory: Path) -> tuple["VectorIndex", list[dict], dict]:
        vectors = np.load(directory / "vectors.npy")
        chunks = json.loads((directory / "chunks.json").read_text(encoding="utf-8"))
        state = json.loads((directory / "embedder.json").read_text(encoding="utf-8"))
        return cls(vectors), chunks, state
