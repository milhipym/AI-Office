import app as app_module
from services import storage


def test_chat_command_and_entries_api(fake_openai, tmp_path, monkeypatch):
    monkeypatch.setattr(storage, "CHAT_HISTORY_FILE", tmp_path / "chat.json")
    fake_openai.json_responses.append({"entries": [{"title": "배포", "category": "개발", "date": "2026-10-14"}]})
    client = app_module.app.test_client()

    res = client.post("/api/chat", json={"message": "/기록 오늘 배포 완료"})
    assert res.status_code == 200
    body = res.get_json()
    assert body["ai_response"]["agent"] == "archivist"
    assert body["ai_response"]["metadata"]["brain_refresh"] is True
    assert body["ai_response"]["metadata"]["routed_by"] == "command"

    entries = client.get("/api/entries").get_json()
    assert [e["title"] for e in entries] == ["배포"]
    assert "embedding" not in entries[0]

    assert client.delete(f"/api/entries/{entries[0]['id']}").status_code == 200
    assert client.delete(f"/api/entries/{entries[0]['id']}").status_code == 404
    assert client.get("/api/entries").get_json() == []


def test_brain_meta_agents_and_office():
    client = app_module.app.test_client()
    meta = client.get("/api/brain/meta").get_json()
    assert "기타" in meta["categories"]
    assert set(meta["models"]) >= {"archivist", "finder", "reporter", "coach", "embedding"}
    ids = {a["id"] for a in client.get("/api/agents").get_json()}
    assert ids == {"dispatcher", "assistant", "scheduler", "archivist", "minutes", "finder", "reporter", "coach"}
    office = client.get("/api/office").get_json()
    assert office["grid"] == {"cols": 9, "rows": 6}
    assert any(r.get("planned") for r in office["rooms"])


def test_smalltalk_answered_by_dispatcher(tmp_path, monkeypatch):
    monkeypatch.setattr(storage, "CHAT_HISTORY_FILE", tmp_path / "chat.json")
    client = app_module.app.test_client()
    body = client.post("/api/chat", json={"message": "안녕하세요"}).get_json()
    assert body["ai_response"]["agent"] == "dispatcher"


def test_route_then_chat_classifies_once(tmp_path, monkeypatch):
    import config
    from services import openai_client
    from agents import assistant

    monkeypatch.setattr(storage, "CHAT_HISTORY_FILE", tmp_path / "chat.json")
    calls = []

    def classify(*a, **k):
        calls.append(1)
        return {"data": {"intent": "other"}}

    monkeypatch.setattr(config, "is_openai_configured", lambda: True)
    monkeypatch.setattr(openai_client, "json_completion", classify)
    monkeypatch.setattr(assistant, "is_openai_configured", lambda: True)
    monkeypatch.setattr(assistant, "chat_completion", lambda **kw: {
        "text": "초안", "model": "m", "tokens": 1, "latency_ms": 1})
    client = app_module.app.test_client()

    routed = client.post("/api/route", json={"message": "메일 초안 써줘"}).get_json()
    assert routed == {"agent": "assistant", "routed_by": "fallback"}
    body = client.post("/api/chat", json={"message": "메일 초안 써줘", "agent": "assistant"}).get_json()
    assert body["ai_response"]["agent"] == "assistant"
    assert body["ai_response"]["metadata"]["routed_by"] == "preassigned"
    assert len(calls) == 1  # classified by /api/route only


def test_route_commands_smalltalk_and_validation():
    client = app_module.app.test_client()
    assert client.post("/api/route", json={"message": "/기록 배포"}).get_json() == {
        "agent": "archivist", "routed_by": "command"}
    assert client.post("/api/route", json={"message": "안녕하세요"}).get_json() == {
        "agent": "dispatcher", "routed_by": "smalltalk"}
    assert client.post("/api/route", json={"message": " "}).status_code == 400
    assert client.post("/api/chat", json={"message": "x", "agent": "nobody"}).status_code == 400


def test_command_wins_over_preassigned_agent(fake_openai, tmp_path, monkeypatch):
    monkeypatch.setattr(storage, "CHAT_HISTORY_FILE", tmp_path / "chat.json")
    fake_openai.json_responses.append({"entries": [{"title": "배포", "category": "개발"}]})
    body = app_module.app.test_client().post(
        "/api/chat", json={"message": "/기록 배포 완료", "agent": "assistant"}).get_json()
    assert body["ai_response"]["agent"] == "archivist"
