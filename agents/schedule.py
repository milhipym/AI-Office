"""일정 비서 and the shared logic that files events into the calendar.

Events reach the calendar three ways, all through save_events():
- /일정 messages handled by SchedulerAgent,
- future plans mentioned in a /기록 entry (same model call as the record),
- dated action items in /회의 minutes (as deadlines).

Only concrete, not-yet-past dates are accepted: "다음주쯤" or a meeting that
already happened must not land on the calendar.
"""

import re
from datetime import date, timedelta

from config import MODEL_SCHEDULER, is_openai_configured
from services import brain_store
from services.openai_client import OpenAIError, json_completion

from .base import AgentResponse, BaseAgent
from .brain_common import parse_iso, resolve_period
from .brain_prompts import scheduler_prompt

WEEKDAYS = ["월", "화", "수", "목", "금", "토", "일"]
TIME_RE = re.compile(r"^([01]?\d|2[0-3]):([0-5]\d)$")
UPCOMING_DAYS = 14


def today() -> date:
    """Indirection so tests can pin the date."""
    return date.today()


def _time(value) -> str:
    m = TIME_RE.match(str(value or "").strip())
    return f"{int(m.group(1)):02d}:{m.group(2)}" if m else ""


def normalize_events(raw_events, now: date) -> list:
    """Model output -> clean event dicts. Drops past, undated or untitled items."""
    if not isinstance(raw_events, list):
        return []
    events = []
    for raw in raw_events[:10]:
        if not isinstance(raw, dict):
            continue
        title = str(raw.get("title") or "").strip()[:60]
        when = parse_iso(raw.get("date"), date.min)
        if not title or when == date.min or when < now:
            continue
        start = _time(raw.get("time") or raw.get("start_time"))
        end = _time(raw.get("end_time")) if start else ""
        if end and end <= start:
            end = ""
        events.append({
            "title": title,
            "event_date": when.isoformat(),
            "start_time": start,
            "end_time": end,
            "location": str(raw.get("location") or "").strip()[:60],
        })
    return events


def save_events(events: list, kind: str = "event", source_entry_id=None) -> list:
    """Store events, skipping ones already on the calendar. Returns the new rows."""
    saved = []
    for ev in events:
        if brain_store.find_event(ev["event_date"], ev["title"]):
            continue
        saved.append(brain_store.add_event(kind=kind, source_entry_id=source_entry_id, **ev))
    return saved


def deadlines_from_action_items(action_items: list, now: date) -> list:
    """Dated, not-yet-past meeting action items as all-day deadline events."""
    events = []
    for item in action_items:
        due = parse_iso(item.get("due"), date.min)
        if due == date.min or due < now:
            continue
        owner = f" ({item['owner']})" if item.get("owner") else ""
        events.append({
            "title": f"{item['task']}{owner}"[:60],
            "event_date": due.isoformat(),
            "start_time": "",
            "end_time": "",
            "location": "",
        })
    return events


def describe(ev: dict) -> str:
    d = date.fromisoformat(ev["event_date"])
    when = f"{d.month}/{d.day}({WEEKDAYS[d.weekday()]})"
    if ev["start_time"]:
        when += f" {ev['start_time']}" + (f"~{ev['end_time']}" if ev["end_time"] else "")
    tag = "[마감] " if ev["kind"] == "deadline" else ""
    place = f" · {ev['location']}" if ev["location"] else ""
    return f"{tag}{when} **{ev['title']}**{place}"


def calendar_note(saved: list) -> str:
    """Line appended to a record/minutes reply when events were filed."""
    if not saved:
        return ""
    lines = ["", f"**일정표에 {len(saved)}건 추가했습니다** (잘못 들어갔으면 일정표 탭에서 삭제)"]
    lines += [f"- {describe(ev)}" for ev in saved]
    return "\n".join(lines)


class SchedulerAgent(BaseAgent):
    id = "scheduler"
    name = "일정 비서"
    role = "일정 등록 · 조회"
    model = MODEL_SCHEDULER

    def execute(self, message: str, history=None) -> AgentResponse:
        if not is_openai_configured():
            return self.unavailable_response("OPENAI_API_KEY 미설정")
        now = today()
        if not message.strip():
            return self._list(now, now + timedelta(days=UPCOMING_DAYS - 1), f"앞으로 {UPCOMING_DAYS}일")

        try:
            result = json_completion(
                scheduler_prompt(now.isoformat(), WEEKDAYS[now.weekday()]),
                message,
                model=self.model,
            )
        except OpenAIError as e:
            return self.unavailable_response(str(e))

        data = result["data"]
        meta = {"agent": self.id, "model": result.get("model", self.model),
                "tokens": result.get("tokens", 0), "latency_ms": result.get("latency_ms", 0)}

        if data.get("mode") == "query":
            period = resolve_period(message, now, future=True)
            if period:
                start, end, label = period
                return self._list(date.fromisoformat(start), date.fromisoformat(end), label, meta)
            return self._list(now, now + timedelta(days=UPCOMING_DAYS - 1), f"앞으로 {UPCOMING_DAYS}일", meta)

        events = normalize_events(data.get("events"), now)
        if not events:
            return AgentResponse(
                text=("등록할 일정을 찾지 못했습니다. 오늘 이후의 **구체적인 날짜**가 필요합니다.\n\n"
                      "예: `/일정 다음주 화요일 15시 보안 점검 회의 본사 3층`"),
                metadata=meta,
            )
        saved = save_events(events)
        skipped = len(events) - len(saved)
        lines = [f"**일정 {len(saved)}건을 등록했습니다.**"] + [f"- {describe(ev)}" for ev in saved]
        if skipped:
            lines.append(f"\n_이미 같은 날 같은 제목의 일정이 있어 {skipped}건은 건너뛰었습니다._")
        return AgentResponse(text="\n".join(lines), metadata={**meta, "calendar_refresh": True})

    def _list(self, start: date, end: date, label: str, meta=None) -> AgentResponse:
        events = brain_store.list_events(start.isoformat(), end.isoformat())
        meta = meta or {"agent": self.id}
        if not events:
            text = f"{label}({start} ~ {end}) 일정이 없습니다."
            # e.g. "이번주" asked on a Sunday: point at what's coming instead.
            now = today()
            upcoming = brain_store.list_events(now.isoformat(), (now + timedelta(days=UPCOMING_DAYS - 1)).isoformat())
            if upcoming:
                text += f"\n\n**다가오는 일정 ({UPCOMING_DAYS}일)**\n" + "\n".join(f"- {describe(ev)}" for ev in upcoming)
            return AgentResponse(text=text, metadata=meta)
        lines = [f"**{label} 일정** ({start} ~ {end}, {len(events)}건)"]
        lines += [f"- {describe(ev)}" for ev in events]
        return AgentResponse(text="\n".join(lines), metadata=meta)
