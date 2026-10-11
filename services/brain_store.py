"""Second-brain record store backed by SQLite.

Each row is one thing that happened: a work log entry or a meeting. Embeddings
are stored as float32 blobs next to the row so search needs no extra service;
at personal scale (thousands of rows) a linear cosine scan is fast enough.
"""

import json
import math
import sqlite3
import threading
from array import array
from contextlib import contextmanager
from datetime import datetime
from typing import Optional

from config import BRAIN_DB_FILE

# Overridable so tests can point at a temporary file.
DB_PATH = BRAIN_DB_FILE

_lock = threading.Lock()

_SCHEMA = """
CREATE TABLE IF NOT EXISTS entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kind TEXT NOT NULL,                 -- 'log' | 'meeting'
    entry_date TEXT NOT NULL,           -- YYYY-MM-DD the event happened
    created_at TEXT NOT NULL,
    category TEXT NOT NULL,
    title TEXT NOT NULL,
    summary TEXT NOT NULL DEFAULT '',
    content TEXT NOT NULL,              -- the user's original text
    tags TEXT NOT NULL DEFAULT '[]',
    details TEXT NOT NULL DEFAULT '{}', -- kind-specific fields (decisions, action items, impact)
    embedding BLOB
);
CREATE INDEX IF NOT EXISTS idx_entries_date ON entries(entry_date);
"""


@contextmanager
def _db():
    """Open a connection, commit on success, and always close it."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        conn.executescript(_SCHEMA)
        with conn:
            yield conn
    finally:
        conn.close()


def _pack(vector: Optional[list]) -> Optional[bytes]:
    if not vector:
        return None
    return array("f", vector).tobytes()


def _unpack(blob: Optional[bytes]) -> Optional[list]:
    if not blob:
        return None
    vec = array("f")
    vec.frombytes(blob)
    return vec.tolist()


def _row_to_dict(row: sqlite3.Row, with_embedding: bool = False) -> dict:
    entry = {
        "id": row["id"],
        "kind": row["kind"],
        "entry_date": row["entry_date"],
        "created_at": row["created_at"],
        "category": row["category"],
        "title": row["title"],
        "summary": row["summary"],
        "content": row["content"],
        "tags": json.loads(row["tags"] or "[]"),
        "details": json.loads(row["details"] or "{}"),
    }
    if with_embedding:
        entry["embedding"] = _unpack(row["embedding"])
    return entry


def add_entry(
    kind: str,
    entry_date: str,
    category: str,
    title: str,
    content: str,
    summary: str = "",
    tags: Optional[list] = None,
    details: Optional[dict] = None,
    embedding: Optional[list] = None,
) -> dict:
    with _lock, _db() as conn:
        cur = conn.execute(
            """INSERT INTO entries
               (kind, entry_date, created_at, category, title, summary, content, tags, details, embedding)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                kind,
                entry_date,
                datetime.now().isoformat(timespec="seconds"),
                category,
                title,
                summary,
                content,
                json.dumps(tags or [], ensure_ascii=False),
                json.dumps(details or {}, ensure_ascii=False),
                _pack(embedding),
            ),
        )
        row = conn.execute("SELECT * FROM entries WHERE id = ?", (cur.lastrowid,)).fetchone()
    return _row_to_dict(row)


def list_entries(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    category: Optional[str] = None,
    kind: Optional[str] = None,
    limit: Optional[int] = None,
    with_embedding: bool = False,
) -> list:
    """Entries filtered by inclusive date range, newest first."""
    clauses, params = [], []
    if date_from:
        clauses.append("entry_date >= ?")
        params.append(date_from)
    if date_to:
        clauses.append("entry_date <= ?")
        params.append(date_to)
    if category:
        clauses.append("category = ?")
        params.append(category)
    if kind:
        clauses.append("kind = ?")
        params.append(kind)
    sql = "SELECT * FROM entries"
    if clauses:
        sql += " WHERE " + " AND ".join(clauses)
    sql += " ORDER BY entry_date DESC, id DESC"
    if limit:
        sql += " LIMIT ?"
        params.append(int(limit))
    with _db() as conn:
        rows = conn.execute(sql, params).fetchall()
    return [_row_to_dict(r, with_embedding) for r in rows]


def delete_entry(entry_id: int) -> bool:
    with _lock, _db() as conn:
        cur = conn.execute("DELETE FROM entries WHERE id = ?", (entry_id,))
    return cur.rowcount > 0


def cosine(a: list, b: list) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(y * y for y in b))
    if na == 0 or nb == 0:
        return 0.0
    return dot / (na * nb)
