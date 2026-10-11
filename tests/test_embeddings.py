import sqlite3

import app as app_module
from agents.brain_agents import EMBEDDING_MODEL, FinderAgent, rank_entries, reembed_stale
from services import brain_store


def _add(title, embedding=None, model=EMBEDDING_MODEL):
    return brain_store.add_entry(
        kind="log", entry_date="2026-10-01", category="개발", title=title,
        content=title, summary=title, embedding=embedding, embedding_model=model,
    )


def test_model_recorded_only_with_a_vector():
    with_vec = _add("결제", embedding=[1.0, 0.0])
    without = _add("배포", embedding=None)
    rows = {e["id"]: e for e in brain_store.list_entries(with_embedding=True)}
    assert rows[with_vec["id"]]["embedding_model"] == EMBEDDING_MODEL
    assert rows[without["id"]]["embedding_model"] is None
    assert brain_store.count_stale(EMBEDDING_MODEL) == 1


def test_migrates_database_created_before_the_column(tmp_path, monkeypatch):
    path = tmp_path / "old.db"
    conn = sqlite3.connect(path)
    conn.execute("""CREATE TABLE entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT NOT NULL, entry_date TEXT NOT NULL,
        created_at TEXT NOT NULL, category TEXT NOT NULL, title TEXT NOT NULL,
        summary TEXT NOT NULL DEFAULT '', content TEXT NOT NULL, tags TEXT NOT NULL DEFAULT '[]',
        details TEXT NOT NULL DEFAULT '{}', embedding BLOB)""")
    conn.execute("INSERT INTO entries (kind, entry_date, created_at, category, title, content, embedding) "
                 "VALUES ('log', '2026-01-01', 'x', '개발', '옛 기록', '옛 기록', ?)", (b"\0" * 8,))
    conn.commit()
    conn.close()
    monkeypatch.setattr(brain_store, "DB_PATH", path)

    [entry] = brain_store.list_entries(with_embedding=True)
    assert entry["embedding_model"] is None
    # An old vector of unknown origin must be treated as stale.
    assert brain_store.count_stale(EMBEDDING_MODEL) == 1


def test_rank_ignores_vectors_from_another_model():
    same = {"title": "a", "summary": "", "content": "", "tags": [],
            "embedding": [1.0, 0.0], "embedding_model": EMBEDDING_MODEL}
    other = {"title": "b", "summary": "", "content": "", "tags": [],
             "embedding": [1.0, 0.0], "embedding_model": "some-other-model"}
    short = {"title": "c", "summary": "", "content": "", "tags": [],
             "embedding": [1.0], "embedding_model": EMBEDDING_MODEL}
    assert rank_entries("질문", [other, short, same], query_vec=[1.0, 0.0]) == [same]


def test_reembed_updates_all_stale_rows_in_batches(fake_openai):
    for i in range(5):
        _add(f"결제 {i}", embedding=[9.0], model="old-model")
    _add("배포 실패", embedding=None)
    _add("최신", embedding=[1, 0, 0, 0, 0.1])

    assert reembed_stale(batch_size=2) == 6
    assert brain_store.count_stale(EMBEDDING_MODEL) == 0
    rows = brain_store.list_entries(with_embedding=True)
    assert all(r["embedding_model"] == EMBEDDING_MODEL and len(r["embedding"]) == 5 for r in rows)


def test_finder_uses_reembedded_rows(fake_openai):
    for i in range(10):
        _add(f"문서 정리 {i}", embedding=[0, 0, 0, 0, 0.1])
    target = _add("결제 장애", embedding=[9.0], model="old-model")
    reembed_stale()
    resp = FinderAgent().execute("결제 장애")
    assert resp.metadata["hit_ids"][0] == target["id"]


def test_reembed_api(fake_openai, monkeypatch):
    monkeypatch.setattr(app_module, "is_openai_configured", lambda: True)
    _add("결제", embedding=None)
    client = app_module.app.test_client()
    assert client.get("/api/brain/meta").get_json()["stale_embeddings"] == 1
    body = client.post("/api/brain/reembed").get_json()
    assert body == {"updated": 1, "remaining": 0}
    assert client.get("/api/brain/meta").get_json()["stale_embeddings"] == 0


def test_reembed_api_reports_failure(fake_openai, monkeypatch):
    monkeypatch.setattr(app_module, "is_openai_configured", lambda: True)
    fake_openai.embed_fail = True
    _add("결제", embedding=None)
    res = app_module.app.test_client().post("/api/brain/reembed")
    assert res.status_code == 502
    assert res.get_json()["remaining"] == 1


def test_assistant_sends_no_temperature(monkeypatch):
    from agents import assistant
    calls = []
    monkeypatch.setattr(assistant, "is_openai_configured", lambda: True)
    monkeypatch.setattr(assistant, "chat_completion", lambda **kw: calls.append(kw) or
                        {"text": "ok", "model": "m", "tokens": 1, "latency_ms": 1})
    assistant.AssistantAgent().execute("질문")
    assert calls[0]["temperature"] is None
