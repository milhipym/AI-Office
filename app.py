"""AI Office - Virtual AI Office Web Service (v2).

A pixel-art themed virtual office where AI agents work as employees.
Each agent is backed by OpenAI API with a role-specific system prompt.
"""

import random
from datetime import datetime

from flask import Flask, render_template, jsonify, request

from agents import AGENTS
from agents.router import route, strip_mention, is_smalltalk
from config import FLASK_DEBUG, FLASK_PORT, is_openai_configured
from services import storage


# Canned smalltalk replies — avoid burning tokens on "안녕"
SMALLTALK_REPLIES = [
    "안녕하세요! 👋 오늘은 어떤 작업을 도와드릴까요?",
    "반갑습니다! 작업 지시는 `@sonnet`, `@gemini` 같은 멘션으로 시작해 주세요.",
    "안녕하세요, 대표님. AI Office 직원 6명이 대기 중입니다. 어떤 업무부터 할까요?",
    "네, 듣고 있습니다! 구체적인 지시를 내려주시면 담당 에이전트가 처리합니다.",
    "안녕하세요! 💼 코드 / 디자인 / 기획 / 리서치 / 분석 중 어느 쪽 도움이 필요하세요?",
]

SMALLTALK_AGENTS = ["manus", "chatgpt", "claude"]

app = Flask(__name__)


# ==== Agent metadata for the office view (display-only) ====

AI_AGENTS_DISPLAY = {
    "claude": {
        "id": "claude",
        "name": "Claude Opus",
        "role": "CTO",
        "team": "management",
        "description": "기술 총괄 / 아키텍처 설계",
        "avatar_color": "#8B5CF6",
        "skills": ["아키텍처", "ADR", "기술 리뷰", "Mermaid"],
        "status": "working",
        "position": {"x": 3, "y": 2},
    },
    "manus": {
        "id": "manus",
        "name": "Manus",
        "role": "PM",
        "team": "management",
        "description": "프로젝트 매니저 / 태스크 분해",
        "avatar_color": "#3B82F6",
        "skills": ["기획", "로드맵", "마일스톤", "리스크"],
        "status": "meeting",
        "position": {"x": 5, "y": 2},
    },
    "sonnet": {
        "id": "sonnet",
        "name": "Claude Sonnet",
        "role": "개발자",
        "team": "build",
        "description": "시니어 풀스택 개발자 / 코드 생성",
        "avatar_color": "#A78BFA",
        "skills": ["Python", "JavaScript", "Flask", "React"],
        "status": "working",
        "position": {"x": 1, "y": 4},
    },
    "gemini": {
        "id": "gemini",
        "name": "Gemini",
        "role": "디자이너",
        "team": "content",
        "description": "크리에이티브 디렉터 / DALL-E 3 이미지",
        "avatar_color": "#F59E0B",
        "skills": ["이미지 생성", "카피", "컬러 팔레트"],
        "status": "working",
        "position": {"x": 3, "y": 5},
    },
    "chatgpt": {
        "id": "chatgpt",
        "name": "ChatGPT",
        "role": "분석가",
        "team": "academy",
        "description": "비즈니스 분석가 / 교육 전문가",
        "avatar_color": "#10B981",
        "skills": ["분석 보고서", "커리큘럼", "구조화 문서"],
        "status": "idle",
        "position": {"x": 7, "y": 4},
    },
    "perplexity": {
        "id": "perplexity",
        "name": "Perplexity",
        "role": "리서처",
        "team": "content",
        "description": "실시간 웹 검색 + 인용",
        "avatar_color": "#6366F1",
        "skills": ["웹 검색", "팩트체크", "인용"],
        "status": "working",
        "position": {"x": 5, "y": 5},
    },
}


# ==== Routes ====

@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/agents")
def get_agents():
    return jsonify(list(AI_AGENTS_DISPLAY.values()))


@app.route("/api/agents/<agent_id>")
def get_agent(agent_id):
    agent = AI_AGENTS_DISPLAY.get(agent_id)
    if agent:
        return jsonify(agent)
    return jsonify({"error": "Agent not found"}), 404


@app.route("/api/chat")
def get_chat():
    return jsonify(storage.load_history())


@app.route("/api/chat", methods=["POST"])
def send_message():
    data = request.json or {}
    user_message = (data.get("message") or "").strip()
    channel = data.get("channel")

    if not user_message:
        return jsonify({"error": "Empty message"}), 400

    now = datetime.now().strftime("%H:%M")

    # Persist user message
    user_msg_record = {
        "agent": "user",
        "message": user_message,
        "time": now,
        "type": "command",
    }
    storage.append_message(user_msg_record)

    # Smalltalk bypass — no LLM call for pure greetings
    if is_smalltalk(user_message):
        agent_id = random.choice(SMALLTALK_AGENTS)
        ai_msg_record = {
            "agent": agent_id,
            "message": random.choice(SMALLTALK_REPLIES),
            "time": datetime.now().strftime("%H:%M"),
            "type": "report",
            "code_blocks": [],
            "images": [],
            "citations": [],
            "metadata": {"bypass": "smalltalk", "agent": agent_id},
        }
        storage.append_message(ai_msg_record)
        return jsonify({
            "user_message": user_msg_record,
            "ai_response": ai_msg_record,
        })

    # Route to the appropriate agent
    agent = route(user_message, channel=channel)
    cleaned_message = strip_mention(user_message)

    # Load recent history for context (excluding the message we just added)
    history = storage.load_history()[:-1]

    # Execute the agent
    response = agent.execute(cleaned_message, history=history)

    # Build the AI message record
    response_type = {
        "code": "code",
        "image": "image",
        "citation": "report",
        "markdown": "report",
        "plain": "report",
    }.get(response.format, "report")

    ai_msg_record = {
        "agent": agent.id,
        "message": response.text,
        "time": datetime.now().strftime("%H:%M"),
        "type": response_type,
        "code_blocks": [cb.__dict__ for cb in response.code_blocks],
        "images": [img.__dict__ for img in response.images],
        "citations": [c.__dict__ for c in response.citations],
        "metadata": response.metadata,
    }
    storage.append_message(ai_msg_record)

    return jsonify({
        "user_message": user_msg_record,
        "ai_response": ai_msg_record,
    })


@app.route("/api/chat/clear", methods=["POST"])
def clear_chat():
    storage.clear_history()
    return jsonify({"status": "cleared"})


@app.route("/api/rooms")
def get_rooms():
    return jsonify({
        "main_office": {"name": "메인 오피스", "x": 0, "y": 0, "w": 5, "h": 4},
        "meeting_room": {"name": "회의실", "x": 5, "y": 0, "w": 4, "h": 4},
        "content_room": {"name": "콘텐츠 팀룸", "x": 0, "y": 4, "w": 4, "h": 3},
        "dev_room": {"name": "개발 팀룸", "x": 4, "y": 4, "w": 5, "h": 3},
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
    return jsonify({
        "ceo": {
            "title": "NOOKITOKKI 대표",
            "name": "You (대표)",
            "color": "#EF4444",
        },
        "direct": [
            {
                "title": "PM",
                "name": "Manus",
                "desc": "프로젝트 매니저 · 태스크 분해",
                "color": "#3B82F6",
            },
            {
                "title": "CTO",
                "name": "Claude Opus",
                "desc": "기술 총괄 · 아키텍처 설계",
                "color": "#8B5CF6",
            },
        ],
        "teams": [
            {
                "name": "웹 프로덕션팀",
                "code": "BUILD · CONNECT",
                "desc": "웹사이트 기획/제작/연동",
                "color": "#3B82F6",
                "agents": ["Claude Sonnet (GPT-4o)"],
            },
            {
                "name": "콘텐츠 마케팅팀",
                "code": "CONTENT",
                "desc": "SNS · 블로그 · 이미지",
                "color": "#F59E0B",
                "agents": ["Gemini (GPT-4o + DALL-E 3)"],
            },
            {
                "name": "리서치팀",
                "code": "RESEARCH",
                "desc": "실시간 검색 · 팩트체크",
                "color": "#6366F1",
                "agents": ["Perplexity (GPT-4o + web_search)"],
            },
            {
                "name": "분석/교육팀",
                "code": "ACADEMY",
                "desc": "보고서 · 커리큘럼 · 분석",
                "color": "#10B981",
                "agents": ["ChatGPT (GPT-4o)"],
            },
        ],
    })


@app.route("/api/status")
def get_status():
    """Surface whether the OpenAI API is configured so the UI can warn users."""
    return jsonify({
        "openai_configured": is_openai_configured(),
        "agents": list(AI_AGENTS_DISPLAY.keys()),
    })


if __name__ == "__main__":
    if not is_openai_configured():
        print("=" * 60)
        print("⚠️  OPENAI_API_KEY is not set.")
        print("   Copy .env.example to .env and add your key.")
        print("   The app will still run, but agents will return placeholders.")
        print("=" * 60)
    app.run(debug=FLASK_DEBUG, host="0.0.0.0", port=FLASK_PORT)
