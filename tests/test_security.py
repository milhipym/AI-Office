import sqlite3
from datetime import date

import pytest

import app as app_module
from services import backup, openai_client, privacy


@pytest.fixture
def client():
    return app_module.app.test_client()


def test_loopback_hosts_allowed(client):
    for host in ("127.0.0.1:5000", "localhost:5050", "[::1]:5000"):
        assert client.get("/api/status", headers={"Host": host}).status_code == 200


def test_rebound_domain_rejected(client):
    res = client.get("/api/entries", headers={"Host": "evil.example:5000"})
    assert res.status_code == 403


@pytest.mark.parametrize("origin", ["https://evil.example", "null"])
def test_foreign_origin_rejected(client, origin):
    res = client.post("/api/chat/clear", headers={"Host": "127.0.0.1:5000", "Origin": origin})
    assert res.status_code == 403


def test_own_origin_allowed(client):
    res = client.post("/api/chat/clear", headers={"Host": "127.0.0.1:5000", "Origin": "http://127.0.0.1:5000"})
    assert res.status_code == 200
    assert res.headers["X-Frame-Options"] == "DENY"


@pytest.mark.parametrize("text, label", [
    ("고객 900101-1234567 확인", "[주민번호]"),
    ("연락처 010-1234-5678", "[전화번호]"),
    ("01012345678로 회신", "[전화번호]"),
    ("본사 02-1234-5678", "[전화번호]"),
    ("메일 kim.dev@example.co.kr 로", "[이메일]"),
    ("카드 1234-5678-9012-3456 결제", "[카드번호]"),
    ("12가3456 차량 사고 접수", "[차량번호]"),
])
def test_mask_personal_data(text, label):
    masked, n = privacy.mask(text)
    assert label in masked and n == 1


@pytest.mark.parametrize("text", [
    "응답 3.1초→0.8초, 2026-10-14 배포",
    "10월 14일 15:00 회의, 3주 1500건 처리",
    "버전 1.2.3, 이슈 #1234, 포트 5000",
])
def test_mask_leaves_work_notes_alone(text):
    assert privacy.mask(text) == (text, 0)


def test_mask_can_be_disabled(monkeypatch):
    monkeypatch.setattr(privacy.config, "MASK_PERSONAL_DATA", False)
    assert privacy.mask("010-1234-5678") == ("010-1234-5678", 0)


def test_chat_completion_masks_everything_sent(monkeypatch):
    sent = {}

    class Completions:
        def create(self, **kwargs):
            sent.update(kwargs)
            msg = type("M", (), {"content": "ok"})
            return type("R", (), {"choices": [type("C", (), {"message": msg})], "model": "m", "usage": None})

    fake = type("Client", (), {"chat": type("Chat", (), {"completions": Completions()})()})()
    monkeypatch.setattr(openai_client, "_get_client", lambda: fake)
    result = openai_client.chat_completion(
        "기록: 담당자 010-1111-2222",
        "a@b.com 에게 회신",
        history=[{"agent": "user", "message": "900101-1234567"}],
    )
    contents = " ".join(m["content"] for m in sent["messages"])
    assert "010-1111-2222" not in contents and "a@b.com" not in contents and "900101" not in contents
    assert result["masked"] == 3


def test_backup_daily_and_pruned(tmp_path):
    db = tmp_path / "brain.db"
    sqlite3.connect(db).execute("CREATE TABLE t (x)").connection.commit()
    out = tmp_path / "backups"
    for day in range(1, 5):
        assert backup.backup_db(db, out, keep=2, today=date(2026, 10, day))
    assert backup.backup_db(db, out, keep=2, today=date(2026, 10, 4)) is None  # once a day
    assert sorted(p.name for p in out.iterdir()) == ["brain-2026-10-03.db", "brain-2026-10-04.db"]


def test_backup_skips_missing_db(tmp_path):
    assert backup.backup_db(tmp_path / "none.db", tmp_path / "b", keep=3) is None
