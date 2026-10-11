from agents.brain_common import parse_iso, resolve_period
from conftest import TODAY


def test_relative_days_and_weeks():
    assert resolve_period("오늘 한 일", TODAY)[:2] == ("2026-10-14", "2026-10-14")
    assert resolve_period("어제 장애", TODAY)[:2] == ("2026-10-13", "2026-10-13")
    assert resolve_period("지난주 회의", TODAY)[:2] == ("2026-10-05", "2026-10-11")
    # End of the current week is capped at today.
    assert resolve_period("이번주", TODAY)[:2] == ("2026-10-12", "2026-10-14")


def test_months_and_recent():
    assert resolve_period("지난달 결제 장애", TODAY)[:2] == ("2026-09-01", "2026-09-30")
    assert resolve_period("최근 3개월", TODAY)[:2] == ("2026-07-17", "2026-10-14")
    assert resolve_period("지난 2주", TODAY)[:2] == ("2026-10-01", "2026-10-14")


def test_years_halves_quarters():
    assert resolve_period("올해", TODAY)[:2] == ("2026-01-01", "2026-10-14")
    assert resolve_period("작년 하반기", TODAY)[:2] == ("2025-07-01", "2025-12-31")
    assert resolve_period("2025년 2분기", TODAY)[:2] == ("2025-04-01", "2025-06-30")
    assert resolve_period("상반기", TODAY)[:2] == ("2026-01-01", "2026-06-30")


def test_explicit_range_and_none():
    assert resolve_period("2026-03-01 ~ 2026-02-01", TODAY)[:2] == ("2026-02-01", "2026-03-01")
    assert resolve_period("B업체 협의 내용", TODAY) is None


def test_parse_iso_fallback():
    assert parse_iso("2026.9.3", TODAY).isoformat() == "2026-09-03"
    assert parse_iso("2026-02-30", TODAY) == TODAY
    assert parse_iso(None, TODAY) == TODAY
