"""AI agent definitions and registry."""

from .claude_opus import ClaudeOpusAgent
from .claude_sonnet import ClaudeSonnetAgent
from .manus import ManusAgent
from .gemini import GeminiAgent
from .chatgpt import ChatGPTAgent
from .perplexity import PerplexityAgent
from .brain_agents import ArchivistAgent, MinutesAgent, FinderAgent, ReporterAgent, CoachAgent

AGENTS = {
    "claude": ClaudeOpusAgent(),
    "opus": ClaudeOpusAgent(),  # alias
    "sonnet": ClaudeSonnetAgent(),
    "manus": ManusAgent(),
    "gemini": GeminiAgent(),
    "chatgpt": ChatGPTAgent(),
    "gpt": ChatGPTAgent(),  # alias
    "perplexity": PerplexityAgent(),
    "ppl": PerplexityAgent(),  # alias
    # Second brain
    "archivist": ArchivistAgent(),
    "minutes": MinutesAgent(),
    "finder": FinderAgent(),
    "reporter": ReporterAgent(),
    "coach": CoachAgent(),
}

__all__ = ["AGENTS"]
