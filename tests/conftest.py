import sys
from datetime import date
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from agents import brain_agents  # noqa: E402
from services import brain_store  # noqa: E402

TODAY = date(2026, 10, 14)  # a Wednesday


@pytest.fixture(autouse=True)
def isolated_db(tmp_path, monkeypatch):
    monkeypatch.setattr(brain_store, "DB_PATH", tmp_path / "brain.db")
    monkeypatch.setattr(brain_agents, "today", lambda: TODAY)
    monkeypatch.setattr(brain_agents, "is_openai_configured", lambda: True)


class FakeOpenAI:
    """Records calls and returns canned responses for the brain agents."""

    def __init__(self):
        self.json_responses = []
        self.chat_calls = []
        self.embed_fail = False

    def json_completion(self, system_prompt, user_message, model=None):
        return {"data": self.json_responses.pop(0), "model": model, "tokens": 1, "latency_ms": 1}

    def chat_completion(self, system_prompt, user_message, history=None, model=None, temperature=0.7):
        self.chat_calls.append({"system": system_prompt, "user": user_message, "model": model})
        return {"text": "요약 결과 [#1]", "model": model, "tokens": 1, "latency_ms": 1}

    def embed(self, texts, model=None):
        if self.embed_fail:
            raise brain_agents.OpenAIError("embedding down")
        # Tiny deterministic vectors: dimension per keyword.
        keys = ["결제", "장애", "회의", "배포"]
        return [[1.0 if k in t else 0.0 for k in keys] + [0.1] for t in texts]


@pytest.fixture
def fake_openai(monkeypatch):
    fake = FakeOpenAI()
    monkeypatch.setattr(brain_agents, "json_completion", fake.json_completion)
    monkeypatch.setattr(brain_agents, "chat_completion", fake.chat_completion)
    monkeypatch.setattr(brain_agents, "embed", fake.embed)
    return fake
