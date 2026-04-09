"""Task router — decides which agent should handle a given message."""

import re
from typing import Optional

from . import AGENTS
from .base import BaseAgent


# Simple greetings / small talk — we bypass the LLM for these
SMALLTALK_PATTERNS = [
    r"^(안녕|안뇽|안뇨|하이|헬로|헤이|반가워|반갑|ㅎㅇ|방가|헐로)",
    r"^(hi|hello|hey|yo|sup|howdy|greetings)\W*$",
    r"^잘\s*지내",
    r"^뭐\s*해",
    r"^좋은\s*(아침|저녁|오후|밤|하루)",
    r"^(고마워|감사|thanks|thank\s*you|thx|ty)\W*$",
    r"^(수고|고생)(했|하셨)",
    r"^(ㅋㅋ+|ㅎㅎ+|ㅠㅠ+|lol|haha)\W*$",
    r"^(네|예|응|어|ok|okay|yes|no|아니|좋아)\W*$",
    r"^(뭐|what)\?*$",
    r"^test\W*$",
    r"^테스트\W*$",
]


def is_smalltalk(message: str) -> bool:
    """Return True for greetings / trivial chat that shouldn't trigger a full LLM call."""
    m = message.strip().lower()
    if not m or len(m) > 25:
        return False
    # Strip leading @mention so "@sonnet 안녕" is still caught
    m_clean = re.sub(r"^@\w+\s*", "", m).strip()
    if not m_clean or len(m_clean) > 20:
        return False
    for pattern in SMALLTALK_PATTERNS:
        if re.search(pattern, m_clean, re.IGNORECASE):
            return True
    return False


# Keyword rules, evaluated in order. First match wins.
KEYWORD_RULES = [
    (
        ["코드", "구현", "함수", "버그", "리팩토", "디버그", "API 만들",
         "작성해", "짜줘", "스크립트", "컴포넌트", "엔드포인트",
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
        ["검색", "최신", "트렌드", "뉴스", "지금", "오늘",
         "2025년", "2026년", "2025", "2026", "최근", "실시간",
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
    channel_defaults = {
        "dev": "sonnet",
        "content": "gemini",
        "research": "perplexity",
        "academy": "chatgpt",
        "meeting": "claude",
    }
    if channel and channel in channel_defaults:
        return AGENTS[channel_defaults[channel]]

    # 3. Keyword rules
    lower_message = message.lower()
    for keywords, agent_id in KEYWORD_RULES:
        if any(kw in lower_message or kw in message for kw in keywords):
            return AGENTS[agent_id]

    # 4. Default: Manus
    return AGENTS["manus"]


def strip_mention(message: str) -> str:
    """Remove the leading @mention from a message so the agent doesn't see it."""
    return MENTION_RE.sub("", message.strip(), count=1)
