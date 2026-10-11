"""Office roster: teams, rooms and staff in one place.

The office view, org chart, slash commands and the intent classifier are all
derived from this file. Adding a team (e.g. an Instagram content team) means:

1. Write its agent class (a BaseAgent subclass) and register it in
   agents/__init__.py under the staff id.
2. Add a STAFF entry here with its commands and intent.
3. Flip its team's "planned" flag to False and seat it in a room.
"""

import config

GRID = {"cols": 9, "rows": 6}

TEAMS = [
    {
        "id": "front",
        "name": "운영지원팀",
        "code": "FRONT",
        "desc": "메시지 접수 · 담당 배정 · 일정 관리 · 일반 업무 지원",
        "color": "#64748B",
    },
    {
        "id": "record",
        "name": "기록팀",
        "code": "RECORD",
        "desc": "업무일지 기록 · 분류 · 회의록",
        "color": "#14B8A6",
    },
    {
        "id": "report",
        "name": "자료·보고팀",
        "code": "REPORT",
        "desc": "기록 검색 · 주간 보고 · 성과 작성",
        "color": "#F97316",
    },
    {
        "id": "content",
        "name": "콘텐츠팀",
        "code": "CONTENT",
        "desc": "인스타그램 게시물 기획 · 카피 · 이미지",
        "color": "#EC4899",
        "planned": True,
    },
]

# Rectangles on the GRID. Cells outside every room render as hallway.
ROOMS = [
    {"id": "lobby", "name": "안내데스크", "x": 0, "y": 0, "w": 3, "h": 3, "theme": "lobby"},
    {"id": "records", "name": "기록실", "x": 3, "y": 0, "w": 3, "h": 3, "theme": "records"},
    {"id": "meeting", "name": "회의실", "x": 6, "y": 0, "w": 3, "h": 3, "theme": "meeting"},
    {"id": "library", "name": "자료·보고실", "x": 0, "y": 3, "w": 5, "h": 3, "theme": "library"},
    {"id": "studio", "name": "콘텐츠 스튜디오 · 준비 중", "x": 5, "y": 3, "w": 4, "h": 3,
     "theme": "studio", "planned": True},
]

# "col,row" -> furniture id (see the furniture catalog in app.py).
FURNITURE = {
    "0,0": "plant", "1,1": "desk", "2,0": "coffee", "1,2": "desk", "2,2": "desk",
    "3,0": "bookshelf", "4,1": "desk", "5,1": "monitor", "5,0": "bookshelf",
    "6,0": "whiteboard", "7,1": "desk", "8,1": "chair", "8,0": "plant",
    "0,3": "bookshelf", "1,4": "desk", "2,3": "bookshelf", "3,4": "desk", "2,5": "desk",
    "4,5": "plant", "0,5": "lamp",
    "6,4": "monitor", "7,4": "desk", "8,3": "lamp", "6,5": "sofa",
}

# Each staff member's "position" is the cell they sit in. "commands" are the
# slash commands that reach them; "intent" is how the classifier describes
# messages they should get when no command is given.
STAFF = [
    {
        "id": "dispatcher",
        "name": "접수 매니저",
        "short_name": "접수",
        "team": "front",
        "role": "메시지 분류 · 담당 배정",
        "description": "명령 없이 보낸 메시지를 읽고 기록 / 회의록 / 검색 / 보고 / 성과 중 담당자에게 배정합니다.",
        "avatar_color": "#64748B",
        "skills": ["의도 분류", "업무 배정"],
        "position": {"x": 1, "y": 1},
        "model": config.MODEL_CLASSIFIER,
        "commands": [],
        "intent": None,
    },
    {
        "id": "assistant",
        "name": "업무 비서",
        "short_name": "비서",
        "team": "front",
        "role": "일반 질문 · 문서 작성",
        "description": "기록과 무관한 질문, 메일·문서 초안 등 일반 업무를 처리합니다.",
        "avatar_color": "#94A3B8",
        "skills": ["질의응답", "문서 초안", "요약"],
        "position": {"x": 1, "y": 2},
        "model": config.OPENAI_MODEL,
        "commands": ["비서", "질문", "ask"],
        "intent": None,  # fallback for "other"
        "example": "/비서 장애 보고 메일 초안 써줘",
    },
    {
        "id": "scheduler",
        "name": "일정 비서",
        "short_name": "일정",
        "team": "front",
        "role": "일정 등록 · 조회",
        "description": "일정을 등록하고 알려줍니다. 기록·회의록에 나온 앞으로의 일정과 마감도 일정표에 자동으로 올립니다.",
        "avatar_color": "#EAB308",
        "skills": ["일정 등록", "일정 조회", "마감 관리"],
        "position": {"x": 2, "y": 2},
        "model": config.MODEL_SCHEDULER,
        "commands": ["일정", "schedule"],
        "intent": {
            "key": "schedule",
            "desc": '앞으로 있을 일정·약속·마감을 등록하거나, 다가오는 일정을 물어보는 것 (예: "다음주 화요일 3시 보안 점검 회의", "이번주 일정 뭐 있어?"). 이미 한 일의 기록이 주된 내용이면 "log"',
        },
        "example": "/일정 다음주 화요일 15시 보안 점검 회의 본사 3층",
    },
    {
        "id": "archivist",
        "name": "기록관",
        "short_name": "기록관",
        "team": "record",
        "role": "업무일지 기록 · 분류",
        "description": "자연어 업무 기록에 날짜 · 분류 · 태그 · 성과 여부를 붙여 보관합니다.",
        "avatar_color": "#14B8A6",
        "skills": ["업무일지", "자동 분류", "태그"],
        "position": {"x": 4, "y": 1},
        "model": config.MODEL_ARCHIVIST,
        "commands": ["기록", "log"],
        "intent": {
            "key": "log",
            "desc": '자신이 한 일/겪은 일/생각을 기록하려는 서술 (예: "오늘 결제 장애 대응함", "A팀이랑 일정 조율 완료")',
        },
        "example": "/기록 어제 PG 타임아웃 원인 찾아 핫픽스, 응답 3.1초→0.8초",
    },
    {
        "id": "minutes",
        "name": "회의록 서기",
        "short_name": "서기",
        "team": "record",
        "role": "회의록 작성",
        "description": "회의 메모를 요약 · 결정사항 · 액션 아이템 · 미결 사항으로 정리합니다.",
        "avatar_color": "#0EA5E9",
        "skills": ["회의록", "결정사항", "액션 아이템"],
        "position": {"x": 7, "y": 1},
        "model": config.MODEL_MINUTES,
        "commands": ["회의", "회의록", "meeting"],
        "intent": {
            "key": "meeting",
            "desc": "회의 내용/회의 메모를 정리해 달라는 것, 또는 참석자·결정사항·액션아이템이 담긴 회의 메모 원문",
        },
        "example": "/회의 리뉴얼 킥오프 김OO 이OO (Shift+Enter로 메모 이어쓰기)",
    },
    {
        "id": "finder",
        "name": "자료 사서",
        "short_name": "사서",
        "team": "report",
        "role": "기록 검색",
        "description": "\"그거 언제였지?\" 기간과 의미로 과거 기록을 찾아 근거와 함께 답합니다.",
        "avatar_color": "#84CC16",
        "skills": ["의미 검색", "기간 필터", "근거 인용"],
        "position": {"x": 1, "y": 4},
        "model": config.MODEL_FINDER,
        "commands": ["찾기", "검색", "find"],
        "intent": {
            "key": "search",
            "desc": '과거에 기록한 내용을 찾거나 물어보는 것 (예: "지난달 장애 몇 번 있었지?", "B업체 협의 내용 찾아줘")',
        },
        "example": "/찾기 지난달 결제 장애 몇 번?",
    },
    {
        "id": "reporter",
        "name": "주간보고 담당",
        "short_name": "보고",
        "team": "report",
        "role": "주간 업무 보고",
        "description": "한 주의 기록과 회의록으로 팀장 보고용 주간 보고 초안을 만듭니다.",
        "avatar_color": "#F97316",
        "skills": ["주간 보고", "이슈 정리", "다음 주 계획"],
        "position": {"x": 3, "y": 4},
        "model": config.MODEL_REPORTER,
        "commands": ["주간", "주간보고", "weekly"],
        "intent": {"key": "weekly", "desc": "주간 보고/주간 업무 정리를 만들어 달라는 것"},
        "example": "/주간 지난주",
    },
    {
        "id": "coach",
        "name": "성과 코치",
        "short_name": "코치",
        "team": "report",
        "role": "성과 작성 · 커리어 정리",
        "description": "기간별 기록에서 STAR 성과, 이력서·자기평가 문장, 보완점을 뽑습니다.",
        "avatar_color": "#A855F7",
        "skills": ["성과 정리", "STAR", "자기평가"],
        "position": {"x": 2, "y": 5},
        "model": config.MODEL_COACH,
        "commands": ["성과", "커리어", "career"],
        "intent": {"key": "career", "desc": "성과 정리, 커리어 정리, 이력서·자기평가용 정리를 요청하는 것"},
        "example": "/성과 올해 상반기",
    },
]

STAFF_BY_ID = {s["id"]: s for s in STAFF}


def commands() -> dict:
    """Slash command (lower-case) -> staff id."""
    return {c.lower(): s["id"] for s in STAFF for c in s["commands"]}


def intents() -> dict:
    """Classifier intent key -> staff id."""
    return {s["intent"]["key"]: s["id"] for s in STAFF if s["intent"]}


def org_chart() -> dict:
    teams = []
    for team in TEAMS:
        members = [s["name"] for s in STAFF if s["team"] == team["id"]]
        teams.append({**team, "agents": members or ["채용 예정"], "planned": team.get("planned", False)})
    return {
        "ceo": {"title": "대표", "name": "나", "color": "#EF4444"},
        "direct": [
            {
                "title": "업무 배정",
                "name": STAFF_BY_ID["dispatcher"]["name"],
                "desc": "모든 지시를 받아 담당 팀에 배정",
                "color": "#64748B",
            }
        ],
        "teams": teams,
    }
