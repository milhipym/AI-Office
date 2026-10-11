"""Helpers shared by the second-brain agents: period parsing and formatting.

Periods are parsed with rules rather than a model call so that "지난주",
"올해 상반기" etc. resolve the same way every time and cost nothing.
"""

import re
from datetime import date, timedelta
from typing import Optional

from config import BRAIN_CATEGORIES

ISO_DATE_RE = re.compile(r"(\d{4})[-./](\d{1,2})[-./](\d{1,2})")


def parse_iso(value, fallback: date) -> date:
    """Parse YYYY-MM-DD (or YYYY.MM.DD / YYYY/MM/DD); return fallback when invalid."""
    if not isinstance(value, str):
        return fallback
    m = ISO_DATE_RE.search(value)
    if not m:
        return fallback
    try:
        return date(int(m.group(1)), int(m.group(2)), int(m.group(3)))
    except ValueError:
        return fallback


def week_bounds(day: date) -> tuple:
    monday = day - timedelta(days=day.weekday())
    return monday, monday + timedelta(days=6)


def _month_bounds(year: int, month: int) -> tuple:
    start = date(year, month, 1)
    nxt = date(year + (month == 12), month % 12 + 1, 1)
    return start, nxt - timedelta(days=1)


def resolve_period(text: str, today: date, future: bool = False) -> Optional[tuple]:
    """Find a period expression in text.

    Returns (date_from, date_to, label) with ISO strings, or None when the
    text names no period. Records only exist up to today, so the end date is
    capped at today unless future=True (calendar queries), which also enables
    "내일", "다음주" and "다음달".
    """
    t = text or ""
    cap = None if future else today

    explicit = ISO_DATE_RE.findall(t)
    if len(explicit) >= 2:
        start = parse_iso("-".join(explicit[0]), today)
        end = parse_iso("-".join(explicit[1]), today)
        if start > end:
            start, end = end, start
        return _result(start, end, cap, f"{start} ~ {end}")

    def has(*words):
        return any(w in t for w in words)

    if future:
        if has("모레"):
            d = today + timedelta(days=2)
            return _result(d, d, cap, "모레")
        if has("내일"):
            d = today + timedelta(days=1)
            return _result(d, d, cap, "내일")
        if has("다음주", "다음 주", "차주"):
            start, end = week_bounds(today + timedelta(days=7))
            return _result(start, end, cap, "다음 주")
        if has("다음달", "다음 달"):
            first_next = (today.replace(day=1) + timedelta(days=32)).replace(day=1)
            start, end = _month_bounds(first_next.year, first_next.month)
            return _result(start, end, cap, "다음 달")

    if has("오늘"):
        return _result(today, today, cap, "오늘")
    if has("어제"):
        d = today - timedelta(days=1)
        return _result(d, d, cap, "어제")
    if has("지난주", "저번주", "지난 주", "저번 주"):
        start, end = week_bounds(today - timedelta(days=7))
        return _result(start, end, cap, "지난주")
    if has("이번주", "이번 주", "금주"):
        start, end = week_bounds(today)
        return _result(start, end, cap, "이번 주")
    if has("지난달", "저번달", "지난 달", "저번 달"):
        last = today.replace(day=1) - timedelta(days=1)
        start, end = _month_bounds(last.year, last.month)
        return _result(start, end, cap, "지난달")
    if has("이번달", "이번 달"):
        start, end = _month_bounds(today.year, today.month)
        return _result(start, end, cap, "이번 달")

    m = re.search(r"(?:최근|지난)\s*(\d+)\s*(개월|달|주|일)", t)
    if m:
        n, unit = int(m.group(1)), m.group(2)
        days = {"개월": 30, "달": 30, "주": 7, "일": 1}[unit] * n
        return _result(today - timedelta(days=days - 1), today, cap, f"최근 {n}{unit}")

    year = today.year
    if has("작년", "지난해"):
        year = today.year - 1
    else:
        y = re.search(r"(20\d{2})\s*년", t)
        if y:
            year = int(y.group(1))
    year_named = has("작년", "지난해", "올해", "금년") or re.search(r"20\d{2}\s*년", t)

    if has("상반기"):
        return _result(date(year, 1, 1), date(year, 6, 30), cap, f"{year}년 상반기")
    if has("하반기"):
        return _result(date(year, 7, 1), date(year, 12, 31), cap, f"{year}년 하반기")
    q = re.search(r"([1-4])\s*분기", t)
    if q:
        n = int(q.group(1))
        start = date(year, 3 * n - 2, 1)
        _, end = _month_bounds(year, 3 * n)
        return _result(start, end, cap, f"{year}년 {n}분기")
    if year_named:
        return _result(date(year, 1, 1), date(year, 12, 31), cap, f"{year}년")

    if len(explicit) == 1:
        d = parse_iso("-".join(explicit[0]), today)
        return _result(d, d, cap, str(d))
    return None


def _result(start: date, end: date, cap: Optional[date], label: str) -> tuple:
    if cap:
        end = min(end, cap)
    return start.isoformat(), end.isoformat(), label


def normalize_category(value) -> str:
    return value if value in BRAIN_CATEGORIES else "기타"


def normalize_tags(value) -> list:
    if not isinstance(value, list):
        return []
    tags = []
    for tag in value:
        if isinstance(tag, str):
            tag = tag.strip().lstrip("#")
            if tag and tag not in tags:
                tags.append(tag)
    return tags[:8]


def embedding_text(title: str, summary: str, content: str, tags: list) -> str:
    return "\n".join(filter(None, [title, summary, " ".join(tags), content]))


def format_entry_for_prompt(entry: dict, full: bool = True) -> str:
    """One entry as compact text the model can cite by [#id]."""
    head = f"[#{entry['id']}] {entry['entry_date']} ({entry['category']}) {entry['title']}"
    lines = [head]
    if entry.get("summary"):
        lines.append(f"  요약: {entry['summary']}")
    details = entry.get("details") or {}
    if details.get("impact"):
        lines.append(f"  성과: {details['impact']}")
    if entry["kind"] == "meeting":
        if details.get("decisions"):
            lines.append("  결정: " + "; ".join(details["decisions"]))
        items = details.get("action_items") or []
        if items:
            lines.append("  액션: " + "; ".join(
                f"{i.get('task', '')}({i.get('owner') or '미정'}, {i.get('due') or '기한 없음'})"
                for i in items
            ))
    if full:
        lines.append(f"  원문: {entry['content'][:600]}")
    return "\n".join(lines)
