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

# Second brain: one model per role, so cheap high-volume work (classifying,
# filing logs) doesn't pay for the model used for rare, quality-sensitive
# work (weekly reports, career summaries).
def _model(env_name: str, default: str) -> str:
    return os.getenv(env_name, "").strip() or default


MODEL_CLASSIFIER = _model("MODEL_CLASSIFIER", "gpt-4o-mini")
MODEL_ARCHIVIST = _model("MODEL_ARCHIVIST", "gpt-4o-mini")
MODEL_MINUTES = _model("MODEL_MINUTES", OPENAI_MODEL)
MODEL_FINDER = _model("MODEL_FINDER", OPENAI_MODEL)
MODEL_REPORTER = _model("MODEL_REPORTER", OPENAI_MODEL)
MODEL_COACH = _model("MODEL_COACH", OPENAI_MODEL)
MODEL_SCHEDULER = _model("MODEL_SCHEDULER", "gpt-4o-mini")
EMBEDDING_MODEL = _model("EMBEDDING_MODEL", "text-embedding-3-small")

# Fixed category list: letting the model invent categories makes the same
# kind of work drift across "장애", "운영 이슈", "인시던트" over time.
DEFAULT_CATEGORIES = "개발,운영/장애,회의,기획,팀관리,학습,커리어,기타"
BRAIN_CATEGORIES = [
    c.strip() for c in os.getenv("BRAIN_CATEGORIES", DEFAULT_CATEGORIES).split(",") if c.strip()
]
if "기타" not in BRAIN_CATEGORIES:
    BRAIN_CATEGORIES.append("기타")

# Flask — debug off and loopback-only by default: the Werkzeug debugger
# allows arbitrary code execution for anyone who can reach the port.
FLASK_DEBUG = os.getenv("FLASK_DEBUG", "false").lower() == "true"
FLASK_HOST = os.getenv("FLASK_HOST", "127.0.0.1")
FLASK_PORT = int(os.getenv("FLASK_PORT", "5000"))

# Open the office in the default browser once the server is up (start.bat).
OPEN_BROWSER = os.getenv("OPEN_BROWSER", "false").lower() == "true"

# Privacy: personal data patterns are masked before any OpenAI call
# (services/privacy.py). Extra regexes, e.g. policy numbers, separated by "||".
MASK_PERSONAL_DATA = os.getenv("MASK_PERSONAL_DATA", "true").lower() != "false"
MASK_EXTRA_PATTERNS = [p for p in os.getenv("MASK_EXTRA_PATTERNS", "").split("||") if p.strip()]

# Storage
CHAT_HISTORY_FILE = DATA_DIR / "chat_history.json"
BRAIN_DB_FILE = DATA_DIR / "brain.db"
BACKUP_DIR = DATA_DIR / "backups"
BACKUP_KEEP = int(os.getenv("BACKUP_KEEP", "14"))  # daily copies of brain.db


def is_openai_configured() -> bool:
    """Return True if a non-empty OpenAI API key is set."""
    return bool(OPENAI_API_KEY) and OPENAI_API_KEY.startswith("sk-")
