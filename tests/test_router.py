import pytest

import config
from agents import router
from services import openai_client


@pytest.mark.parametrize("message", ["안녕", "안녕하세요!!", "뭐해?", "좋은 아침입니다", "고마워요", "ok"])
def test_smalltalk_detected(message):
    assert router.is_smalltalk(message)


@pytest.mark.parametrize("message", [
    "안녕하세요 로그인 버그 고쳐줘",
    "뭐해야 할지 계획 짜줘",
    "헤이 이거 분석해줘",
    "좋은 하루 계획 세워줘",
    "/기록 안녕",
])
def test_requests_are_not_smalltalk(message):
    assert not router.is_smalltalk(message)


@pytest.mark.parametrize("message,agent_id,text", [
    ("/기록 오늘 배포함", "archivist", "오늘 배포함"),
    ("/회의 킥오프\n- 일정 확정", "minutes", "킥오프\n- 일정 확정"),
    ("/찾기 지난달 장애", "finder", "지난달 장애"),
    ("/주간", "reporter", ""),
    ("/성과 올해", "coach", "올해"),
    ("/비서 메일 초안", "assistant", "메일 초안"),
    ("/LOG english alias", "archivist", "english alias"),
])
def test_slash_commands(message, agent_id, text):
    agent, cleaned, routed_by = router.dispatch(message, classify=False)
    assert agent.id == agent_id
    assert cleaned == text
    assert routed_by == "command"


def test_unknown_command_goes_to_assistant():
    agent, cleaned, routed_by = router.dispatch("/없는명령 내용", classify=False)
    assert agent.id == "assistant"
    assert cleaned == "/없는명령 내용"
    assert routed_by == "fallback"


def _fake_classifier(monkeypatch, intent):
    monkeypatch.setattr(config, "is_openai_configured", lambda: True)
    monkeypatch.setattr(
        openai_client, "json_completion",
        lambda *a, **k: {"data": {"intent": intent}},
    )


@pytest.mark.parametrize("intent,agent_id", [
    ("log", "archivist"), ("meeting", "minutes"), ("search", "finder"),
    ("weekly", "reporter"), ("career", "coach"),
])
def test_classifier_routes_plain_text(monkeypatch, intent, agent_id):
    _fake_classifier(monkeypatch, intent)
    agent, cleaned, routed_by = router.dispatch("오늘 장애 대응 회의했음")
    assert agent.id == agent_id
    assert cleaned == "오늘 장애 대응 회의했음"
    assert routed_by == "classifier"


@pytest.mark.parametrize("intent", ["other", "nonsense", ""])
def test_classifier_other_goes_to_assistant(monkeypatch, intent):
    _fake_classifier(monkeypatch, intent)
    agent, _, routed_by = router.dispatch("메일 초안 써줘")
    assert agent.id == "assistant"
    assert routed_by == "fallback"


def test_classifier_failure_goes_to_assistant(monkeypatch):
    monkeypatch.setattr(config, "is_openai_configured", lambda: True)

    def boom(*a, **k):
        raise openai_client.OpenAIError("down")

    monkeypatch.setattr(openai_client, "json_completion", boom)
    agent, _, routed_by = router.dispatch("아키텍처 리뷰해줘")
    assert agent.id == "assistant"
    assert routed_by == "fallback"
