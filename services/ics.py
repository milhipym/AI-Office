"""iCalendar (.ics) export so events can be imported into Google, Apple or
Outlook calendars.

Times are written as floating local time (no time zone), which every
calendar app shows as-is in the user's own zone — right for a single-user,
single-zone app.
"""

from datetime import date, datetime, timedelta, timezone

PRODID = "-//AI Office//Second Brain//KO"


def _escape(text: str) -> str:
    """Escape TEXT values per RFC 5545 (backslash first)."""
    text = (text or "").replace("\\", "\\\\")
    for ch in ";,":
        text = text.replace(ch, "\\" + ch)
    return text.replace("\n", "\\n")


def _fold(line: str) -> str:
    """Fold lines longer than 75 octets as RFC 5545 requires."""
    raw = line.encode("utf-8")
    if len(raw) <= 75:
        return line
    parts, current = [], b""
    for ch in line:
        enc = ch.encode("utf-8")
        if len(current) + len(enc) > (75 if not parts else 74):
            parts.append(current.decode("utf-8"))
            current = b""
        current += enc
    parts.append(current.decode("utf-8"))
    return "\r\n ".join(parts)


def _vevent(ev: dict, stamp: str) -> list:
    day = date.fromisoformat(ev["event_date"])
    lines = ["BEGIN:VEVENT", f"UID:ai-office-event-{ev['id']}@localhost", f"DTSTAMP:{stamp}"]
    if ev["start_time"]:
        start = datetime.combine(day, datetime.strptime(ev["start_time"], "%H:%M").time())
        end = (
            datetime.combine(day, datetime.strptime(ev["end_time"], "%H:%M").time())
            if ev["end_time"] else start + timedelta(hours=1)
        )
        lines += [f"DTSTART:{start:%Y%m%dT%H%M%S}", f"DTEND:{end:%Y%m%dT%H%M%S}"]
    else:
        lines += [f"DTSTART;VALUE=DATE:{day:%Y%m%d}", f"DTEND;VALUE=DATE:{day + timedelta(days=1):%Y%m%d}"]
    title = ("[마감] " if ev["kind"] == "deadline" else "") + ev["title"]
    lines.append(f"SUMMARY:{_escape(title)}")
    if ev.get("location"):
        lines.append(f"LOCATION:{_escape(ev['location'])}")
    if ev.get("notes"):
        lines.append(f"DESCRIPTION:{_escape(ev['notes'])}")
    lines.append("END:VEVENT")
    return lines


def to_ics(events: list) -> str:
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    lines = ["BEGIN:VCALENDAR", "VERSION:2.0", f"PRODID:{PRODID}", "CALSCALE:GREGORIAN",
             "X-WR-CALNAME:AI Office 일정"]
    for ev in events:
        lines += _vevent(ev, stamp)
    lines.append("END:VCALENDAR")
    return "\r\n".join(_fold(line) for line in lines) + "\r\n"
