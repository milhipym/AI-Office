import pytest

import app as app_module
from agents import assistant
from services import storage
from services.text import strip_emoji


@pytest.mark.parametrize("raw,clean", [
    ("## 📌 요약", "## 요약"),
    ("- 완료 ✅ 됨", "- 완료 됨"),
    ("👍🏻 좋아요", "좋아요"),
    ("1️⃣ 첫째", "1 첫째"),
    ("끝✅", "끝"),
    ("완료 ✅\n다음", "완료\n다음"),
    ("👨‍👩‍👧 가족", "가족"),
    ("화살표 → 유지 · 가운뎃점", "화살표 → 유지 · 가운뎃점"),
    ("", ""),
])
def test_strip_emoji(raw, clean):
    assert strip_emoji(raw) == clean


def test_ai_replies_are_stored_without_emoji(tmp_path, monkeypatch):
    monkeypatch.setattr(storage, "CHAT_HISTORY_FILE", tmp_path / "chat.json")
    monkeypatch.setattr(assistant, "is_openai_configured", lambda: True)
    monkeypatch.setattr(assistant, "chat_completion", lambda **kw: {
        "text": "## 🚀 배포 체크리스트\n- 테스트 ✅", "model": "m", "tokens": 1, "latency_ms": 1})
    client = app_module.app.test_client()
    body = client.post("/api/chat", json={"message": "/비서 배포 체크리스트 😀"}).get_json()
    assert body["ai_response"]["message"] == "## 배포 체크리스트\n- 테스트"
    # The user's own text is kept as typed.
    assert body["user_message"]["message"] == "/비서 배포 체크리스트 😀"
