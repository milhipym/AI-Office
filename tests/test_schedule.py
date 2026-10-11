from datetime import date

import app as app_module
from agents.brain_agents import ArchivistAgent, MinutesAgent, ReporterAgent
from agents.brain_common import resolve_period
from agents.router import dispatch
from agents.schedule import SchedulerAgent, deadlines_from_action_items, normalize_events, save_events
from conftest import TODAY  # 2026-10-14, Wednesday
from services import brain_store


def test_normalize_keeps_only_concrete_future_events():
    events = normalize_events([
        {"title": "보안 점검 회의", "date": "2026-10-20", "time": "15:00", "end_time": "16:30", "location": "본사 3층"},
        {"title": "오늘 저녁 회식", "date": "2026-10-14", "time": "9:5"},   # today ok, bad time -> all day
        {"title": "지난 회의", "date": "2026-10-10"},                       # past
        {"title": "조만간 미팅", "date": ""},                                # vague
        {"title": "", "date": "2026-10-21"},                                 # untitled
        {"title": "역순 시간", "date": "2026-10-22", "time": "14:00", "end_time": "13:00"},
        "garbage",
    ], TODAY)
    assert [e["title"] for e in events] == ["보안 점검 회의", "오늘 저녁 회식", "역순 시간"]
    assert events[0] == {"title": "보안 점검 회의", "event_date": "2026-10-20", "start_time": "15:00",
                         "end_time": "16:30", "location": "본사 3층"}
    assert events[1]["start_time"] == ""
    assert events[2]["end_time"] == ""


def test_save_skips_duplicates_ignoring_spaces():
    ev = {"title": "보안 점검", "event_date": "2026-10-20", "start_time": "", "end_time": "", "location": ""}
    assert len(save_events([ev])) == 1
    assert save_events([{**ev, "title": "보안  점검 "}]) == []
    assert len(brain_store.list_events()) == 1


def test_deadlines_from_action_items():
    items = [
        {"task": "디자인 시안", "owner": "이OO", "due": "2026-10-21"},
        {"task": "지난 일", "owner": "", "due": "2026-10-01"},
        {"task": "기한 없음", "owner": "", "due": ""},
    ]
    assert deadlines_from_action_items(items, TODAY) == [
        {"title": "디자인 시안 (이OO)", "event_date": "2026-10-21", "start_time": "", "end_time": "", "location": ""}
    ]


def test_archivist_files_future_events_from_a_record(fake_openai):
    fake_openai.json_responses.append({
        "entries": [{"title": "장애 회고", "category": "운영/장애", "date": "2026-10-14"}],
        "events": [
            {"title": "후속 점검 미팅", "date": "2026-10-16", "time": "10:00"},
            {"title": "어제 회의", "date": "2026-10-13"},
        ],
    })
    resp = ArchivistAgent().execute("오늘 장애 회고함. 금요일 10시 후속 점검 미팅 잡힘")
    [event] = brain_store.list_events()
    assert event["title"] == "후속 점검 미팅" and event["start_time"] == "10:00"
    assert event["source_entry_id"] == brain_store.list_entries()[0]["id"]
    assert "일정표에 1건 추가" in resp.text
    assert resp.metadata["calendar_refresh"] is True


def test_archivist_without_events_does_not_refresh_calendar(fake_openai):
    fake_openai.json_responses.append({"entries": [{"title": "배포", "category": "개발"}]})
    resp = ArchivistAgent().execute("배포 완료")
    assert brain_store.list_events() == []
    assert resp.metadata["calendar_refresh"] is False
    assert "일정표" not in resp.text


def test_minutes_files_next_meeting_and_deadlines(fake_openai):
    fake_openai.json_responses.append({
        "title": "리뉴얼 킥오프", "date": "2026-10-14", "summary": "s", "decisions": [],
        "action_items": [{"task": "디자인 시안", "owner": "이OO", "due": "2026-10-21"}],
        "events": [{"title": "2차 리뷰", "date": "2026-10-28", "time": "14:00"}],
    })
    resp = MinutesAgent().execute("리뉴얼 킥오프 메모입니다 - 시안 다음주 수요일, 2차 리뷰 28일 2시")
    kinds = {e["title"]: e["kind"] for e in brain_store.list_events()}
    assert kinds == {"2차 리뷰": "event", "디자인 시안 (이OO)": "deadline"}
    assert "일정표에 2건 추가" in resp.text


def test_scheduler_add(fake_openai):
    fake_openai.json_responses.append({"mode": "add", "events": [
        {"title": "보안 점검 회의", "date": "2026-10-20", "time": "15:00", "location": "본사 3층"},
    ]})
    resp = SchedulerAgent().execute("다음주 화요일 3시 보안 점검 회의 본사 3층")
    assert "1건을 등록" in resp.text and "10/20(화) 15:00" in resp.text
    assert resp.metadata["calendar_refresh"] is True


def test_scheduler_add_without_concrete_date(fake_openai):
    fake_openai.json_responses.append({"mode": "add", "events": [{"title": "미팅", "date": ""}]})
    resp = SchedulerAgent().execute("조만간 미팅")
    assert "찾지 못했습니다" in resp.text
    assert brain_store.list_events() == []


def test_scheduler_query_next_week(fake_openai):
    for d, t in [("2026-10-15", "이번주 일"), ("2026-10-20", "다음주 일"), ("2026-11-02", "먼 일")]:
        brain_store.add_event(title=t, event_date=d)
    fake_openai.json_responses.append({"mode": "query"})
    resp = SchedulerAgent().execute("다음주 일정 뭐 있어?")
    assert "다음주 일" in resp.text
    assert "이번주 일" not in resp.text and "먼 일" not in resp.text


def test_scheduler_query_this_week_includes_rest_of_week(fake_openai):
    brain_store.add_event(title="금요일 일", event_date="2026-10-16")
    fake_openai.json_responses.append({"mode": "query"})
    assert "금요일 일" in SchedulerAgent().execute("이번주 일정").text


def test_scheduler_empty_message_lists_upcoming(fake_openai):
    brain_store.add_event(title="곧", event_date="2026-10-20")
    brain_store.add_event(title="한참 뒤", event_date="2026-12-01")
    text = SchedulerAgent().execute("").text
    assert "곧" in text and "한참 뒤" not in text


def test_future_periods():
    assert resolve_period("내일", TODAY, future=True)[:2] == ("2026-10-15", "2026-10-15")
    assert resolve_period("다음주", TODAY, future=True)[:2] == ("2026-10-19", "2026-10-25")
    assert resolve_period("다음달", TODAY, future=True)[:2] == ("2026-11-01", "2026-11-30")
    assert resolve_period("이번주", TODAY, future=True)[:2] == ("2026-10-12", "2026-10-18")
    # Records stay capped at today and don't know future words.
    assert resolve_period("이번주", TODAY)[:2] == ("2026-10-12", "2026-10-14")
    assert resolve_period("다음주", TODAY) is None


def test_schedule_command_routes_to_scheduler():
    agent, text, _ = dispatch("/일정 내일 3시 회의", classify=False)
    assert agent.id == "scheduler" and text == "내일 3시 회의"


def test_reporter_sees_next_weeks_calendar(fake_openai):
    brain_store.add_entry(kind="log", entry_date="2026-10-13", category="개발", title="배포", content="배포")
    brain_store.add_event(title="보안 점검", event_date="2026-10-16", start_time="15:00")
    brain_store.add_event(title="먼 미래", event_date="2026-11-30")
    ReporterAgent().execute("")
    prompt = fake_openai.chat_calls[0]["user"]
    assert "보안 점검" in prompt and "먼 미래" not in prompt


def test_calendar_api_and_ics():
    client = app_module.app.test_client()
    timed = brain_store.add_event(title="보안 점검", event_date=date.today().isoformat(),
                                  start_time="15:00", location="본사, 3층")
    brain_store.add_event(title="시안", event_date="2099-01-05", kind="deadline")
    brain_store.add_event(title="지난 일", event_date="2000-01-01")

    assert len(client.get("/api/events").get_json()) == 3
    assert [e["title"] for e in client.get("/api/events?from=2099-01-01").get_json()] == ["시안"]

    res = client.get("/api/events.ics")
    body = res.get_data(as_text=True)
    assert res.mimetype == "text/calendar"
    assert "attachment" in res.headers["Content-Disposition"]
    assert body.count("BEGIN:VEVENT") == 2          # past event excluded by default
    assert "LOCATION:본사\\, 3층" in body
    assert "SUMMARY:[마감] 시안" in body
    assert "DTSTART;VALUE=DATE:20990105" in body
    assert "\r\n" in body

    one = client.get(f"/api/events/{timed['id']}.ics").get_data(as_text=True)
    assert one.count("BEGIN:VEVENT") == 1 and "T150000" in one
    assert client.get("/api/events/9999.ics").status_code == 404

    assert client.delete(f"/api/events/{timed['id']}").status_code == 200
    assert client.delete(f"/api/events/{timed['id']}").status_code == 404


def test_empty_period_points_at_upcoming(fake_openai):
    brain_store.add_event(title="다음주 회의", event_date="2026-10-20")
    fake_openai.json_responses.append({"mode": "query"})
    text = SchedulerAgent().execute("어제 일정").text
    assert "일정이 없습니다" in text and "다음주 회의" in text
