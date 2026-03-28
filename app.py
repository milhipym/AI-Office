"""
AI Office - Virtual AI Office Web Service
A pixel-art themed virtual office where AI agents work as employees.
"""

from flask import Flask, render_template, jsonify, request
import json
import random
from datetime import datetime

app = Flask(__name__)

# AI Agent Employees
AI_AGENTS = {
    "claude": {
        "id": "claude",
        "name": "Claude Opus",
        "role": "CTO",
        "team": "management",
        "description": "기술 총괄 / 아키텍처 설계",
        "avatar_color": "#8B5CF6",
        "skills": ["코드 생성", "아키텍처", "기술 리뷰"],
        "status": "working",
        "position": {"x": 3, "y": 2},
    },
    "manus": {
        "id": "manus",
        "name": "Manus",
        "role": "CEO 직속",
        "team": "management",
        "description": "리서치 / 복합 태스크",
        "avatar_color": "#3B82F6",
        "skills": ["리서치", "분석", "전략"],
        "status": "meeting",
        "position": {"x": 5, "y": 2},
    },
    "sonnet": {
        "id": "sonnet",
        "name": "Claude Sonnet",
        "role": "개발자",
        "team": "build",
        "description": "코드 생성 / 퍼블리싱",
        "avatar_color": "#A78BFA",
        "skills": ["코딩", "퍼블리싱", "디버깅"],
        "status": "working",
        "position": {"x": 1, "y": 4},
    },
    "gemini": {
        "id": "gemini",
        "name": "Gemini",
        "role": "콘텐츠 매니저",
        "team": "content",
        "description": "카피라이팅 / 이미지",
        "avatar_color": "#F59E0B",
        "skills": ["카피라이팅", "이미지 생성", "콘텐츠"],
        "status": "working",
        "position": {"x": 3, "y": 5},
    },
    "chatgpt": {
        "id": "chatgpt",
        "name": "ChatGPT",
        "role": "교육팀장",
        "team": "academy",
        "description": "커리큘럼 / 교안 설계",
        "avatar_color": "#10B981",
        "skills": ["교육", "커리큘럼", "교안"],
        "status": "idle",
        "position": {"x": 7, "y": 4},
    },
    "perplexity": {
        "id": "perplexity",
        "name": "Perplexity",
        "role": "리서처",
        "team": "content",
        "description": "리서치 / 팩트체크",
        "avatar_color": "#6366F1",
        "skills": ["리서치", "팩트체크", "분석"],
        "status": "working",
        "position": {"x": 5, "y": 5},
    },
}

# Office rooms
OFFICE_ROOMS = {
    "main_office": {"name": "메인 오피스", "x": 0, "y": 0, "w": 5, "h": 4},
    "meeting_room": {"name": "회의실", "x": 5, "y": 0, "w": 4, "h": 4},
    "content_room": {"name": "콘텐츠 팀룸", "x": 0, "y": 4, "w": 4, "h": 3},
    "dev_room": {"name": "개발 팀룸", "x": 4, "y": 4, "w": 5, "h": 3},
}

# Chat messages (simulated AI conversations)
CHAT_MESSAGES = [
    {
        "agent": "claude",
        "message": "타겟 세그먼트 정의 후 MVP 테스트를 진행하겠습니다.",
        "time": "07:48",
        "type": "task",
    },
    {
        "agent": "manus",
        "message": "API 키를 발급하면 능동 AI가 쓸 수 있는 날짜 교차검증합니다.",
        "time": "07:48",
        "type": "report",
    },
    {
        "agent": "sonnet",
        "message": "웹사이트 프론트엔드 빌드 완료. PR 리뷰 요청드립니다.",
        "time": "07:52",
        "type": "task",
    },
    {
        "agent": "gemini",
        "message": "SNS 콘텐츠 3개 초안 작성 완료했습니다.",
        "time": "07:55",
        "type": "report",
    },
    {
        "agent": "perplexity",
        "message": "2025년 SNS 마케팅 트렌드 수요조사 완료되었습니다.",
        "time": "08:01",
        "type": "report",
    },
    {
        "agent": "chatgpt",
        "message": "AI 클래스 커리큘럼 v2 초안을 공유합니다.",
        "time": "08:05",
        "type": "task",
    },
    {
        "agent": "claude",
        "message": "각 팀의 의견을 교차검증하고 취합합니다...",
        "time": "08:10",
        "type": "system",
    },
    {
        "agent": "manus",
        "message": "교차검증 결과: 콘텐츠 팀, 연구 팀 공통 합의 도출 완료.",
        "time": "08:15",
        "type": "report",
    },
]

# Furniture items for office customization
FURNITURE_ITEMS = [
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
]


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/agents")
def get_agents():
    return jsonify(list(AI_AGENTS.values()))


@app.route("/api/agents/<agent_id>")
def get_agent(agent_id):
    agent = AI_AGENTS.get(agent_id)
    if agent:
        return jsonify(agent)
    return jsonify({"error": "Agent not found"}), 404


@app.route("/api/chat")
def get_chat():
    return jsonify(CHAT_MESSAGES)


@app.route("/api/chat", methods=["POST"])
def send_message():
    data = request.json
    user_message = data.get("message", "")

    # Add user command
    new_msg = {
        "agent": "user",
        "message": user_message,
        "time": datetime.now().strftime("%H:%M"),
        "type": "command",
    }
    CHAT_MESSAGES.append(new_msg)

    # Simulate AI agent responses
    responding_agent = random.choice(list(AI_AGENTS.keys()))
    responses = [
        f"네, 지시 확인했습니다. '{user_message}' 작업을 시작하겠습니다.",
        f"알겠습니다. 해당 건에 대해 팀원들과 협의 후 진행하겠습니다.",
        f"확인했습니다. 현재 진행 중인 작업 완료 후 바로 착수하겠습니다.",
        f"관련 리서치를 먼저 진행하고 결과를 공유드리겠습니다.",
        f"해당 업무를 분석 중입니다. 10분 내로 초안을 공유드리겠습니다.",
    ]

    ai_response = {
        "agent": responding_agent,
        "message": random.choice(responses),
        "time": datetime.now().strftime("%H:%M"),
        "type": "report",
    }
    CHAT_MESSAGES.append(ai_response)

    return jsonify({"user_message": new_msg, "ai_response": ai_response})


@app.route("/api/rooms")
def get_rooms():
    return jsonify(OFFICE_ROOMS)


@app.route("/api/furniture")
def get_furniture():
    return jsonify(FURNITURE_ITEMS)


@app.route("/api/org")
def get_org_chart():
    org = {
        "ceo": {
            "title": "NOOKITOKKI 대표",
            "name": "You (대표)",
            "color": "#EF4444",
        },
        "direct": [
            {
                "title": "CEO 직속 도구",
                "name": "Manus",
                "desc": "리서치 · 복합 태스크",
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
                "agents": ["Claude Sonnet", "Cursor/Claude Code"],
            },
            {
                "name": "콘텐츠 마케팅팀",
                "code": "CONTENT",
                "desc": "SNS · 블로그 · 릴스",
                "color": "#F59E0B",
                "agents": ["Gemini", "Grok"],
            },
            {
                "name": "교육팀",
                "code": "ACADEMY",
                "desc": "AI 클래스 · 버니크래프트",
                "color": "#8B5CF6",
                "agents": ["ChatGPT", "Perplexity"],
            },
            {
                "name": "운영팀",
                "code": "OPERATE",
                "desc": "자동화 · CRM · 경영",
                "color": "#EF4444",
                "agents": ["Make.com / n8n", "Notion AI"],
            },
        ],
    }
    return jsonify(org)


if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)
