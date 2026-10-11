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
    ("/LOG english alias", "archivist", "english alias"),
])
def test_slash_commands(message, agent_id, text):
    agent, cleaned = router.dispatch(message, classify=False)
    assert agent.id == agent_id
    assert cleaned == text


def test_mention_still_routes():
    agent, cleaned = router.dispatch("@sonnet 로그인 API", classify=False)
    assert agent.id == "sonnet"
    assert cleaned == "로그인 API"


@pytest.mark.parametrize("message,agent_id", [
    ("2026 로드맵 짜줘", "manus"),
    ("decode 방식 설명해줘", "manus"),
    ("보고서 작성해줘", "chatgpt"),
    ("bug fix 해줘", "sonnet"),
])
def test_keyword_fallback(message, agent_id):
    assert router.route(message).id == agent_id


def _fake_classifier(monkeypatch, intent):
    monkeypatch.setattr(config, "is_openai_configured", lambda: True)
    monkeypatch.setattr(
        openai_client, "json_completion",
        lambda *a, **k: {"data": {"intent": intent}},
    )


def test_classifier_routes_plain_text(monkeypatch):
    _fake_classifier(monkeypatch, "log")
    agent, cleaned = router.dispatch("오늘 장애 대응 회의했음")
    assert agent.id == "archivist"
    assert cleaned == "오늘 장애 대응 회의했음"


def test_classifier_other_falls_back_to_keywords(monkeypatch):
    _fake_classifier(monkeypatch, "other")
    agent, _ = router.dispatch("로고 이미지 그려줘")
    assert agent.id == "gemini"


def test_classifier_failure_falls_back(monkeypatch):
    monkeypatch.setattr(config, "is_openai_configured", lambda: True)

    def boom(*a, **k):
        raise openai_client.OpenAIError("down")

    monkeypatch.setattr(openai_client, "json_completion", boom)
    agent, _ = router.dispatch("아키텍처 리뷰해줘")
    assert agent.id == "claude"
