"""Claude Opus persona - CTO / Architect."""

from .base import BaseAgent, AgentResponse, extract_code_blocks
from .prompts import CLAUDE_OPUS_PROMPT
from services.openai_client import chat_completion, OpenAIError
from config import OPENAI_MODEL, is_openai_configured


class ClaudeOpusAgent(BaseAgent):
    id = "claude"
    name = "Claude Opus"
    role = "CTO - 아키텍처 설계"
    model = OPENAI_MODEL
    system_prompt = CLAUDE_OPUS_PROMPT

    def execute(self, message: str, history=None) -> AgentResponse:
        if not is_openai_configured():
            return self.unavailable_response("OPENAI_API_KEY 미설정")

        try:
            result = chat_completion(
                system_prompt=self.system_prompt,
                user_message=message,
                history=history,
                model=self.model,
                temperature=0.4,
            )
        except OpenAIError as e:
            return self.unavailable_response(str(e))

        text, blocks = extract_code_blocks(result["text"])
        return AgentResponse(
            text=text,
            format="markdown",
            code_blocks=blocks,
            metadata={
                "model": result["model"],
                "tokens": result["tokens"],
                "latency_ms": result["latency_ms"],
                "agent": self.id,
            },
        )
