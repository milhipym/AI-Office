"""AI agent registry. Display data for each agent lives in agents/roster.py."""

from .assistant import AssistantAgent
from .brain_agents import ArchivistAgent, CoachAgent, FinderAgent, MinutesAgent, ReporterAgent

AGENTS = {
    agent.id: agent
    for agent in (
        AssistantAgent(),
        ArchivistAgent(),
        MinutesAgent(),
        FinderAgent(),
        ReporterAgent(),
        CoachAgent(),
    )
}

__all__ = ["AGENTS"]
