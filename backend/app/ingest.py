"""Build (or rebuild) the vector index:   python -m app.ingest"""
import logging

from .config import Settings
from .rag import RagEngine

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    s = Settings()
    engine = RagEngine.build(s)
    print(f"documents: {s.knowledge_dir}")
    print(f"chunks:    {len(engine.chunks)}")
    print(f"embedder:  {engine.embedder.kind} (dim {engine.embedder.dim})")
    print(f"index:     {engine.index.backend} -> {s.index_dir}")
    print(f"min score: {engine.min_score}")
