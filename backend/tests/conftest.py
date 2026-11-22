import json
import sys
from pathlib import Path

import httpx
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.config import Settings  # noqa: E402
from app.llm import AnthropicLLM, ExtractiveLLM  # noqa: E402
from app.rag import RagEngine  # noqa: E402


@pytest.fixture(scope="session")
def settings(tmp_path_factory):
    s = Settings()
    s.index_dir = tmp_path_factory.mktemp("index")
    s.embedder = "local"
    s.llm_provider = "extractive"
    s.anthropic_api_key = ""
    return s


@pytest.fixture(scope="session")
def engine(settings):
    return RagEngine.build(settings, llm=ExtractiveLLM())


class FakeAnthropic:
    """httpx transport that records requests and answers like the Messages API."""

    def __init__(self, reply="Mock answer.", status=200, translation=None, rewrite=None):
        self.requests, self.reply, self.status, self.translation, self.rewrite = [], reply, status, translation, rewrite

    def __call__(self, request: httpx.Request) -> httpx.Response:
        body = json.loads(request.content)
        self.requests.append({"headers": dict(request.headers), "body": body, "url": str(request.url)})
        if self.status != 200:
            return httpx.Response(self.status, json={"error": "boom"})
        if self.rewrite and "keyword search query" in body["system"]:
            return httpx.Response(200, json={"content": [{"type": "text", "text": self.rewrite}]})
        text = self.translation if (self.translation and "Translate the user's message" in body["system"]) else self.reply
        return httpx.Response(200, json={"content": [{"type": "text", "text": text}]})


@pytest.fixture
def make_llm_engine(settings, engine):  # `engine` builds the index first
    def build(fake: FakeAnthropic):
        llm = AnthropicLLM("test-key", "claude-haiku-5-5", transport=httpx.MockTransport(fake))
        return RagEngine.load(settings, llm=llm)

    return build
