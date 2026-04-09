"""AI agent definitions and registry."""

from .claude_opus import ClaudeOpusAgent
from .claude_sonnet import ClaudeSonnetAgent
from .manus import ManusAgent
from .gemini import GeminiAgent
from .chatgpt import ChatGPTAgent
from .perplexity import PerplexityAgent

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
}

__all__ = ["AGENTS"]
