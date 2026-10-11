"""Second-brain agents: log filing, meeting minutes, search, weekly report, career.

Each agent uses its own model (see config.MODEL_*), so high-volume filing runs
on a cheap model while rare, quality-sensitive summaries use a stronger one.
"""

import re
from datetime import date, timedelta

from config import (
    MODEL_ARCHIVIST,
    MODEL_COACH,
    MODEL_FINDER,
    MODEL_MINUTES,
    MODEL_REPORTER,
    is_openai_configured,
)
from services import brain_store
from services.openai_client import OpenAIError, chat_completion, embed, json_completion

from .base import AgentResponse, BaseAgent
from .brain_common import (
    embedding_text,
    format_entry_for_prompt,
    normalize_category,
    normalize_tags,
    parse_iso,
    resolve_period,
    week_bounds,
)
from .brain_prompts import (
    COACH_PROMPT,
    FINDER_PROMPT,
    REPORTER_PROMPT,
    archivist_prompt,
    minutes_prompt,
)

WEEKDAYS = ["월요일", "화요일", "수요일", "목요일", "금요일", "토요일", "일요일"]

# Upper bound on records sent to a summarizing model in one call.
MAX_CONTEXT_ENTRIES = 300
SEARCH_TOP_K = 8


def today() -> date:
    """Indirection so tests can pin the date."""
    return date.today()


def _embed_one(text: str):
    """Embedding for one text, or None when the embedding call fails.

    Filing must not fail just because embeddings are unavailable; search
    falls back to keyword matching for rows without a vector.
    """
    try:
        return embed([text])[0]
    except (OpenAIError, IndexError):
        return None


def _meta(agent, result: dict, **extra) -> dict:
    meta = {
        "agent": agent.id,
        "model": result.get("model", agent.model),
        "tokens": result.get("tokens", 0),
        "latency_ms": result.get("latency_ms", 0),
    }
    meta.update(extra)
    return meta


class BrainAgent(BaseAgent):
    def guard(self):
        if not is_openai_configured():
            return self.unavailable_response("OPENAI_API_KEY 미설정")
        return None


class ArchivistAgent(BrainAgent):
    id = "archivist"
    name = "아카이브"
    role = "기록 담당"
    model = MODEL_ARCHIVIST

    def execute(self, message: str, history=None) -> AgentResponse:
        if (blocked := self.guard()):
            return blocked
        if not message.strip():
            return AgentResponse(text="기록할 내용을 함께 적어 주세요. 예: `/기록 결제 모듈 타임아웃 원인 찾아서 배포함`")

        now = today()
        try:
            result = json_completion(
                archivist_prompt(now.isoformat(), WEEKDAYS[now.weekday()]),
                message,
                model=self.model,
            )
        except OpenAIError as e:
            return self.unavailable_response(str(e))

        raw_entries = result["data"].get("entries")
        if not isinstance(raw_entries, list) or not raw_entries:
            raw_entries = [{}]

        saved = []
        for raw in raw_entries[:10]:
            if not isinstance(raw, dict):
                continue
            title = str(raw.get("title") or message[:20]).strip()
            summary = str(raw.get("summary") or "").strip()
            tags = normalize_tags(raw.get("tags"))
            entry_date = parse_iso(raw.get("date"), now)
            if entry_date > now:
                entry_date = now
            details = {"achievement": bool(raw.get("achievement"))}
            if raw.get("impact"):
                details["impact"] = str(raw["impact"]).strip()
            saved.append(brain_store.add_entry(
                kind="log",
                entry_date=entry_date.isoformat(),
                category=normalize_category(raw.get("category")),
                title=title,
                summary=summary,
                content=message,
                tags=tags,
                details=details,
                embedding=_embed_one(embedding_text(title, summary, message, tags)),
            ))

        lines = [f"📥 **{len(saved)}건 기록했습니다.**", "", "| 날짜 | 분류 | 제목 | 태그 |", "|---|---|---|---|"]
        for e in saved:
            star = " 🏆" if e["details"].get("achievement") else ""
            lines.append(
                f"| {e['entry_date']} | {e['category']} | {e['title']}{star} | "
                f"{' '.join('#' + t for t in e['tags'])} |"
            )
        if any(e["details"].get("achievement") and not e["details"].get("impact") for e in saved):
            lines += ["", "💡 성과로 보이는 기록입니다. 수치(시간 단축, 건수, 비율 등)를 덧붙이면 나중에 성과 정리에 그대로 쓰입니다."]
        return AgentResponse(
            text="\n".join(lines),
            metadata=_meta(self, result, brain_refresh=True, entry_ids=[e["id"] for e in saved]),
        )


class MinutesAgent(BrainAgent):
    id = "minutes"
    name = "회의록 서기"
    role = "회의록 담당"
    model = MODEL_MINUTES

    def execute(self, message: str, history=None) -> AgentResponse:
        if (blocked := self.guard()):
            return blocked
        if len(message.strip()) < 10:
            return AgentResponse(text="회의 메모를 함께 붙여 주세요. 예:\n\n```\n/회의 앱 리뉴얼 킥오프, 참석 김OO 이OO\n- 출시일 12월 둘째 주로 확정\n- 디자인 시안 이OO 다음 주 수요일까지\n```")

        now = today()
        try:
            result = json_completion(
                minutes_prompt(now.isoformat(), WEEKDAYS[now.weekday()]),
                message,
                model=self.model,
            )
        except OpenAIError as e:
            return self.unavailable_response(str(e))

        data = result["data"]
        title = str(data.get("title") or "회의").strip()
        summary = str(data.get("summary") or "").strip()
        tags = normalize_tags(data.get("tags"))
        entry_date = min(parse_iso(data.get("date"), now), now)
        details = {
            "attendees": [str(a) for a in data.get("attendees") or [] if a],
            "decisions": [str(d) for d in data.get("decisions") or [] if d],
            "open_issues": [str(i) for i in data.get("open_issues") or [] if i],
            "action_items": [
                {
                    "task": str(i.get("task", "")),
                    "owner": str(i.get("owner", "") or ""),
                    "due": _optional_date(i.get("due")),
                }
                for i in data.get("action_items") or []
                if isinstance(i, dict) and i.get("task")
            ],
        }
        entry = brain_store.add_entry(
            kind="meeting",
            entry_date=entry_date.isoformat(),
            category=normalize_category("회의"),
            title=title,
            summary=summary,
            content=message,
            tags=tags,
            details=details,
            embedding=_embed_one(embedding_text(title, summary, message, tags)),
        )
        return AgentResponse(
            text=render_minutes(entry),
            metadata=_meta(self, result, brain_refresh=True, entry_ids=[entry["id"]]),
        )


def _optional_date(value) -> str:
    parsed = parse_iso(value, date.min)
    return "" if parsed == date.min else parsed.isoformat()


def render_minutes(entry: dict) -> str:
    d = entry["details"]
    out = [f"## 📝 {entry['title']}", f"**일자:** {entry['entry_date']}"]
    if d.get("attendees"):
        out.append(f"**참석:** {', '.join(d['attendees'])}")
    if entry["summary"]:
        out += ["", entry["summary"]]
    if d.get("decisions"):
        out += ["", "### ✅ 결정사항"] + [f"- {x}" for x in d["decisions"]]
    if d.get("action_items"):
        out += ["", "### 📌 액션 아이템", "| 할 일 | 담당 | 기한 |", "|---|---|---|"]
        out += [f"| {i['task']} | {i['owner'] or '미정'} | {i['due'] or '-'} |" for i in d["action_items"]]
    if d.get("open_issues"):
        out += ["", "### ❓ 미결 사항"] + [f"- {x}" for x in d["open_issues"]]
    out += ["", f"_회의록 #{entry['id']}로 저장했습니다._"]
    return "\n".join(out)


TOKEN_RE = re.compile(r"[0-9A-Za-z가-힣]{2,}")
# Words that describe the question rather than its subject.
STOPWORDS = {"찾아줘", "찾아", "알려줘", "기록", "내용", "있었지", "있었나", "했지", "언제", "뭐였지", "관련", "대해", "지난주", "이번주", "지난달", "이번달", "오늘", "어제", "최근"}


def rank_entries(query: str, entries: list, query_vec=None, top_k: int = SEARCH_TOP_K) -> list:
    """Rank entries by embedding similarity plus a keyword-overlap bonus."""
    tokens = [t for t in TOKEN_RE.findall(query.lower()) if t not in STOPWORDS]
    scored = []
    for e in entries:
        haystack = " ".join([e["title"], e["summary"], e["content"], " ".join(e["tags"])]).lower()
        hits = sum(1 for t in tokens if t in haystack)
        keyword = hits / len(tokens) if tokens else 0.0
        semantic = brain_store.cosine(query_vec, e["embedding"]) if query_vec and e.get("embedding") else 0.0
        score = semantic + 0.3 * keyword
        if score > 0:
            scored.append((score, e))
    scored.sort(key=lambda s: s[0], reverse=True)
    return [e for _, e in scored[:top_k]]


class FinderAgent(BrainAgent):
    id = "finder"
    name = "파인더"
    role = "기록 검색 담당"
    model = MODEL_FINDER

    def execute(self, message: str, history=None) -> AgentResponse:
        if (blocked := self.guard()):
            return blocked
        if not message.strip():
            return AgentResponse(text="무엇을 찾을지 적어 주세요. 예: `/찾기 지난달 결제 장애`")

        period = resolve_period(message, today())
        date_from, date_to, label = period if period else (None, None, "전체 기간")
        candidates = brain_store.list_entries(date_from=date_from, date_to=date_to, with_embedding=True)
        if not candidates:
            return AgentResponse(
                text=f"🔎 {label}에 저장된 기록이 없습니다.",
                metadata={"agent": self.id, "period": label},
            )

        query_vec = _embed_one(message)
        if period and len(candidates) <= SEARCH_TOP_K:
            # The period alone narrowed it down; don't drop anything by score.
            hits = candidates
        else:
            hits = rank_entries(message, candidates, query_vec)
        if not hits:
            return AgentResponse(
                text=f"🔎 {label} 기록 {len(candidates)}건 중 관련된 내용을 찾지 못했습니다.",
                metadata={"agent": self.id, "period": label},
            )

        context = "\n\n".join(format_entry_for_prompt(e) for e in sorted(hits, key=lambda e: e["entry_date"]))
        try:
            result = chat_completion(
                system_prompt=FINDER_PROMPT,
                user_message=f"[기간] {label}\n\n[기록]\n{context}\n\n[질문]\n{message}",
                model=self.model,
                temperature=None,
            )
        except OpenAIError as e:
            return self.unavailable_response(str(e))

        refs = "\n".join(f"- #{e['id']} · {e['entry_date']} · {e['category']} · {e['title']}" for e in hits)
        return AgentResponse(
            text=f"{result['text']}\n\n---\n**참고한 기록** ({label}, {len(candidates)}건 중 {len(hits)}건)\n{refs}",
            metadata=_meta(self, result, period=label, hit_ids=[e["id"] for e in hits]),
        )


def _summarize(agent, system_prompt: str, entries: list, header: str) -> AgentResponse:
    entries = sorted(entries, key=lambda e: (e["entry_date"], e["id"]))
    truncated = len(entries) > MAX_CONTEXT_ENTRIES
    if truncated:
        # Keep flagged achievements first, then the most recent of the rest.
        flagged = [e for e in entries if e["details"].get("achievement")]
        rest = [e for e in entries if not e["details"].get("achievement")]
        keep = flagged[-MAX_CONTEXT_ENTRIES:]
        keep += rest[-(MAX_CONTEXT_ENTRIES - len(keep)):] if len(keep) < MAX_CONTEXT_ENTRIES else []
        entries = sorted(keep, key=lambda e: (e["entry_date"], e["id"]))
    # Full original text only fits for short periods.
    full = len(entries) <= 60
    context = "\n\n".join(format_entry_for_prompt(e, full=full) for e in entries)
    try:
        result = chat_completion(
            system_prompt=system_prompt,
            user_message=f"{header}\n\n[기록]\n{context}",
            model=agent.model,
            temperature=None,
        )
    except OpenAIError as e:
        return agent.unavailable_response(str(e))
    note = f"\n\n_기록이 많아 {MAX_CONTEXT_ENTRIES}건만 반영했습니다 (성과 표시 기록 우선)._" if truncated else ""
    return AgentResponse(
        text=result["text"] + note,
        metadata=_meta(agent, result, entry_count=len(entries)),
    )


class ReporterAgent(BrainAgent):
    id = "reporter"
    name = "리포터"
    role = "주간 보고 담당"
    model = MODEL_REPORTER

    def execute(self, message: str, history=None) -> AgentResponse:
        if (blocked := self.guard()):
            return blocked
        now = today()
        if any(w in message for w in ("지난주", "저번주", "지난 주", "저번 주")):
            start, end = week_bounds(now - timedelta(days=7))
        else:
            start, end = week_bounds(parse_iso(message, now))
        end = min(end, now)
        entries = brain_store.list_entries(date_from=start.isoformat(), date_to=end.isoformat())
        label = f"{start.isoformat()} ~ {end.isoformat()}"
        if not entries:
            return AgentResponse(
                text=f"📭 {label} 기간에 기록이 없어 주간 보고를 만들 수 없습니다.\n\n`/기록 ...`으로 그날그날 한 일을 남겨 주세요.",
                metadata={"agent": self.id, "period": label},
            )
        resp = _summarize(self, REPORTER_PROMPT, entries, f"[보고 기간] {label}\n[추가 요청] {message or '없음'}")
        resp.text = f"# 📊 주간 업무 보고 ({label})\n\n{resp.text}"
        resp.metadata["period"] = label
        return resp


class CoachAgent(BrainAgent):
    id = "coach"
    name = "커리어 코치"
    role = "성과 · 커리어 정리"
    model = MODEL_COACH

    # Below this many records a career summary is mostly guesswork.
    MIN_ENTRIES = 5

    def execute(self, message: str, history=None) -> AgentResponse:
        if (blocked := self.guard()):
            return blocked
        now = today()
        period = resolve_period(message, now)
        if period:
            date_from, date_to, label = period
        else:
            date_from = (now - timedelta(days=365)).isoformat()
            date_to, label = now.isoformat(), "최근 1년"
        entries = brain_store.list_entries(date_from=date_from, date_to=date_to)
        if len(entries) < self.MIN_ENTRIES:
            return AgentResponse(
                text=(
                    f"📭 {label} ({date_from} ~ {date_to}) 기록이 {len(entries)}건뿐이라 성과 정리를 하기엔 근거가 부족합니다.\n\n"
                    f"최소 {self.MIN_ENTRIES}건 이상 쌓인 뒤 다시 요청해 주세요. 수치가 들어간 기록일수록 결과가 좋아집니다."
                ),
                metadata={"agent": self.id, "period": label},
            )
        resp = _summarize(self, COACH_PROMPT, entries, f"[정리 기간] {label} ({date_from} ~ {date_to})\n[추가 요청] {message or '없음'}")
        resp.text = f"# 🧭 성과 · 커리어 정리 ({label})\n\n{resp.text}"
        resp.metadata["period"] = label
        return resp
