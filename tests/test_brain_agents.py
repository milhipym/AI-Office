from agents.brain_agents import (
    ArchivistAgent,
    CoachAgent,
    FinderAgent,
    MinutesAgent,
    ReporterAgent,
)
from services import brain_store


def _log(date, title, content, category="개발", achievement=False, embedding=None):
    return brain_store.add_entry(
        kind="log", entry_date=date, category=category, title=title, content=content,
        summary=content, details={"achievement": achievement}, embedding=embedding,
    )


def test_archivist_splits_and_normalizes(fake_openai):
    fake_openai.json_responses.append({"entries": [
        {"date": "2026-10-13", "category": "운영/장애", "title": "결제 장애 대응",
         "summary": "결제 타임아웃 원인 수정", "tags": ["#결제", "결제", "PG"],
         "achievement": True, "impact": "응답시간 3초→0.8초"},
        # Unknown category, future date, missing fields.
        {"date": "2027-01-01", "category": "잡무", "title": "", "tags": "x"},
    ]})
    resp = ArchivistAgent().execute("어제 결제 장애 대응했고 오늘 서류 정리")
    entries = brain_store.list_entries()
    assert len(entries) == 2
    by_title = {e["title"]: e for e in entries}
    first = by_title["결제 장애 대응"]
    assert first["entry_date"] == "2026-10-13"
    assert first["tags"] == ["결제", "PG"]
    assert first["details"] == {"achievement": True, "impact": "응답시간 3초→0.8초"}
    second = [e for e in entries if e is not first and e["title"] != "결제 장애 대응"][0]
    assert second["category"] == "기타"
    assert second["entry_date"] == "2026-10-14"  # future date clamped to today
    assert second["tags"] == []
    assert resp.metadata["brain_refresh"] is True
    assert "2건 기록했습니다" in resp.text


def test_archivist_survives_embedding_failure(fake_openai):
    fake_openai.embed_fail = True
    fake_openai.json_responses.append({"entries": [{"title": "배포", "category": "개발"}]})
    ArchivistAgent().execute("배포 완료")
    rows = brain_store.list_entries(with_embedding=True)
    assert len(rows) == 1 and rows[0]["embedding"] is None


def test_minutes_stores_meeting(fake_openai):
    fake_openai.json_responses.append({
        "title": "앱 리뉴얼 킥오프", "date": "2026-10-14", "attendees": ["김OO", "이OO"],
        "summary": "출시 일정 확정", "decisions": ["12월 둘째 주 출시"],
        "action_items": [{"task": "디자인 시안", "owner": "이OO", "due": "2026-10-21"},
                         {"task": "QA 계획", "owner": "", "due": "다음주쯤"},
                         {"owner": "누락"}],
        "open_issues": [], "tags": ["리뉴얼"],
    })
    resp = MinutesAgent().execute("앱 리뉴얼 킥오프 메모 - 12월 둘째 주 출시 확정")
    [entry] = brain_store.list_entries(kind="meeting")
    assert entry["category"] == "회의"
    assert entry["details"]["action_items"] == [
        {"task": "디자인 시안", "owner": "이OO", "due": "2026-10-21"},
        {"task": "QA 계획", "owner": "", "due": ""},
    ]
    assert "결정사항" in resp.text and "디자인 시안" in resp.text


def test_finder_filters_by_period_and_ranks(fake_openai):
    _log("2026-09-10", "결제 장애", "결제 장애 대응", embedding=[1, 1, 0, 0, 0.1])
    _log("2026-09-20", "배포", "정기 배포", embedding=[0, 0, 0, 1, 0.1])
    _log("2026-10-02", "결제 장애 재발", "결제 장애 다시 발생", embedding=[1, 1, 0, 0, 0.1])
    resp = FinderAgent().execute("지난달 결제 장애")
    prompt = fake_openai.chat_calls[0]["user"]
    # Only September entries reach the model.
    assert "2026-09-10" in prompt and "2026-10-02" not in prompt
    assert resp.metadata["period"] == "지난달"


def test_finder_ranks_without_period(fake_openai):
    for i in range(12):
        _log("2026-08-01", f"잡무 {i}", "문서 정리", embedding=[0, 0, 0, 0, 0.1])
    target = _log("2026-07-01", "결제 장애", "결제 장애 대응", embedding=[1, 1, 0, 0, 0.1])
    resp = FinderAgent().execute("결제 장애 언제였지")
    assert resp.metadata["hit_ids"][0] == target["id"]


def test_finder_empty_store_skips_model(fake_openai):
    resp = FinderAgent().execute("결제 장애")
    assert "저장된 기록이 없습니다" in resp.text
    assert fake_openai.chat_calls == []


def test_reporter_uses_requested_week(fake_openai):
    _log("2026-10-06", "지난주 일", "지난주 작업")
    _log("2026-10-13", "이번주 일", "이번주 작업")
    resp = ReporterAgent().execute("지난주")
    assert "2026-10-05 ~ 2026-10-11" in resp.text
    prompt = fake_openai.chat_calls[0]["user"]
    assert "지난주 일" in prompt and "이번주 일" not in prompt


def test_reporter_empty_week(fake_openai):
    resp = ReporterAgent().execute("")
    assert "기록이 없어" in resp.text
    assert fake_openai.chat_calls == []


def test_coach_requires_minimum_entries(fake_openai):
    for i in range(3):
        _log("2026-05-01", f"일 {i}", "작업")
    resp = CoachAgent().execute("올해")
    assert "근거가 부족" in resp.text
    assert fake_openai.chat_calls == []


def test_coach_summarizes_period(fake_openai):
    for i in range(5):
        _log(f"2026-0{i + 1}-15", f"성과 {i}", "개선", achievement=True)
    _log("2025-12-01", "작년 일", "작년 작업")
    resp = CoachAgent().execute("올해")
    prompt = fake_openai.chat_calls[0]["user"]
    assert "성과 0" in prompt and "작년 일" not in prompt
    assert resp.metadata["entry_count"] == 5


def test_unconfigured_api(monkeypatch):
    from agents import brain_agents
    monkeypatch.setattr(brain_agents, "is_openai_configured", lambda: False)
    resp = ArchivistAgent().execute("기록")
    assert "OPENAI_API_KEY" in resp.text
