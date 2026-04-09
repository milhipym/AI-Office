"""Gemini persona - Creative Director (generates images via DALL-E 3)."""

import re

from .base import BaseAgent, AgentResponse, ImageResult, extract_code_blocks
from .prompts import GEMINI_PROMPT
from services.openai_client import chat_completion, generate_image, OpenAIError
from config import is_openai_configured


# Keywords that indicate the user wants an actual image
IMAGE_KEYWORDS = [
    "이미지", "그림", "로고", "썸네일", "일러스트", "포스터",
    "배너", "아이콘", "사진", "디자인해", "그려", "만들어",
    "image", "logo", "illustration", "picture",
]


def wants_image(message: str) -> bool:
    lower = message.lower()
    return any(kw in lower for kw in IMAGE_KEYWORDS)


class GeminiAgent(BaseAgent):
    id = "gemini"
    name = "Gemini"
    role = "디자이너 - 콘텐츠 / 이미지"
    model = "gpt-4o"
    system_prompt = GEMINI_PROMPT

    def execute(self, message: str, history=None) -> AgentResponse:
        if not is_openai_configured():
            return self.unavailable_response("OPENAI_API_KEY 미설정")

        # If the user is asking for an image, generate one with DALL-E 3
        if wants_image(message):
            return self._generate_image(message)

        # Otherwise, respond with copy/concept via chat
        try:
            result = chat_completion(
                system_prompt=self.system_prompt,
                user_message=message,
                history=history,
                model=self.model,
                temperature=0.8,
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

    def _generate_image(self, message: str) -> AgentResponse:
        # Step 1: Let GPT-4o refine the user request into a DALL-E prompt
        try:
            prompt_refinement = chat_completion(
                system_prompt=(
                    "You translate user requests into concise, vivid DALL-E 3 "
                    "prompts in English. Return ONLY the prompt, no explanation. "
                    "Keep it under 200 characters. Describe style, subject, "
                    "composition, color, and mood."
                ),
                user_message=message,
                model=self.model,
                temperature=0.7,
            )
            dalle_prompt = prompt_refinement["text"].strip().strip('"')
        except OpenAIError as e:
            return self.unavailable_response(str(e))

        # Step 2: Call DALL-E 3
        try:
            image_result = generate_image(dalle_prompt)
        except OpenAIError as e:
            return AgentResponse(
                text=(
                    f"이미지 생성에 실패했습니다.\n\n**에러:** {e}\n\n"
                    f"**시도한 프롬프트:** {dalle_prompt}"
                ),
                format="markdown",
                metadata={"error": str(e), "agent": self.id},
            )

        # Step 3: Compose response
        return AgentResponse(
            text=(
                f"🎨 이미지를 생성했습니다.\n\n"
                f"**요청:** {message}\n\n"
                f"**DALL-E 프롬프트:** `{dalle_prompt}`"
            ),
            format="image",
            images=[
                ImageResult(
                    url=image_result["url"],
                    prompt=image_result.get("revised_prompt", dalle_prompt),
                )
            ],
            metadata={
                "model": "dall-e-3",
                "latency_ms": image_result["latency_ms"],
                "agent": self.id,
            },
        )
