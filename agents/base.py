"""Base agent class and shared response schema."""

import re
from abc import ABC, abstractmethod
from dataclasses import dataclass, field, asdict
from typing import Literal, Optional


@dataclass
class CodeBlock:
    filename: Optional[str]
    language: str
    code: str


@dataclass
class ImageResult:
    url: str
    prompt: str


@dataclass
class Citation:
    index: int
    title: str
    url: str


@dataclass
class AgentResponse:
    text: str
    format: Literal["markdown", "code", "image", "citation", "plain"] = "markdown"
    code_blocks: list = field(default_factory=list)
    images: list = field(default_factory=list)
    citations: list = field(default_factory=list)
    metadata: dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        return {
            "text": self.text,
            "format": self.format,
            "code_blocks": [asdict(c) for c in self.code_blocks],
            "images": [asdict(i) for i in self.images],
            "citations": [asdict(c) for c in self.citations],
            "metadata": self.metadata,
        }


# Matches ``` blocks. Captures language(:filename) + content.
CODE_FENCE_RE = re.compile(
    r"```([a-zA-Z0-9_+\-]*)(?::([^\n`]+))?\n(.*?)```",
    re.DOTALL,
)


def extract_code_blocks(text: str) -> tuple[str, list[CodeBlock]]:
    """Extract ```lang:filename blocks from markdown.

    Returns the original text (unchanged - the frontend still renders the fences)
    and a list of CodeBlock objects for structured display.
    """
    blocks = []
    for match in CODE_FENCE_RE.finditer(text):
        language = (match.group(1) or "text").strip()
        filename = (match.group(2) or "").strip() or None
        code = match.group(3).rstrip()
        blocks.append(CodeBlock(filename=filename, language=language, code=code))
    return text, blocks


class BaseAgent(ABC):
    """All agents inherit from this and implement execute()."""

    id: str = ""
    name: str = ""
    role: str = ""
    model: str = "gpt-4o"
    system_prompt: str = ""

    @abstractmethod
    def execute(self, message: str, history: Optional[list] = None) -> AgentResponse:
        ...

    def unavailable_response(self, reason: str) -> AgentResponse:
        """Return a standard fallback message when the API is unavailable."""
        return AgentResponse(
            text=(
                f"**{self.name}** 에이전트를 사용할 수 없습니다.\n\n"
                f"**원인:** {reason}\n\n"
                "`.env` 파일에 `OPENAI_API_KEY`를 설정한 뒤 서버를 재시작하세요."
            ),
            format="markdown",
            metadata={"error": reason, "agent": self.id},
        )
