"""업무 비서 — general-purpose fallback for anything that isn't a record task."""

from config import OPENAI_MODEL, is_openai_configured
from services.openai_client import OpenAIError, chat_completion

from .base import AgentResponse, BaseAgent, extract_code_blocks

ASSISTANT_PROMPT = """당신은 사용자의 업무 비서입니다. 사용자는 모바일 앱/웹 개발 조직을 이끄는 리더입니다.

- 짧은 질문/인사에는 1~3줄로 자연스럽게 답합니다.
- 메일·보고서·공지 초안 요청에는 바로 쓸 수 있는 완성본을 마크다운으로 씁니다.
- 모르는 사실은 추측하지 말고 모른다고 말합니다.
- 사용자가 업무 기록을 남기려는 것 같으면 `/기록`, 회의 메모면 `/회의`, 과거 기록을 찾으면 `/찾기`를 안내합니다.

한국어로 답하되 기술 용어는 영문을 유지합니다."""


def own_history(history):
    """Only this agent's own exchanges: other staff's replies are not its words."""
    if not history:
        return []
    picked = []
    for prev, msg in zip(history, history[1:]):
        if msg.get("agent") == AssistantAgent.id and prev.get("agent") == "user":
            picked += [prev, msg]
    return picked


class AssistantAgent(BaseAgent):
    id = "assistant"
    name = "업무 비서"
    role = "일반 질문 · 문서 작성"
    model = OPENAI_MODEL
    system_prompt = ASSISTANT_PROMPT

    def execute(self, message: str, history=None) -> AgentResponse:
        if not is_openai_configured():
            return self.unavailable_response("OPENAI_API_KEY 미설정")
        try:
            result = chat_completion(
                system_prompt=self.system_prompt,
                user_message=message,
                history=own_history(history),
                model=self.model,
                temperature=None,  # reasoning models reject temperature
            )
        except OpenAIError as e:
            return self.unavailable_response(str(e))

        text, blocks = extract_code_blocks(result["text"])
        return AgentResponse(
            text=text,
            format="code" if blocks else "markdown",
            code_blocks=blocks,
            metadata={
                "model": result["model"],
                "tokens": result["tokens"],
                "latency_ms": result["latency_ms"],
                "agent": self.id,
            },
        )
