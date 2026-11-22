"""Print retrieval quality and score separation:   python -m tests.calibrate
Run this after changing the embedder or the knowledge files, then set MIN_SCORE accordingly."""
from app.config import Settings
from app.rag import RagEngine
from tests.eval_set import ANSWERABLE, UNANSWERABLE

e = RagEngine.load_or_build(Settings())
ans, h1, h4 = [], 0, 0
for q, pred in ANSWERABLE:
    hits = e.retrieve(q, 4)
    ans.append(max(h["base"] for h in hits))
    h1 += pred(hits[0])
    h4 += any(pred(h) for h in hits)
un = [max(h["base"] for h in e.retrieve(q, 4)) for q in UNANSWERABLE]
print(f"embedder={e.embedder.kind} llm={e.llm.name} chunks={len(e.chunks)} current min_score={e.min_score}")
print(f"hit@1 {h1}/{len(ANSWERABLE)}   hit@4 {h4}/{len(ANSWERABLE)}")
print(f"answerable top score: min {min(ans):.3f}  median {sorted(ans)[len(ans)//2]:.3f}")
print(f"unanswerable top score: max {max(un):.3f}")
for th in (0.10, 0.15, 0.20, 0.25, 0.30, 0.35, 0.40, 0.50):
    print(f"  threshold {th:.2f}: answerable kept {sum(s >= th for s in ans)}/{len(ans)}, unanswerable refused {sum(s < th for s in un)}/{len(un)}")
