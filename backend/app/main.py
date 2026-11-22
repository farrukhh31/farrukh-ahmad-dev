"""FastAPI service exposing the chatbot:   uvicorn app.main:app --port 8000"""
from __future__ import annotations

import hmac
import logging
import time
from collections import defaultdict, deque
from contextlib import asynccontextmanager
from typing import Literal

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from .config import Settings
from .rag import RagEngine

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(message)s")
log = logging.getLogger("rag.api")


class Turn(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(max_length=1200)


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    history: list[Turn] = Field(default_factory=list, max_length=12)
    lang: Literal["en", "ur"] | None = None


class Source(BaseModel):
    title: str
    doc: str
    zone: str
    snippet: str
    score: float


class ChatResponse(BaseModel):
    answer: str
    grounded: bool
    sources: list[Source]
    language: str
    mode: str


class RateLimiter:
    """Sliding-window limiter, per client, in memory (fine for a single small instance)."""

    def __init__(self, per_minute: int):
        self.per_minute, self.hits = per_minute, defaultdict(deque)

    def check(self, key: str) -> int:
        """Returns 0 if allowed, otherwise seconds until the next request is allowed."""
        now = time.monotonic()
        q = self.hits[key]
        while q and now - q[0] > 60:
            q.popleft()
        if len(q) >= self.per_minute:
            return int(60 - (now - q[0])) + 1
        q.append(now)
        return 0


def create_app(settings: Settings | None = None, engine: RagEngine | None = None) -> FastAPI:
    settings = settings or Settings()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        app.state.engine = engine or RagEngine.load_or_build(settings)
        log.info("ready: %d chunks, embedder=%s, llm=%s", len(app.state.engine.chunks), app.state.engine.embedder.kind, app.state.engine.llm.name)
        yield

    app = FastAPI(title="Farrukh portfolio RAG chatbot", version="1.0", lifespan=lifespan)
    app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origins, allow_methods=["POST", "GET"], allow_headers=["content-type", "x-chat-secret", "x-client-ip"])
    limiter = RateLimiter(settings.rate_limit_per_min)

    @app.get("/api/health")
    def health(request: Request):
        e: RagEngine = request.app.state.engine
        return {"status": "ok", "chunks": len(e.chunks), "embedder": e.embedder.kind, "index": e.index.backend, "llm": e.llm.name, "min_score": e.min_score}

    @app.post("/api/chat", response_model=ChatResponse)
    def chat(body: ChatRequest, request: Request):
        client = request.client.host if request.client else "unknown"
        if settings.shared_secret:
            # only our own Next.js server may call this endpoint; it forwards the visitor's IP
            if not hmac.compare_digest(request.headers.get("x-chat-secret", ""), settings.shared_secret):
                raise HTTPException(status_code=403, detail="Forbidden")
            client = request.headers.get("x-client-ip", client)
        wait = limiter.check(client)
        if wait:
            raise HTTPException(status_code=429, detail="Too many messages, slow down.", headers={"Retry-After": str(wait)})
        e: RagEngine = request.app.state.engine
        result = e.chat(body.message, [t.model_dump() for t in body.history], body.lang)
        log.info("chat grounded=%s mode=%s lang=%s", result["grounded"], result["mode"], result["language"])  # never log the message text
        return result

    return app


app = create_app()
