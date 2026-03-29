"""
AI Office - Virtual AI Office Web Service
A pixel-art RPG themed virtual office where AI agents work as employees.
All AI responses powered by OpenAI API.
Includes task tracking with background report generation.
"""

from flask import Flask, render_template, jsonify, request
import json
import os
import random
import threading
import uuid
from datetime import datetime
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)

# ============================================================
# OpenAI API KEY 설정
# .env 파일에 OPENAI_API_KEY=sk-xxxx 형태로 넣어주세요
# ============================================================
client = None


def get_openai_client():
    global client
    if client is None:
        api_key = os.getenv("OPENAI_API_KEY", "")
        if api_key:
            client = OpenAI(api_key=api_key)
    return client


# Level definitions: 1=대표, 2=임원, 3=팀장, 4=팀원
LEVEL_NAMES = {1: "대표", 2: "임원", 3: "팀장", 4: "팀원"}

# AI Agent Employees
AI_AGENTS = {
    "ceo_agent": {
        "id": "ceo_agent",
        "name": "전략이",
        "role": "CEO 직속",
        "team": "management",
        "level": 2,
        "supervisor": None,  # reports to 대표 (user)
        "description": "리서치 / 복합 태스크 / 전략 수립",
        "avatar_color": "#3B82F6",
        "skills": ["리서치", "분석", "전략"],
        "keywords": ["전략", "사업", "시장", "경쟁", "비즈니스", "매출", "투자"],
        "status": "idle",
        "position": {"x": 11, "y": 2},
        "personality": "당신은 AI 오피스의 CEO 직속 전략 담당입니다. 사업 전략과 시장 분석에 능하며, 빅 픽처를 보는 관점에서 답변하세요.",
        "direction": "left",
    },
    "cto_agent": {
        "id": "cto_agent",
        "name": "기술이",
        "role": "CTO",
        "team": "management",
        "level": 2,
        "supervisor": None,  # reports to 대표 (user)
        "description": "기술 총괄 / 아키텍처 설계 / 코드 리뷰",
        "avatar_color": "#8B5CF6",
        "skills": ["코드 생성", "아키텍처", "기술 리뷰"],
        "keywords": ["코드", "기술", "아키텍처", "서버", "API", "백엔드", "프론트", "인프라"],
        "status": "idle",
        "position": {"x": 10, "y": 1},
        "personality": "당신은 AI 오피스의 CTO입니다. 기술적인 관점에서 답변하며, 아키텍처와 코드 품질을 중시합니다. 항상 전문적이고 분석적으로 답변하세요.",
        "direction": "down",
    },
    "dev_agent": {
        "id": "dev_agent",
        "name": "코딩이",
        "role": "프론트엔드 개발자",
        "team": "build",
        "level": 4,
        "supervisor": "cto_agent",
        "description": "UI/UX 개발 / 퍼블리싱 / 프론트엔드 구현",
        "avatar_color": "#A78BFA",
        "skills": ["React", "CSS", "퍼블리싱", "UI/UX"],
        "keywords": ["프론트", "UI", "퍼블리싱", "CSS", "화면", "디자인구현", "웹페이지"],
        "status": "idle",
        "position": {"x": 2, "y": 5},
        "personality": "당신은 AI 오피스의 프론트엔드 개발자입니다. UI/UX 구현과 웹 퍼블리싱에 능하며, 사용자 경험을 최우선으로 생각합니다.",
        "direction": "down",
    },
    "backend_dev": {
        "id": "backend_dev",
        "name": "서버이",
        "role": "백엔드 개발자",
        "team": "build",
        "level": 4,
        "supervisor": "cto_agent",
        "description": "서버 개발 / API 설계 / DB 관리 / 배포",
        "avatar_color": "#06B6D4",
        "skills": ["Python", "Node.js", "DB설계", "API", "배포"],
        "keywords": ["백엔드", "서버", "DB", "데이터베이스", "배포", "API설계", "구현", "빌드"],
        "status": "idle",
        "position": {"x": 3, "y": 6},
        "personality": "당신은 AI 오피스의 백엔드 개발자입니다. 서버 아키텍처, API 설계, 데이터베이스 최적화에 전문가이며, 안정적이고 확장 가능한 시스템을 추구합니다.",
        "direction": "left",
    },
    "content_agent": {
        "id": "content_agent",
        "name": "콘텐츠",
        "role": "콘텐츠 매니저",
        "team": "content",
        "level": 3,
        "supervisor": "ceo_agent",
        "description": "카피라이팅 / 이미지 기획 / SNS 콘텐츠",
        "avatar_color": "#F59E0B",
        "skills": ["카피라이팅", "이미지 생성", "콘텐츠"],
        "keywords": ["콘텐츠", "SNS", "마케팅", "카피", "블로그", "인스타", "릴스"],
        "status": "idle",
        "position": {"x": 6, "y": 5},
        "personality": "당신은 AI 오피스의 콘텐츠 매니저입니다. 마케팅과 크리에이티브한 관점에서 답변하며, 트렌디하고 감각적인 표현을 사용하세요.",
        "direction": "right",
    },
    "edu_agent": {
        "id": "edu_agent",
        "name": "교육이",
        "role": "교육팀장",
        "team": "academy",
        "level": 3,
        "supervisor": "ceo_agent",
        "description": "커리큘럼 / 교안 설계 / 학습 컨텐츠",
        "avatar_color": "#10B981",
        "skills": ["교육", "커리큘럼", "교안"],
        "keywords": ["교육", "커리큘럼", "수업", "학습", "강의", "교안"],
        "status": "idle",
        "position": {"x": 10, "y": 5},
        "personality": "당신은 AI 오피스의 교육팀장입니다. 교육과 학습 설계에 전문가이며, 쉽고 친절하게 설명하는 것이 특기입니다.",
        "direction": "left",
    },
    "research_agent": {
        "id": "research_agent",
        "name": "리서치",
        "role": "리서처",
        "team": "content",
        "level": 4,
        "supervisor": "content_agent",
        "description": "리서치 / 팩트체크 / 데이터 분석",
        "avatar_color": "#6366F1",
        "skills": ["리서치", "팩트체크", "분석"],
        "keywords": ["리서치", "조사", "분석", "데이터", "트렌드", "시장조사"],
        "status": "idle",
        "position": {"x": 7, "y": 6},
        "personality": "당신은 AI 오피스의 리서처입니다. 데이터와 팩트에 기반한 정확한 답변을 제공하며, 출처와 근거를 중시합니다.",
        "direction": "up",
    },
}

# Office rooms
OFFICE_ROOMS = {
    "main_office": {"name": "메인 오피스", "x": 0, "y": 0, "w": 5, "h": 4},
    "meeting_room": {"name": "회의실", "x": 5, "y": 0, "w": 4, "h": 4},
    "content_room": {"name": "콘텐츠 팀룸", "x": 0, "y": 4, "w": 4, "h": 3},
    "dev_room": {"name": "개발 팀룸", "x": 4, "y": 4, "w": 5, "h": 3},
}

# Chat messages - each has a unique msg_id for polling
msg_counter = 0


def next_msg_id():
    global msg_counter
    msg_counter += 1
    return msg_counter


CHAT_MESSAGES = []

# Pre-populate initial messages
_initial_msgs = [
    {"agent": "cto_agent", "message": "타겟 세그먼트 정의 후 MVP 테스트를 진행하겠습니다.", "time": "07:48", "type": "task"},
    {"agent": "ceo_agent", "message": "시장 분석 리포트 작성 완료. 리뷰 부탁드립니다.", "time": "07:48", "type": "report"},
    {"agent": "dev_agent", "message": "웹사이트 프론트엔드 빌드 완료. PR 리뷰 요청드립니다.", "time": "07:52", "type": "task"},
    {"agent": "content_agent", "message": "SNS 콘텐츠 3개 초안 작성 완료했습니다.", "time": "07:55", "type": "report"},
    {"agent": "research_agent", "message": "2025년 SNS 마케팅 트렌드 리서치 완료되었습니다.", "time": "08:01", "type": "report"},
    {"agent": "edu_agent", "message": "AI 클래스 커리큘럼 v2 초안을 공유합니다.", "time": "08:05", "type": "task"},
]
for m in _initial_msgs:
    m["msg_id"] = next_msg_id()
    CHAT_MESSAGES.append(m)

# ============================================================
# TASK SYSTEM - 다중 단계 업무 처리
# 지시 → 1단계(분석) → 2단계(작업) → 3단계(최종보고) 순차 진행
# ============================================================
TASKS = {}  # task_id -> task dict

# Stage definitions for each step
STAGE_DEFS = [
    {
        "name": "분석 및 기획",
        "icon": "🔍",
        "prompt_suffix": (
            "이것은 업무의 **1단계: 분석 및 기획** 단계입니다.\n"
            "다음 내용을 작성하세요:\n"
            "1. 현황 분석 (현재 상태, 문제점, 기회 요인)\n"
            "2. 핵심 목표 정의\n"
            "3. 접근 전략 수립\n\n"
            "한국어로 구체적이고 전문적으로 작성하세요. 5-8문장으로 요약하세요."
        ),
    },
    {
        "name": "초안 작성 및 실행",
        "icon": "⚙️",
        "prompt_suffix": (
            "이것은 업무의 **2단계: 초안 작성 및 실행** 단계입니다.\n"
            "1단계 분석 결과를 바탕으로:\n"
            "1. 구체적인 실행 계획 (세부 항목별)\n"
            "2. 초안/시안/프로토타입 내용\n"
            "3. 예상 리스크와 대응 방안\n\n"
            "한국어로 실무적이고 실행 가능한 내용으로 작성하세요. 8-12문장으로 작성하세요."
        ),
    },
    {
        "name": "최종 보고서",
        "icon": "📋",
        "prompt_suffix": (
            "이것은 업무의 **3단계: 최종 보고서** 단계입니다.\n"
            "1단계 분석과 2단계 초안을 종합하여 최종 보고서를 작성하세요:\n\n"
            "📋 **최종 보고서**\n"
            "━━━━━━━━━━━━━━━━━━\n"
            "■ 업무 요약: (한 줄)\n"
            "■ 핵심 분석 결과: (3-5개 항목)\n"
            "■ 최종 실행 계획: (구체적 액션 아이템 3-5개)\n"
            "■ 예상 성과 지표: (KPI 2-3개)\n"
            "■ 일정표: (단계별 타임라인)\n"
            "■ 요청 사항: (의사결정 필요 항목)\n\n"
            "한국어로 경영진에게 보고하는 수준으로 작성하세요."
        ),
    },
]

# Stage intervals (seconds between stages) - adjust for demo vs real
STAGE_INTERVALS = [3, 8, 12]  # start after 3s, 8s, 12s from task creation


def create_task(task_title, agent_id, user_message):
    """Create a new multi-stage task."""
    task_id = str(uuid.uuid4())[:8]

    stages = []
    for i, sdef in enumerate(STAGE_DEFS):
        stages.append({
            "stage_num": i + 1,
            "name": sdef["name"],
            "icon": sdef["icon"],
            "status": "대기",  # 대기, 진행중, 완료
            "result": None,
            "completed_at": None,
        })

    task = {
        "id": task_id,
        "title": task_title,
        "agent_id": agent_id,
        "agent_name": AI_AGENTS[agent_id]["name"],
        "agent_color": AI_AGENTS[agent_id]["avatar_color"],
        "status": "진행중",
        "current_stage": 0,  # index into stages
        "total_stages": len(stages),
        "stages": stages,
        "created_at": datetime.now().strftime("%H:%M"),
        "completed_at": None,
        "user_message": user_message,
    }
    TASKS[task_id] = task

    # Start multi-stage background processing
    thread = threading.Thread(
        target=process_stages_background,
        args=(task_id, agent_id, user_message),
        daemon=True,
    )
    thread.start()

    return task


def process_stages_background(task_id, agent_id, user_message):
    """Process all stages sequentially with delays."""
    import time

    agent = AI_AGENTS[agent_id]
    # Create a fresh OpenAI client for this thread (avoid reloader issues)
    api_key = os.getenv("OPENAI_API_KEY", "")
    openai_client = OpenAI(api_key=api_key) if api_key else None
    prev_results = []

    for i, stage_def in enumerate(STAGE_DEFS):
        # Wait before starting this stage
        time.sleep(STAGE_INTERVALS[i])

        task = TASKS.get(task_id)
        if not task:
            return

        # Mark stage as in-progress
        task["current_stage"] = i
        task["stages"][i]["status"] = "진행중"

        # Post progress message to chat
        progress_msg = {
            "msg_id": next_msg_id(),
            "agent": agent_id,
            "message": f"{stage_def['icon']} [{i+1}/{len(STAGE_DEFS)}단계] {stage_def['name']} 시작합니다...",
            "time": datetime.now().strftime("%H:%M"),
            "type": "progress",
            "task_id": task_id,
            "stage_num": i + 1,
        }
        CHAT_MESSAGES.append(progress_msg)

        # Generate stage result via OpenAI
        result_text = generate_stage_result(
            agent, openai_client, user_message, stage_def, i, prev_results
        )

        # Update stage
        task["stages"][i]["status"] = "완료"
        task["stages"][i]["result"] = result_text
        task["stages"][i]["completed_at"] = datetime.now().strftime("%H:%M")
        prev_results.append(result_text)

        # Post stage result to chat
        is_final = i == len(STAGE_DEFS) - 1
        result_msg = {
            "msg_id": next_msg_id(),
            "agent": agent_id,
            "message": f"{stage_def['icon']} **[{i+1}단계 완료: {stage_def['name']}]**\n\n{result_text}",
            "time": datetime.now().strftime("%H:%M"),
            "type": "result" if is_final else "stage_update",
            "task_id": task_id,
            "stage_num": i + 1,
        }
        CHAT_MESSAGES.append(result_msg)

    # All stages done - now supervisor review if applicable
    task = TASKS.get(task_id)
    agent = AI_AGENTS.get(agent_id)
    if task and agent:
        supervisor_id = agent.get("supervisor")
        supervisor = AI_AGENTS.get(supervisor_id) if supervisor_id else None

        if supervisor:
            # Supervisor reviews the final report
            time.sleep(5)
            review_text = generate_supervisor_review(
                supervisor, openai_client, user_message, prev_results
            )

            # Add review stage to task
            review_stage = {
                "stage_num": len(STAGE_DEFS) + 1,
                "name": f"{supervisor['name']}({supervisor['role']}) 검토",
                "icon": "👔",
                "status": "완료",
                "result": review_text,
                "completed_at": datetime.now().strftime("%H:%M"),
            }
            task["stages"].append(review_stage)
            task["total_stages"] = len(task["stages"])

            # Post review to chat
            review_msg = {
                "msg_id": next_msg_id(),
                "agent": supervisor_id,
                "message": f"👔 **[상위 검토: {supervisor['name']}({supervisor['role']})]**\n\n{review_text}",
                "time": datetime.now().strftime("%H:%M"),
                "type": "review",
                "task_id": task_id,
            }
            CHAT_MESSAGES.append(review_msg)

        task["status"] = "완료"
        task["completed_at"] = datetime.now().strftime("%H:%M")
        task["current_stage"] = len(task["stages"])


def generate_supervisor_review(supervisor, openai_client, user_message, stage_results):
    """Supervisor reviews the work done by their report."""
    if openai_client:
        try:
            all_results = "\n\n".join([f"[{i+1}단계 결과]\n{r}" for i, r in enumerate(stage_results)])
            system_prompt = (
                f"당신의 이름은 '{supervisor['name']}'이고, 역할은 '{supervisor['role']}'(레벨: {LEVEL_NAMES.get(supervisor.get('level',2))})입니다.\n"
                f"{supervisor['personality']}\n\n"
                f"부하 직원이 작성한 보고서를 검토하세요. 상위 관리자로서:\n"
                f"1. 보고서의 완성도 평가 (A/B/C/D)\n"
                f"2. 잘된 점 2가지\n"
                f"3. 보완이 필요한 점 2가지\n"
                f"4. 최종 승인 여부 (승인/수정요청)\n"
                f"5. 추가 지시사항\n\n"
                f"한국어로 간결하고 건설적으로 작성하세요."
            )
            response = openai_client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": f"업무: {user_message}\n\n{all_results}"},
                ],
                max_tokens=500,
                temperature=0.7,
            )
            return response.choices[0].message.content.strip()
        except Exception as e:
            print(f"Supervisor review error: {e}")

    return f"✅ 검토 완료. 보고서 품질 양호합니다. 승인합니다."


def generate_stage_result(agent, openai_client, user_message, stage_def, stage_idx, prev_results):
    """Generate a single stage's result."""
    if openai_client:
        try:
            context = ""
            if prev_results:
                context = "\n\n--- 이전 단계 결과 ---\n"
                for j, pr in enumerate(prev_results):
                    context += f"\n[{j+1}단계 결과]\n{pr}\n"

            system_prompt = (
                f"당신의 이름은 '{agent['name']}'이고, 역할은 '{agent['role']}'입니다.\n"
                f"{agent['personality']}\n\n"
                f"{stage_def['prompt_suffix']}"
            )

            user_content = f"업무 지시: {user_message}{context}"

            response = openai_client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_content},
                ],
                max_tokens=800,
                temperature=0.7,
            )
            return response.choices[0].message.content.strip()
        except Exception as e:
            print(f"OpenAI stage {stage_idx+1} error: {e}")

    # Fallback
    fallbacks = [
        f"현황 분석 완료. 주요 이슈 3건 식별, 경쟁사 대비 차별화 포인트 2건 도출.",
        f"실행 계획 초안 작성 완료.\n1) 세부 기획안 수립\n2) 프로토타입 제작\n3) 내부 리뷰 진행",
        f"📋 최종 보고서\n■ 분석 결과 종합 완료\n■ 실행 계획 3단계 수립\n■ 예상 KPI: 전환율 15% 향상\n■ 일정: 총 5일 소요",
    ]
    return fallbacks[min(stage_idx, len(fallbacks) - 1)]


# Furniture items
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
    {"id": "clock", "name": "벽시계", "category": "벽 장식", "icon": "clock"},
    {"id": "picture", "name": "액자", "category": "벽 장식", "icon": "picture"},
]


# ============================================================
# ROUTES
# ============================================================

@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/agents")
def get_agents():
    agents = []
    for a in AI_AGENTS.values():
        agent_copy = {k: v for k, v in a.items() if k != "personality"}
        agents.append(agent_copy)
    return jsonify(agents)


@app.route("/api/agents/<agent_id>")
def get_agent(agent_id):
    agent = AI_AGENTS.get(agent_id)
    if agent:
        # Include personality for editing
        include_persona = request.args.get("edit", "false") == "true"
        if include_persona:
            return jsonify(agent)
        agent_copy = {k: v for k, v in agent.items() if k != "personality"}
        return jsonify(agent_copy)
    return jsonify({"error": "Agent not found"}), 404


@app.route("/api/agents", methods=["POST"])
def create_agent():
    """Add a new agent."""
    data = request.json
    agent_id = data.get("id") or f"agent_{uuid.uuid4().hex[:6]}"

    # Find available position
    used_positions = {(a["position"]["x"], a["position"]["y"]) for a in AI_AGENTS.values()}
    pos = {"x": 1, "y": 1}
    for row in range(1, ROWS_COUNT):
        for col in range(1, COLS_COUNT):
            if (col, row) not in used_positions:
                layout_type = OFFICE_LAYOUT_TYPES.get(f"{col},{row}", "wall")
                if layout_type != "wall":
                    pos = {"x": col, "y": row}
                    break
        else:
            continue
        break

    agent = {
        "id": agent_id,
        "name": data.get("name", "새 직원"),
        "role": data.get("role", "팀원"),
        "team": data.get("team", "management"),
        "level": data.get("level", 4),
        "supervisor": data.get("supervisor"),
        "description": data.get("description", ""),
        "avatar_color": data.get("avatar_color", "#888888"),
        "skills": data.get("skills", []),
        "keywords": data.get("keywords", []),
        "status": "idle",
        "position": pos,
        "personality": data.get("personality", f"당신은 AI 오피스의 {data.get('role', '팀원')}입니다. 맡은 역할에 맞게 전문적으로 답변하세요."),
        "direction": "down",
    }
    AI_AGENTS[agent_id] = agent
    return jsonify(agent), 201


@app.route("/api/agents/<agent_id>", methods=["PUT"])
def update_agent(agent_id):
    """Update an existing agent."""
    agent = AI_AGENTS.get(agent_id)
    if not agent:
        return jsonify({"error": "Agent not found"}), 404

    data = request.json
    updatable = ["name", "role", "team", "level", "supervisor", "description",
                 "avatar_color", "skills", "keywords", "personality", "position"]
    for key in updatable:
        if key in data:
            agent[key] = data[key]

    return jsonify(agent)


@app.route("/api/agents/<agent_id>", methods=["DELETE"])
def delete_agent(agent_id):
    """Delete an agent."""
    if agent_id not in AI_AGENTS:
        return jsonify({"error": "Agent not found"}), 404
    del AI_AGENTS[agent_id]
    # Remove supervisor references
    for a in AI_AGENTS.values():
        if a.get("supervisor") == agent_id:
            a["supervisor"] = None
    return jsonify({"success": True})


# ============================================================
# LAYOUT + PLACED FURNITURE — mutable runtime state
# Loaded by frontend on startup, saved when user clicks 저장
# ============================================================
_DEFAULT_PLACED = {
    '1,1': 'desk',  '2,1': 'monitor',    '3,1': 'bookshelf', '4,1': 'plant',
    '1,2': 'chair', '2,2': 'desk',       '3,2': 'monitor',
    '1,3': 'plant', '2,3': 'chair',      '3,3': 'desk',      '4,3': 'monitor',
    '6,1': 'whiteboard', '8,1': 'plant',
    '6,2': 'sofa',       '7,2': 'sofa',
    '7,3': 'chair',      '8,3': 'chair',
    '10,1': 'desk',  '11,1': 'monitor',  '12,1': 'plant',
    '10,2': 'chair', '11,2': 'bookshelf','12,2': 'lamp',
    '10,3': 'sofa',  '12,3': 'plant',
    '1,5': 'desk',  '2,5': 'monitor',    '3,5': 'desk',  '4,5': 'monitor',
    '1,6': 'chair', '3,6': 'chair',      '4,6': 'plant',
    '1,7': 'desk',  '2,7': 'monitor',    '3,7': 'desk',  '4,7': 'monitor',
    '1,8': 'chair', '2,8': 'plant',      '3,8': 'chair', '4,8': 'coffee',
    '6,5': 'desk',  '7,5': 'monitor',    '8,5': 'plant',
    '6,6': 'chair', '7,6': 'desk',       '8,6': 'monitor',
    '6,7': 'chair', '7,7': 'plant',
    '6,8': 'desk',  '7,8': 'monitor',    '8,8': 'chair',
    '10,5': 'desk',  '11,5': 'monitor',  '12,5': 'plant',
    '10,6': 'chair', '11,6': 'bookshelf','12,6': 'lamp',
    '10,7': 'desk',  '11,7': 'monitor',
    '10,8': 'chair', '11,8': 'plant',    '12,8': 'coffee',
}
PLACED_FURNITURE = dict(_DEFAULT_PLACED)

_DEFAULT_LAYOUT = [
    ['wall','wall','wall','wall','wall','wall','wall','wall','wall','wall','wall','wall','wall','wall'],
    ['wall','main','main','main','main','wall','meet','meet','meet','wall','exec','exec','exec','wall'],
    ['wall','main','main','main','main','wall','meet','meet','meet','wall','exec','exec','exec','wall'],
    ['wall','main','main','main','main','hall','meet','meet','meet','hall','exec','exec','exec','wall'],
    ['wall','wall','hall','wall','wall','hall','wall','hall','wall','hall','wall','hall','wall','wall'],
    ['wall','dev' ,'dev' ,'dev' ,'dev' ,'hall','cont','cont','cont','hall','acad','acad','acad','wall'],
    ['wall','dev' ,'dev' ,'dev' ,'dev' ,'hall','cont','cont','cont','hall','acad','acad','acad','wall'],
    ['wall','dev' ,'dev' ,'dev' ,'dev' ,'hall','cont','cont','cont','hall','acad','acad','acad','wall'],
    ['wall','dev' ,'dev' ,'dev' ,'dev' ,'hall','cont','cont','cont','hall','acad','acad','acad','wall'],
    ['wall','wall','wall','wall','wall','wall','wall','wall','wall','wall','wall','wall','wall','wall'],
]
CURRENT_LAYOUT = [list(row) for row in _DEFAULT_LAYOUT]

# Layout helpers for position finding (must match JS OFFICE_LAYOUT)
ROWS_COUNT = 10
COLS_COUNT = 14
_LAYOUT = [
    ['wall','wall','wall','wall','wall','wall','wall','wall','wall','wall','wall','wall','wall','wall'],
    ['wall','main','main','main','main','wall','meet','meet','meet','wall','exec','exec','exec','wall'],
    ['wall','main','main','main','main','wall','meet','meet','meet','wall','exec','exec','exec','wall'],
    ['wall','main','main','main','main','hall','meet','meet','meet','hall','exec','exec','exec','wall'],
    ['wall','wall','hall','wall','wall','hall','wall','hall','wall','hall','wall','hall','wall','wall'],
    ['wall','dev' ,'dev' ,'dev' ,'dev' ,'hall','cont','cont','cont','hall','acad','acad','acad','wall'],
    ['wall','dev' ,'dev' ,'dev' ,'dev' ,'hall','cont','cont','cont','hall','acad','acad','acad','wall'],
    ['wall','dev' ,'dev' ,'dev' ,'dev' ,'hall','cont','cont','cont','hall','acad','acad','acad','wall'],
    ['wall','dev' ,'dev' ,'dev' ,'dev' ,'hall','cont','cont','cont','hall','acad','acad','acad','wall'],
    ['wall','wall','wall','wall','wall','wall','wall','wall','wall','wall','wall','wall','wall','wall'],
]
OFFICE_LAYOUT_TYPES = {}
for _r in range(ROWS_COUNT):
    for _c in range(COLS_COUNT):
        OFFICE_LAYOUT_TYPES[f"{_c},{_r}"] = _LAYOUT[_r][_c]


@app.route("/api/chat")
def get_chat():
    return jsonify(CHAT_MESSAGES)


@app.route("/api/chat/new")
def get_new_chat():
    """Return messages after the given msg_id (for polling)."""
    after = request.args.get("after", 0, type=int)
    new_msgs = [m for m in CHAT_MESSAGES if m.get("msg_id", 0) > after]
    return jsonify(new_msgs)


@app.route("/api/chat", methods=["POST"])
def send_message():
    data = request.json
    user_message = data.get("message", "")
    target_agent = data.get("agent")

    # Add user command
    new_msg = {
        "msg_id": next_msg_id(),
        "agent": "user",
        "message": user_message,
        "time": datetime.now().strftime("%H:%M"),
        "type": "command",
    }
    CHAT_MESSAGES.append(new_msg)

    # Pick responding agent
    if target_agent and target_agent in AI_AGENTS:
        responding_agent_id = target_agent
    else:
        responding_agent_id = pick_best_agent(user_message)

    agent = AI_AGENTS[responding_agent_id]

    # Quick acknowledgement
    ack_text = generate_ack_response(agent, user_message)
    ack_response = {
        "msg_id": next_msg_id(),
        "agent": responding_agent_id,
        "message": ack_text,
        "time": datetime.now().strftime("%H:%M"),
        "type": "report",
    }
    CHAT_MESSAGES.append(ack_response)

    # Create task for background report generation
    task = create_task(user_message[:50], responding_agent_id, user_message)

    return jsonify({
        "user_message": new_msg,
        "ai_response": ack_response,
        "task": {
            "id": task["id"],
            "status": task["status"],
            "agent_name": task["agent_name"],
        },
    })


def pick_best_agent(message):
    """Pick best agent using each agent's keywords field."""
    best_agent = None
    best_score = 0
    for agent_id, agent in AI_AGENTS.items():
        kws = agent.get("keywords", [])
        score = sum(1 for kw in kws if kw in message)
        if score > best_score:
            best_score = score
            best_agent = agent_id
    return best_agent or random.choice(list(AI_AGENTS.keys()))


def generate_ack_response(agent, user_message):
    """Quick acknowledgement (not the full report)."""
    api_key = os.getenv("OPENAI_API_KEY", "")
    openai_client = OpenAI(api_key=api_key) if api_key else None
    if openai_client:
        try:
            system_prompt = (
                f"당신의 이름은 '{agent['name']}'이고, 역할은 '{agent['role']}'입니다. "
                f"{agent['personality']} "
                f"사용자가 업무를 지시했습니다. 업무를 접수했음을 알리는 간단한 확인 메시지를 작성하세요. "
                f"1문장으로, '확인했습니다. ~하겠습니다' 형식으로 답변하세요. "
                f"구체적으로 어떤 작업을 할 것인지 간략히 언급하세요."
            )
            response = openai_client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_message},
                ],
                max_tokens=100,
                temperature=0.7,
            )
            return response.choices[0].message.content.strip()
        except Exception as e:
            print(f"OpenAI ack error: {e}")

    return f"네, '{user_message[:30]}' 건 확인했습니다. 상세 보고서를 작성 중입니다..."


# ============================================================
# TASK API
# ============================================================

@app.route("/api/tasks")
def get_tasks():
    """Return all tasks, optionally filtered by status."""
    status_filter = request.args.get("status")
    tasks = list(TASKS.values())
    if status_filter:
        tasks = [t for t in tasks if t["status"] == status_filter]
    # Sort by most recent first
    tasks.sort(key=lambda t: t.get("id", ""), reverse=True)
    return jsonify(tasks)


@app.route("/api/tasks/<task_id>")
def get_task(task_id):
    task = TASKS.get(task_id)
    if task:
        return jsonify(task)
    return jsonify({"error": "Task not found"}), 404


# ============================================================
# OTHER ROUTES
# ============================================================

@app.route("/api/rooms")
def get_rooms():
    return jsonify(OFFICE_ROOMS)


@app.route("/api/furniture")
def get_furniture():
    return jsonify(FURNITURE_ITEMS)


@app.route("/api/layout", methods=["GET"])
def get_layout():
    return jsonify({"layout": CURRENT_LAYOUT, "placed": PLACED_FURNITURE})


@app.route("/api/layout", methods=["POST"])
def save_layout():
    global CURRENT_LAYOUT, PLACED_FURNITURE, OFFICE_LAYOUT_TYPES
    data = request.get_json(force=True)
    if "layout" in data:
        new_layout = data["layout"]
        # Validate: must be list of lists of strings
        if isinstance(new_layout, list) and all(isinstance(r, list) for r in new_layout):
            CURRENT_LAYOUT = new_layout
            # Re-build the lookup table used by agent position finder
            OFFICE_LAYOUT_TYPES.clear()
            for r_idx, row in enumerate(CURRENT_LAYOUT):
                for c_idx, cell in enumerate(row):
                    OFFICE_LAYOUT_TYPES[f"{c_idx},{r_idx}"] = cell
    if "placed" in data:
        if isinstance(data["placed"], dict):
            PLACED_FURNITURE = data["placed"]
    return jsonify({"success": True})


@app.route("/api/org")
def get_org_chart():
    """Dynamic org chart built from current agents."""
    # Build org dynamically from AI_AGENTS
    level2 = [a for a in AI_AGENTS.values() if a.get("level") == 2]
    level3 = [a for a in AI_AGENTS.values() if a.get("level") == 3]
    level4 = [a for a in AI_AGENTS.values() if a.get("level") == 4]

    # Group teams
    teams_map = {}
    for a in list(level3) + list(level4):
        team = a.get("team", "기타")
        if team not in teams_map:
            teams_map[team] = {"agents": [], "manager": None}
        if a.get("level") == 3:
            teams_map[team]["manager"] = a
        teams_map[team]["agents"].append(a)

    TEAM_DISPLAY = {
        "build": {"name": "웹 프로덕션팀", "code": "BUILD", "desc": "웹사이트 기획/제작/연동", "color": "#3B82F6"},
        "content": {"name": "콘텐츠 마케팅팀", "code": "CONTENT", "desc": "SNS / 블로그 / 릴스", "color": "#F59E0B"},
        "academy": {"name": "교육팀", "code": "ACADEMY", "desc": "AI 클래스 / 커리큘럼", "color": "#8B5CF6"},
        "management": {"name": "경영팀", "code": "MGMT", "desc": "전략 / 기술 총괄", "color": "#EF4444"},
    }

    teams = []
    for team_key, team_data in teams_map.items():
        display = TEAM_DISPLAY.get(team_key, {"name": team_key, "code": team_key.upper()[:6], "desc": "", "color": "#888"})
        teams.append({
            **display,
            "agents": [{"id": a["id"], "name": a["name"], "role": a["role"], "level": a.get("level", 4), "color": a["avatar_color"]} for a in team_data["agents"]],
        })

    org = {
        "ceo": {"title": "NOOKITOKKI 대표", "name": "You (대표)", "color": "#EF4444", "level": 1},
        "direct": [{"id": a["id"], "title": a["role"], "name": a["name"], "desc": a["description"], "color": a["avatar_color"], "level": a.get("level", 2)} for a in level2],
        "teams": teams,
        "level_names": LEVEL_NAMES,
    }
    return jsonify(org)


@app.route("/api/status")
def get_status():
    openai_client = get_openai_client()
    return jsonify({
        "openai_configured": openai_client is not None,
        "agent_count": len(AI_AGENTS),
        "message_count": len(CHAT_MESSAGES),
        "task_count": len(TASKS),
        "pending_tasks": sum(1 for t in TASKS.values() if t["status"] == "진행중"),
    })


if __name__ == "__main__":
    api_key = os.getenv("OPENAI_API_KEY", "")
    if not api_key:
        print("\n" + "=" * 60)
        print("  WARNING: OPENAI_API_KEY 가 설정되지 않았습니다!")
        print("  .env 파일에 OPENAI_API_KEY=sk-xxxx 를 추가하세요.")
        print("=" * 60 + "\n")
    else:
        print("\n  OpenAI API Key 설정됨. AI 응답이 활성화됩니다.\n")

    app.run(debug=True, host="0.0.0.0", port=5000)
