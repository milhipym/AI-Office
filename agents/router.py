"""Task router — decides which staff member handles a message.

Commands and classifier intents come from agents/roster.py, so a new team is
routable as soon as it has a roster entry and a registered agent.
"""

import re
from typing import Optional

from . import AGENTS
from .roster import commands, intents

FALLBACK_AGENT = "assistant"

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
    m = re.sub(r"[\W_]+$", "", m)
    if not m or len(m) > 20:
        return False
    return any(re.fullmatch(p, m, re.IGNORECASE) for p in SMALLTALK_PATTERNS)


COMMAND_RE = re.compile(r"^/(\S+)\s*")


def classify_intent(message: str) -> Optional[str]:
    """Ask the classifier model which staff member should get this message.

    Returns a staff id, or None for "other" or when the call fails; the
    caller then hands the message to the general assistant.
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
    agent_id = intents().get(str(result["data"].get("intent", "")).lower())
    return agent_id if agent_id in AGENTS else None


def dispatch(message: str, classify: bool = True) -> tuple:
    """Pick the agent and the text it should see.

    Returns (agent, text, routed_by) where routed_by is "command",
    "classifier" or "fallback".
    """
    text = message.strip()
    cmd = COMMAND_RE.match(text)
    if cmd:
        agent_id = commands().get(cmd.group(1).lower())
        if agent_id in AGENTS:
            return AGENTS[agent_id], text[cmd.end():].strip(), "command"

    if classify:
        agent_id = classify_intent(text)
        if agent_id:
            return AGENTS[agent_id], text, "classifier"

    return AGENTS[FALLBACK_AGENT], text, "fallback"
