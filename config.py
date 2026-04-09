"""Configuration loader for AI Office.

Reads environment variables from .env file (if present) and exposes them
as module-level constants.
"""

import os
from pathlib import Path

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    # python-dotenv not installed; rely on OS env vars
    pass

BASE_DIR = Path(__file__).parent
DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(exist_ok=True)

# OpenAI
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "").strip()
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o")
OPENAI_IMAGE_MODEL = os.getenv("OPENAI_IMAGE_MODEL", "dall-e-3")

# Flask
FLASK_DEBUG = os.getenv("FLASK_DEBUG", "true").lower() == "true"
FLASK_PORT = int(os.getenv("FLASK_PORT", "5000"))

# Storage
CHAT_HISTORY_FILE = DATA_DIR / "chat_history.json"


def is_openai_configured() -> bool:
    """Return True if a non-empty OpenAI API key is set."""
    return bool(OPENAI_API_KEY) and OPENAI_API_KEY.startswith("sk-")
