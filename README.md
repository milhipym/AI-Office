# AI Office - 나만의 세컨브레인 오피스

픽셀아트 사무실에서 AI 직원들이 업무 기록 · 회의록 · 검색 · 주간 보고 · 성과 정리를 맡는 개인용 웹앱.
모든 직원은 **OpenAI API** 기반이며, 직원마다 다른 모델을 지정할 수 있습니다.

## 조직

```
대표 (나)
 └─ 접수 매니저 ── 명령 없이 보낸 메시지를 분류해 담당자에게 배정
     ├─ 운영지원팀   업무 비서
     ├─ 기록팀       기록관 · 회의록 서기
     ├─ 자료·보고팀  자료 사서 · 주간보고 담당 · 성과 코치
     └─ 콘텐츠팀     (준비 중 — 인스타그램 게시물)
```

| 직원 | 명령 | 하는 일 | 예시 |
|---|---|---|---|
| 접수 매니저 | (자동) | 명령 없는 메시지의 의도 분류 → 담당 배정 | `오늘 결제 장애 대응함` → 기록관 |
| 업무 비서 | `/비서` | 일반 질문, 메일·문서 초안 | `/비서 장애 보고 메일 초안 써줘` |
| 기록관 | `/기록` | 기록 → 날짜·분류·태그·성과 여부. 여러 일이 섞여 있으면 나눠 저장 | `/기록 어제 PG 타임아웃 원인 찾아 핫픽스, 응답 3.1초→0.8초` |
| 회의록 서기 | `/회의` | 회의 메모 → 요약·결정사항·액션 아이템·미결 사항 | `/회의 리뉴얼 킥오프 김OO 이OO` + 메모 (Shift+Enter 줄바꿈) |
| 자료 사서 | `/찾기` | 기간 필터 + 임베딩 검색 → 근거 기록 [#id] 인용 답변 | `/찾기 지난달 결제 장애 몇 번?` |
| 주간보고 담당 | `/주간` | 이번 주(또는 `지난주`, 날짜) 기록 → 주간 보고 초안 | `/주간 지난주` |
| 성과 코치 | `/성과` | 기간 기록 → STAR 성과, 이력서·자기평가 문장, 보완점 (기록 5건 이상) | `/성과 올해 상반기` |

### 화면
- **사무실**: 팀별 방(안내데스크 · 기록실 · 회의실 · 자료·보고실 · 콘텐츠 스튜디오[준비 중])에 직원이 앉아 있고, 일을 맡으면 작업 중으로 바뀌며 말풍선으로 결과를 보여줍니다. 직원을 클릭하면 모델 · 명령 · 예시와 "업무 지시하기" 버튼.
- **팀 채팅**: 지시와 응답. `/`를 입력하면 명령 목록이 뜹니다.
- **세컨브레인**: 저장된 기록·회의록 목록, 분류/종류 필터, 삭제, 주간 보고·성과 정리 바로가기.
- **조직도**: 팀과 직원, 준비 중인 팀.
- **사무실 편집**: 가구 배치 (새로고침하면 초기화).

### 기록 규칙
- 기간 표현: `오늘`, `어제`, `이번주`, `지난주`, `이번달`, `지난달`, `최근 N개월/주/일`, `올해`, `작년`, `상반기/하반기`, `N분기`, `2026-01-01~2026-03-31`
- 분류 목록은 고정(`BRAIN_CATEGORIES`)입니다. 모델이 임의로 분류를 만들면 같은 일이 여러 이름으로 흩어지기 때문입니다.
- 데이터는 `data/brain.db` (SQLite) 한 파일에 저장됩니다. 백업은 이 파일만 복사하면 됩니다.

### 개인정보 주의
기록 내용은 OpenAI API로 전송됩니다. 고객 정보·내부 시스템 상세·실명은 적지 말고, 이니셜과 추상화된 표현(예: "결제 모듈 타임아웃")을 쓰세요.

## 직원별 모델

`.env`에서 직원마다 모델을 지정합니다. 호출이 잦은 분류/기록은 저가 모델, 드물지만 품질이 중요한 보고/성과는 상위 모델을 권장합니다.

| 변수 | 직원 | 기본값 | 호출 빈도 |
|---|---|---|---|
| `MODEL_CLASSIFIER` | 접수 매니저 | gpt-4o-mini | 명령 없는 메시지마다 |
| `OPENAI_MODEL` | 업무 비서 | gpt-4o | `/비서`, 분류 결과 "기타" |
| `MODEL_ARCHIVIST` | 기록관 | gpt-4o-mini | 기록마다 |
| `MODEL_MINUTES` | 회의록 서기 | `OPENAI_MODEL` | 회의마다 |
| `MODEL_FINDER` | 자료 사서 | `OPENAI_MODEL` | 검색마다 |
| `MODEL_REPORTER` | 주간보고 담당 | `OPENAI_MODEL` | 주 1회 |
| `MODEL_COACH` | 성과 코치 | `OPENAI_MODEL` | 분기/연 1회 |
| `EMBEDDING_MODEL` | (검색용) | text-embedding-3-small | 기록·검색마다 |

> 모델 라인업은 자주 바뀝니다. 설정 전 OpenAI 가격표에서 현재 모델명을 확인하세요. 기록팀·자료·보고팀은 temperature를 보내지 않으므로 추론 모델도 그대로 쓸 수 있습니다.

## 새 팀 추가하기 (예: 인스타 콘텐츠팀)

팀 · 방 · 직원 · 명령 · 분류 의도는 모두 `agents/roster.py` 한 곳에서 정의됩니다.

1. **에이전트 작성** — `agents/content_agents.py`에 `BaseAgent`를 상속한 클래스를 만듭니다. 이미지 생성은 `services/openai_client.generate_image()`, 웹 검색은 `web_search_response()`가 이미 있습니다.
2. **등록** — `agents/__init__.py`의 `AGENTS`에 인스턴스를 추가합니다.
3. **로스터** — `roster.py`의 `STAFF`에 직원을 추가합니다 (`team: "content"`, `commands: ["인스타"]`, `intent: {"key": "instagram", "desc": "..."}`, 콘텐츠 스튜디오 안의 `position`).
4. **팀 오픈** — `TEAMS`의 콘텐츠팀과 `ROOMS`의 스튜디오에서 `planned: True`를 지웁니다.

명령어 자동완성, 접수 매니저의 분류, 사무실 배치, 조직도는 자동으로 반영됩니다. `tests/test_roster.py`가 명령 중복 · 좌석 겹침 · 미등록 직원을 검사합니다.

## 실행 방법

```bash
cd AI-Office
pip install -r requirements.txt
cp .env.example .env        # OPENAI_API_KEY 입력
python app.py
```

브라우저에서 `http://localhost:5000` 접속. API 키 없이도 실행은 되며, 직원들이 "미설정" 안내를 반환합니다.

> 기본값은 `127.0.0.1` 바인딩 + 디버그 off 입니다. 디버그 모드(`FLASK_DEBUG=true`)는 Werkzeug 디버거를 통해 원격 코드 실행이 가능하므로 외부에 노출된 상태로 켜지 마세요.

### 테스트
```bash
pip install pytest
python -m pytest tests
```
OpenAI 호출은 가짜로 대체되어 API 키 없이 돌아갑니다.

## 프로젝트 구조

```
AI-Office/
├── app.py                  # Flask 엔트리 + API
├── config.py               # .env 로더, 직원별 모델, 분류 목록
├── agents/
│   ├── roster.py           # 팀 · 방 · 직원 · 명령 · 분류 의도 (단일 정의)
│   ├── router.py           # /명령 → 분류 모델 → 업무 비서 순 라우팅
│   ├── base.py             # BaseAgent + AgentResponse
│   ├── assistant.py        # 업무 비서
│   ├── brain_agents.py     # 기록관 / 회의록 서기 / 자료 사서 / 주간보고 담당 / 성과 코치
│   ├── brain_common.py     # 기간 파싱, 기록 포맷
│   └── brain_prompts.py    # 프롬프트
├── services/
│   ├── openai_client.py    # chat / JSON / embedding / image / web_search
│   ├── brain_store.py      # 기록 SQLite 저장소
│   └── storage.py          # 채팅 로그 (data/chat_history.json)
├── templates/index.html
├── static/                 # css, js
└── tests/                  # pytest
```

## API

| Endpoint | Method | Description |
|---|---|---|
| `/api/status` | GET | OpenAI 연결 상태 |
| `/api/agents` | GET | 직원 목록 (모델 · 명령 · 좌석) |
| `/api/office` | GET | 사무실 그리드 · 방 · 가구 · 팀 |
| `/api/org` | GET | 조직도 |
| `/api/chat` | GET | 채팅 기록 |
| `/api/chat` | POST | 메시지 전송 `{message}` |
| `/api/chat/clear` | POST | 채팅 기록 삭제 |
| `/api/entries` | GET | 기록 `?from=&to=&category=&kind=` |
| `/api/entries/<id>` | DELETE | 기록 삭제 |
| `/api/brain/meta` | GET | 분류 목록, 직원별 모델 |
| `/api/furniture` | GET | 가구 카탈로그 |

## 주의사항
- **비용**: 명령 없이 보낸 메시지는 분류 모델을 한 번 더 호출합니다. 확실한 경우 `/기록`처럼 명령을 붙이면 그 호출을 아낄 수 있습니다.
- **보안**: `.env`, `data/` 는 git에 커밋되지 않습니다 (.gitignore).
