"""Daily copy of brain.db, taken when the app starts.

Uses SQLite's backup API rather than a file copy so a copy taken while the
database is being written is still consistent.
"""

import sqlite3
from datetime import date
from pathlib import Path
from typing import Optional


def backup_db(db_path: Path, backup_dir: Path, keep: int, today: Optional[date] = None) -> Optional[Path]:
    """Copy db_path to backup_dir/brain-YYYY-MM-DD.db once a day.

    Keeps the newest `keep` copies. Returns the new copy, or None when there
    is nothing to back up or today's copy already exists.
    """
    if not db_path.exists() or keep <= 0:
        return None
    backup_dir.mkdir(parents=True, exist_ok=True)
    target = backup_dir / f"brain-{(today or date.today()).isoformat()}.db"
    if target.exists():
        return None

    src = sqlite3.connect(db_path)
    dst = sqlite3.connect(target)
    try:
        src.backup(dst)
    finally:
        dst.close()
        src.close()

    # ISO dates sort chronologically as strings.
    for old in sorted(backup_dir.glob("brain-*.db"))[:-keep]:
        old.unlink()
    return target
