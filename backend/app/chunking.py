"""Step 1 of the pipeline: read documents and split them into searchable chunks."""
import re
from dataclasses import dataclass, asdict
from pathlib import Path

HEADER_RE = re.compile(r"<!--\s*zone:\s*(\w+)\s*\|\s*title:\s*(.*?)\s*-->")
SENTENCE_RE = re.compile(r"(?<=[.!?])\s+")
MAX_WORDS = 140


@dataclass
class Chunk:
    id: str
    text: str        # what gets embedded and shown to the LLM (has context prefix)
    body: str        # the raw section text (used for snippets / citations)
    source: str      # file name
    doc_title: str
    heading: str
    zone: str        # which game zone the citation links to

    def to_dict(self) -> dict:
        return asdict(self)


def _split_long(body: str, max_words: int = MAX_WORDS) -> list[str]:
    """Pack sentences into windows of <= max_words with one sentence of overlap."""
    if len(body.split()) <= max_words:
        return [body]
    sentences = SENTENCE_RE.split(body)
    windows, cur = [], []
    for s in sentences:
        if cur and len(" ".join(cur + [s]).split()) > max_words:
            windows.append(" ".join(cur))
            cur = [cur[-1], s]  # overlap
        else:
            cur.append(s)
    if cur:
        windows.append(" ".join(cur))
    return windows


def chunk_markdown(text: str, source: str, default_zone: str = "plaza") -> list[Chunk]:
    m = HEADER_RE.search(text)
    zone = m.group(1) if m else default_zone
    doc_title = m.group(2) if m else Path(source).stem.replace("-", " ").title()
    text = HEADER_RE.sub("", text).strip()

    h1 = doc_title
    sections: list[tuple[str, list[str]]] = [(doc_title, [])]
    for line in text.splitlines():
        if line.startswith("# "):
            h1 = line[2:].strip()
            sections[0] = (h1, sections[0][1])
        elif line.startswith("## "):
            sections.append((line[3:].strip(), []))
        else:
            sections[-1][1].append(line)

    chunks: list[Chunk] = []
    for heading, lines in sections:
        body = re.sub(r"\n{2,}", "\n", "\n".join(lines)).strip()
        if len(body.split()) < 4:
            continue
        for i, piece in enumerate(_split_long(body)):
            label = heading if i == 0 else f"{heading} (part {i + 1})"
            chunks.append(
                Chunk(
                    id=f"{source}:{len(chunks)}",
                    text=f"{doc_title} — {label}\n{piece}",
                    body=piece,
                    source=source,
                    doc_title=doc_title,
                    heading=label,
                    zone=zone,
                )
            )
    return chunks


def read_pdf(path: Path) -> str:
    from pypdf import PdfReader  # optional dependency

    pages = [(p.extract_text() or "") for p in PdfReader(str(path)).pages]
    return "\n\n".join(pages)


def load_chunks(knowledge_dir: Path) -> list[Chunk]:
    chunks: list[Chunk] = []
    for path in sorted(knowledge_dir.glob("*")):
        if path.suffix.lower() in {".md", ".txt"}:
            chunks += chunk_markdown(path.read_text(encoding="utf-8"), path.name)
        elif path.suffix.lower() == ".pdf":
            # a CV PDF has no headers, so give it a header and let paragraphs form sections
            raw = read_pdf(path)
            chunks += chunk_markdown(f"<!-- zone: quest | title: {path.stem} -->\n## {path.stem}\n{raw}", path.name)
    # re-number ids globally so they are unique across files
    for i, c in enumerate(chunks):
        c.id = f"{i}:{c.source}"
    return chunks
