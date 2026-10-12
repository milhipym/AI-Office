from agents import AGENTS, roster
from agents.brain_prompts import classifier_prompt


def test_every_staff_with_commands_has_an_agent():
    for staff in roster.STAFF:
        if staff["commands"] or staff["intent"]:
            assert staff["id"] in AGENTS, staff["id"]


def test_commands_are_unique():
    seen = [c.lower() for s in roster.STAFF for c in s["commands"]]
    assert len(seen) == len(set(seen))


def test_staff_sit_inside_active_rooms():
    grid = roster.GRID
    taken = set()
    for staff in roster.STAFF:
        x, y = staff["position"]["x"], staff["position"]["y"]
        assert 0 <= x < grid["cols"] and 0 <= y < grid["rows"]
        assert (x, y) not in taken, staff["id"]
        taken.add((x, y))
        room = next(r for r in roster.ROOMS
                    if r["x"] <= x < r["x"] + r["w"] and r["y"] <= y < r["y"] + r["h"])
        assert not room.get("planned"), staff["id"]


def test_staff_teams_exist_and_planned_team_is_empty():
    team_ids = {t["id"] for t in roster.TEAMS}
    assert all(s["team"] in team_ids for s in roster.STAFF)
    planned = [t["id"] for t in roster.TEAMS if t.get("planned")]
    assert planned == ["content"]
    assert not [s for s in roster.STAFF if s["team"] in planned]


def test_classifier_prompt_lists_every_intent():
    prompt = classifier_prompt()
    for key in roster.intents():
        assert f'"{key}"' in prompt
    assert '"other"' in prompt


def test_org_chart_marks_planned_team():
    teams = {t["id"]: t for t in roster.org_chart()["teams"]}
    assert teams["content"]["planned"] is True
    assert teams["content"]["agents"] == ["채용 예정"]
