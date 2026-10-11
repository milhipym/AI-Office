"""Task router — decides which agent should handle a given message."""

import re
from typing import Optional

from . import AGENTS
from .base import BaseAgent


# Simple greetings / small talk — we bypass the LLM for these.
# Each pattern must match the WHOLE message (after trailing punctuation is
# stripped): "안녕하세요 로그인 버그 고쳐줘" is a request, not a greeting.
SMALLTALK_PATTERNS = [
    r"(안녕|안뇽|안뇨|하이|헬로|헤이|반가워|반갑|ㅎㅇ|방가|헐로)\S*",
    r"(hi|hello|hey|yo|sup|howdy|greetings)",
    r"잘\s*지내\S*",
    r"뭐\s*해\S*",
    r"좋은\s*(아침|저녁|오후|밤|하루)\S*(\s*\S*(세요|니다|요))?",
    r"(고마워|감사)\S*|thanks|thank\s*you|thx|ty",
    r"(수고|고생)\s*(했|하셨)\S*",
    r"(ㅋㅋ+|ㅎㅎ+|ㅠㅠ+|lol|haha)",
    r"(네|예|응|어|ok|okay|yes|no|아니|좋아)",
    r"(뭐|what)",
    r"test|테스트",
]


def is_smalltalk(message: str) -> bool:
    """Return True for greetings / trivial chat that shouldn't trigger a full LLM call."""
    m = message.strip().lower()
    if not m or len(m) > 25 or m.startswith("/"):
        return False
    # Strip leading @mention so "@sonnet 안녕" is still caught
    m_clean = re.sub(r"^@\w+\s*", "", m).strip()
    m_clean = re.sub(r"[\W_]+$", "", m_clean)
    if not m_clean or len(m_clean) > 20:
        return False
    return any(re.fullmatch(p, m_clean, re.IGNORECASE) for p in SMALLTALK_PATTERNS)


# Slash commands for the second brain. Explicit commands are the reliable path;
# the LLM classifier below only handles messages without one.
COMMANDS = {
    "기록": "archivist", "log": "archivist",
    "회의": "minutes", "회의록": "minutes", "meeting": "minutes",
    "찾기": "finder", "검색": "finder", "find": "finder",
    "주간": "reporter", "주간보고": "reporter", "weekly": "reporter",
    "성과": "coach", "커리어": "coach", "career": "coach",
}
COMMAND_RE = re.compile(r"^/(\S+)\s*", re.IGNORECASE)

INTENT_TO_AGENT = {
    "log": "archivist",
    "meeting": "minutes",
    "search": "finder",
    "weekly": "reporter",
    "career": "coach",
}


def classify_intent(message: str) -> Optional[str]:
    """Ask a cheap model whether this is a log / meeting / search / ... message.

    Returns an agent id, or None for "other" or when the call fails, in which
    case the caller falls back to keyword routing.
    """
    from config import MODEL_CLASSIFIER, is_openai_configured
    from services.openai_client import OpenAIError, json_completion
    from .brain_prompts import classifier_prompt

    if not is_openai_configured():
        return None
    try:
        result = json_completion(classifier_prompt(), message[:2000], model=MODEL_CLASSIFIER)
    except OpenAIError:
        return None
    return INTENT_TO_AGENT.get(str(result["data"].get("intent", "")).lower())


# Keyword rules, evaluated in order. First match wins.
KEYWORD_RULES = [
    (
        ["코드", "구현", "함수", "버그", "리팩토", "디버그", "API 만들",
         "스크립트", "컴포넌트", "엔드포인트",
         "code", "implement", "function", "bug", "refactor"],
        "sonnet",
    ),
    (
        ["아키텍처", "설계", "기술 선택", "기술 스택", "ADR",
         "시스템 구조", "마이크로서비스", "모놀리스", "인프라 설계",
         "architecture", "design pattern", "tech stack"],
        "claude",
    ),
    (
        ["검색", "최신", "트렌드", "뉴스", "실시간",
         "search", "latest", "news", "trend"],
        "perplexity",
    ),
    (
        ["이미지", "그림", "로고", "썸네일", "일러스트", "포스터",
         "배너", "아이콘", "디자인", "그려줘",
         "image", "logo", "illustration", "banner"],
        "gemini",
    ),
    (
        ["분석", "보고서", "리포트", "커리큘럼", "교안", "강의",
         "시장", "통계", "SWOT", "데이터 분석",
         "analysis", "report", "curriculum"],
        "chatgpt",
    ),
    (
        ["기획", "로드맵", "태스크", "일정", "계획", "스케줄",
         "마일스톤", "프로젝트", "목표", "전략",
         "plan", "roadmap", "milestone", "strategy"],
        "manus",
    ),
]


MENTION_RE = re.compile(r"^@(\w+)\s*", re.IGNORECASE)

CHANNEL_DEFAULTS = {
    "dev": "sonnet",
    "content": "gemini",
    "research": "perplexity",
    "academy": "chatgpt",
    "meeting": "claude",
}


def route(message: str, channel: Optional[str] = None) -> BaseAgent:
    """Return the agent that should handle this message.

    Priority:
    1. Explicit mention (`@sonnet ...`)
    2. Channel default
    3. Keyword matching
    4. Fallback to Manus (PM)
    """
    # 1. Explicit mention
    match = MENTION_RE.match(message.strip())
    if match:
        mention = match.group(1).lower()
        if mention in AGENTS:
            return AGENTS[mention]

    # 2. Channel default
    if channel and channel in CHANNEL_DEFAULTS:
        return AGENTS[CHANNEL_DEFAULTS[channel]]

    # 3. Keyword rules
    lower_message = message.lower()
    for keywords, agent_id in KEYWORD_RULES:
        if any(_keyword_hit(kw, lower_message) for kw in keywords):
            return AGENTS[agent_id]

    # 4. Default: Manus
    return AGENTS["manus"]


def _keyword_hit(keyword: str, lower_message: str) -> bool:
    kw = keyword.lower()
    if kw.isascii():
        # Whole words only, so "code" doesn't match "decode".
        return re.search(rf"\b{re.escape(kw)}\b", lower_message) is not None
    return kw in lower_message


def strip_mention(message: str) -> str:
    """Remove the leading @mention from a message so the agent doesn't see it."""
    return MENTION_RE.sub("", message.strip(), count=1)


def dispatch(message: str, channel: Optional[str] = None, classify: bool = True) -> tuple:
    """Pick the agent and the text it should see.

    Priority: /command → @mention → channel default → intent classifier →
    keyword rules → Manus.
    """
    text = message.strip()
    cmd = COMMAND_RE.match(text)
    if cmd and cmd.group(1).lower() in COMMANDS:
        return AGENTS[COMMANDS[cmd.group(1).lower()]], text[cmd.end():].strip()

    if MENTION_RE.match(text) or (channel and channel in CHANNEL_DEFAULTS):
        return route(text, channel=channel), strip_mention(text)

    if classify:
        agent_id = classify_intent(text)
        if agent_id:
            return AGENTS[agent_id], text

    return route(text, channel=channel), text
