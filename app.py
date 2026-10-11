"""AI Office - personal second-brain office.

A pixel-art office whose staff are OpenAI-backed agents: a dispatcher routes
each message to the record, minutes, search, weekly-report or career staff.
Teams, rooms and staff are defined in agents/roster.py.
"""

import random
from datetime import datetime

from flask import Flask, jsonify, render_template, request

import config
from agents import roster
from agents.router import dispatch, is_smalltalk
from config import FLASK_DEBUG, FLASK_HOST, FLASK_PORT, is_openai_configured
from services import brain_store, storage

# Canned smalltalk replies — avoid burning tokens on "안녕"
SMALLTALK_REPLIES = [
    "안녕하세요! 👋 오늘 한 일은 `/기록`, 회의 메모는 `/회의`로 남겨 주세요.",
    "반갑습니다! 지난 기록이 궁금하면 `/찾기`, 주간 보고는 `/주간`입니다.",
    "네, 듣고 있습니다. 명령 없이 보내셔도 접수 매니저가 담당자에게 배정합니다.",
    "안녕하세요, 대표님. 기록팀과 자료·보고팀이 대기 중입니다.",
]

app = Flask(__name__)


def staff_display(staff: dict) -> dict:
    """Roster entry plus the runtime status the office view animates."""
    return {
        key: staff[key]
        for key in ("id", "name", "short_name", "team", "role", "description",
                    "avatar_color", "skills", "position", "model", "commands")
    } | {"status": "idle", "example": staff.get("example", "")}


# ==== Routes ====

@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/agents")
def get_agents():
    return jsonify([staff_display(s) for s in roster.STAFF])


@app.route("/api/agents/<agent_id>")
def get_agent(agent_id):
    staff = roster.STAFF_BY_ID.get(agent_id)
    if staff:
        return jsonify(staff_display(staff))
    return jsonify({"error": "Agent not found"}), 404


@app.route("/api/office")
def get_office():
    return jsonify({
        "grid": roster.GRID,
        "rooms": roster.ROOMS,
        "furniture": roster.FURNITURE,
        "teams": roster.TEAMS,
    })


@app.route("/api/chat")
def get_chat():
    return jsonify(storage.load_history())


@app.route("/api/chat", methods=["POST"])
def send_message():
    data = request.json or {}
    user_message = (data.get("message") or "").strip()

    if not user_message:
        return jsonify({"error": "Empty message"}), 400

    user_msg_record = {
        "agent": "user",
        "message": user_message,
        "time": datetime.now().strftime("%H:%M"),
        "type": "command",
    }
    storage.append_message(user_msg_record)

    # Smalltalk bypass — no LLM call for pure greetings
    if is_smalltalk(user_message):
        ai_msg_record = {
            "agent": "dispatcher",
            "message": random.choice(SMALLTALK_REPLIES),
            "time": datetime.now().strftime("%H:%M"),
            "type": "report",
            "code_blocks": [],
            "images": [],
            "citations": [],
            "metadata": {"bypass": "smalltalk", "agent": "dispatcher"},
        }
        storage.append_message(ai_msg_record)
        return jsonify({"user_message": user_msg_record, "ai_response": ai_msg_record})

    agent, cleaned_message, routed_by = dispatch(user_message)

    # Recent history for context (excluding the message we just added)
    history = storage.load_history()[:-1]
    response = agent.execute(cleaned_message, history=history)

    ai_msg_record = {
        "agent": agent.id,
        "message": response.text,
        "time": datetime.now().strftime("%H:%M"),
        "type": "code" if response.format == "code" else "report",
        "code_blocks": [cb.__dict__ for cb in response.code_blocks],
        "images": [img.__dict__ for img in response.images],
        "citations": [c.__dict__ for c in response.citations],
        "metadata": {**response.metadata, "routed_by": routed_by},
    }
    storage.append_message(ai_msg_record)

    return jsonify({"user_message": user_msg_record, "ai_response": ai_msg_record})


@app.route("/api/chat/clear", methods=["POST"])
def clear_chat():
    storage.clear_history()
    return jsonify({"status": "cleared"})


# ==== Second brain records ====

@app.route("/api/entries")
def get_entries():
    entries = brain_store.list_entries(
        date_from=request.args.get("from") or None,
        date_to=request.args.get("to") or None,
        category=request.args.get("category") or None,
        kind=request.args.get("kind") or None,
        limit=min(request.args.get("limit", 500, type=int) or 500, 2000),
    )
    return jsonify(entries)


@app.route("/api/entries/<int:entry_id>", methods=["DELETE"])
def delete_entry(entry_id):
    if brain_store.delete_entry(entry_id):
        return jsonify({"status": "deleted", "id": entry_id})
    return jsonify({"error": "Entry not found"}), 404


@app.route("/api/brain/meta")
def get_brain_meta():
    return jsonify({
        "categories": config.BRAIN_CATEGORIES,
        "models": {
            "classifier": config.MODEL_CLASSIFIER,
            "archivist": config.MODEL_ARCHIVIST,
            "minutes": config.MODEL_MINUTES,
            "finder": config.MODEL_FINDER,
            "reporter": config.MODEL_REPORTER,
            "coach": config.MODEL_COACH,
            "embedding": config.EMBEDDING_MODEL,
        },
    })


@app.route("/api/furniture")
def get_furniture():
    return jsonify([
        {"id": "desk", "name": "책상", "category": "책상", "icon": "desk"},
        {"id": "chair", "name": "의자", "category": "의자", "icon": "chair"},
        {"id": "plant", "name": "화분", "category": "소품", "icon": "plant"},
        {"id": "cactus", "name": "선인장", "category": "소품", "icon": "cactus"},
        {"id": "coffee", "name": "커피머신", "category": "전자기기", "icon": "coffee"},
        {"id": "bookshelf", "name": "책장", "category": "책상", "icon": "bookshelf"},
        {"id": "sofa", "name": "소파", "category": "의자", "icon": "sofa"},
        {"id": "monitor", "name": "모니터", "category": "전자기기", "icon": "monitor"},
        {"id": "bin", "name": "휴지통", "category": "소품", "icon": "bin"},
        {"id": "lamp", "name": "스탠드", "category": "소품", "icon": "lamp"},
        {"id": "whiteboard", "name": "화이트보드", "category": "전자기기", "icon": "whiteboard"},
        {"id": "rug", "name": "러그", "category": "벽 장식", "icon": "rug"},
    ])


@app.route("/api/org")
def get_org_chart():
    return jsonify(roster.org_chart())


@app.route("/api/status")
def get_status():
    """Surface whether the OpenAI API is configured so the UI can warn users."""
    return jsonify({
        "openai_configured": is_openai_configured(),
        "agents": [s["id"] for s in roster.STAFF],
    })


if __name__ == "__main__":
    if not is_openai_configured():
        print("=" * 60)
        print("⚠️  OPENAI_API_KEY is not set.")
        print("   Copy .env.example to .env and add your key.")
        print("   The app will still run, but agents will return placeholders.")
        print("=" * 60)
    app.run(debug=FLASK_DEBUG, host=FLASK_HOST, port=FLASK_PORT)
