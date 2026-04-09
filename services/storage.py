"""Persistent chat history storage backed by a local JSON file."""

import json
import threading
from typing import List, Dict

from config import CHAT_HISTORY_FILE

# RLock so append_message can call save_history while already holding the lock
_lock = threading.RLock()


def load_history() -> List[Dict]:
    """Load chat history from the JSON file. Returns empty list if missing."""
    if not CHAT_HISTORY_FILE.exists():
        return []
    try:
        with CHAT_HISTORY_FILE.open("r", encoding="utf-8") as f:
            data = json.load(f)
            if isinstance(data, list):
                return data
            return []
    except (json.JSONDecodeError, OSError):
        return []


def save_history(messages: List[Dict]) -> None:
    """Overwrite the chat history file."""
    with _lock:
        CHAT_HISTORY_FILE.parent.mkdir(parents=True, exist_ok=True)
        with CHAT_HISTORY_FILE.open("w", encoding="utf-8") as f:
            json.dump(messages, f, ensure_ascii=False, indent=2)


def append_message(message: Dict) -> None:
    """Append a single message to the history file."""
    with _lock:
        messages = load_history()
        messages.append(message)
        save_history(messages)


def clear_history() -> None:
    """Delete all stored messages."""
    with _lock:
        save_history([])
