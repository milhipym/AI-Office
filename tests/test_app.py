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
    assert ids == {"dispatcher", "assistant", "archivist", "minutes", "finder", "reporter", "coach"}
    office = client.get("/api/office").get_json()
    assert office["grid"] == {"cols": 9, "rows": 6}
    assert any(r.get("planned") for r in office["rooms"])


def test_smalltalk_answered_by_dispatcher(tmp_path, monkeypatch):
    monkeypatch.setattr(storage, "CHAT_HISTORY_FILE", tmp_path / "chat.json")
    client = app_module.app.test_client()
    body = client.post("/api/chat", json={"message": "안녕하세요"}).get_json()
    assert body["ai_response"]["agent"] == "dispatcher"
