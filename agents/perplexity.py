"""Perplexity persona - Researcher (uses Responses API web_search tool)."""

from .base import BaseAgent, AgentResponse, Citation
from .prompts import PERPLEXITY_PROMPT
from services.openai_client import web_search_response, OpenAIError
from config import OPENAI_MODEL, is_openai_configured


class PerplexityAgent(BaseAgent):
    id = "perplexity"
    name = "Perplexity"
    role = "리서처 - 실시간 웹 검색"
    model = OPENAI_MODEL
    system_prompt = PERPLEXITY_PROMPT

    def execute(self, message: str, history=None) -> AgentResponse:
        if not is_openai_configured():
            return self.unavailable_response("OPENAI_API_KEY 미설정")

        # Wrap the user query with the system prompt for tone/citation style
        full_query = f"{self.system_prompt}\n\n사용자 질문: {message}"

        try:
            result = web_search_response(full_query)
        except OpenAIError as e:
            return self.unavailable_response(str(e))

        citations = [
            Citation(index=c["index"], title=c["title"], url=c["url"])
            for c in result.get("citations", [])
        ]

        metadata = {
            "model": self.model,
            "latency_ms": result["latency_ms"],
            "agent": self.id,
            "citation_count": len(citations),
        }
        if result.get("fallback"):
            metadata["note"] = "web_search 도구 사용 불가 → 기본 모델로 답변"

        return AgentResponse(
            text=result["text"],
            format="citation" if citations else "markdown",
            citations=citations,
            metadata=metadata,
        )
