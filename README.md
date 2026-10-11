# AI Office - 나만의 세컨브레인 오피스

3D 사무실에서 AI 직원들이 업무 기록 · 회의록 · 일정 · 검색 · 주간 보고 · 성과 정리를 맡는 개인용 웹앱.
모든 직원은 **OpenAI API** 기반이며, 직원마다 다른 모델을 지정할 수 있습니다.

## 조직

```
대표 (나)
 └─ 접수 매니저 ── 명령 없이 보낸 메시지를 분류해 담당자에게 배정
     ├─ 운영지원팀   업무 비서 · 일정 비서
     ├─ 기록팀       기록관 · 회의록 서기
     ├─ 자료·보고팀  자료 사서 · 주간보고 담당 · 성과 코치
     └─ 콘텐츠팀     (준비 중 — 인스타그램 게시물)
```

| 직원 | 명령 | 하는 일 | 예시 |
|---|---|---|---|
| 접수 매니저 | (자동) | 명령 없는 메시지의 의도 분류 → 담당 배정 | `오늘 결제 장애 대응함` → 기록관 |
| 업무 비서 | `/비서` | 일반 질문, 메일·문서 초안 | `/비서 장애 보고 메일 초안 써줘` |
| 일정 비서 | `/일정` | 일정 등록 · 조회 (`이번주`, `내일`, `다음주`, `다음달`) | `/일정 다음주 화요일 15시 보안 점검 회의 본사 3층` |
| 기록관 | `/기록` | 기록 → 날짜·분류·태그·성과 여부. 여러 일이 섞여 있으면 나눠 저장 | `/기록 어제 PG 타임아웃 원인 찾아 핫픽스, 응답 3.1초→0.8초` |
| 회의록 서기 | `/회의` | 회의 메모 → 요약·결정사항·액션 아이템·미결 사항 | `/회의 리뉴얼 킥오프 김OO 이OO` + 메모 (Shift+Enter 줄바꿈) |
| 자료 사서 | `/찾기` | 기간 필터 + 임베딩 검색 → 근거 기록 [#id] 인용 답변 | `/찾기 지난달 결제 장애 몇 번?` |
| 주간보고 담당 | `/주간` | 이번 주(또는 `지난주`, 날짜) 기록 → 주간 보고 초안 | `/주간 지난주` |
| 성과 코치 | `/성과` | 기간 기록 → STAR 성과, 이력서·자기평가 문장, 보완점 (기록 5건 이상) | `/성과 올해 상반기` |

### 화면
- **사무실 (3D)**: 복셀 스타일 3D 사무실. 팀별 방(안내데스크 · 기록실 · 회의실 · 자료·보고실 · 콘텐츠 스튜디오[준비 중])에 직원이 앉아 있고, 일을 맡으면 타이핑하며 말풍선으로 결과를 보여줍니다. 드래그로 회전, 휠/핀치로 확대. 직원을 클릭하면 모델 · 명령 · 예시와 "업무 지시하기" 버튼. **2D 보기**로 전환 가능하며, 3D를 쓸 수 없으면 자동으로 2D로 표시됩니다.
- **팀 채팅**: 지시와 응답. `/`를 입력하면 명령 목록이 뜹니다.
- **세컨브레인**: 저장된 기록·회의록 목록, 분류/종류 필터, 삭제, 주간 보고·성과 정리 바로가기.
- **일정표**: 월간 달력 + 다가오는 14일 목록. 날짜를 누르면 그날 일정, 일정마다 삭제 · `.ics` 받기.
- **조직도**: 팀과 직원, 준비 중인 팀.
- **사무실 편집**: 가구 배치 (새로고침하면 초기화).

### 기록 규칙
- 기간 표현: `오늘`, `어제`, `이번주`, `지난주`, `이번달`, `지난달`, `최근 N개월/주/일`, `올해`, `작년`, `상반기/하반기`, `N분기`, `2026-01-01~2026-03-31`
- 분류 목록은 고정(`BRAIN_CATEGORIES`)입니다. 모델이 임의로 분류를 만들면 같은 일이 여러 이름으로 흩어지기 때문입니다.
- 데이터는 `data/brain.db` (SQLite) 한 파일에 저장됩니다. 백업은 이 파일만 복사하면 됩니다.

### 일정 자동 등록
따로 `/일정`을 쓰지 않아도, 기록과 회의록에 나온 **앞으로의 일정**이 일정표에 자동으로 올라갑니다 (같은 모델 호출에서 함께 추출하므로 추가 비용 없음).

| 어디서 | 무엇이 | 예 |
|---|---|---|
| `/기록` | 앞으로 잡힌 약속·회의 | "오늘 장애 회고함. **금요일 10시 후속 점검** 잡힘" |
| `/회의` | 다음 회의·후속 미팅 | "**2차 리뷰 28일 2시**" |
| `/회의` | 기한 있는 액션 아이템 → ⏰ 마감 | "시안 **이OO 다음주 수요일까지**" |

- **오늘 이후의 구체적인 날짜만** 등록합니다. 지난 일, "다음주쯤"·"조만간" 같은 모호한 표현은 넣지 않습니다.
- 같은 날 같은 제목(띄어쓰기·대소문자 무시)은 중복 등록하지 않습니다.
- 등록되면 응답에 "📅 일정표에 N건 추가"로 표시됩니다. 잘못 들어간 건 일정표에서 ✕로 삭제하세요.
- 주간보고 담당은 **다음 7일 일정표**를 "다음 주 계획"에 반영합니다.

### 외부 캘린더로 가져가기 (.ics)
일정표의 **📥 내보내기 (.ics)** 는 오늘 이후 일정을, 일정 옆 📥 는 그 일정 하나를 파일로 받습니다.
- **Google 캘린더**: 설정 → 가져오기/내보내기 → 가져오기에서 파일 선택
- **Apple 캘린더 (Mac)**: 받은 파일을 더블클릭
- **Outlook**: 파일 → 열기 및 내보내기 → 가져오기/내보내기 → iCalendar 파일

> 가져오기는 한 번 복사하는 방식이라, 앱에서 일정을 고치거나 지워도 외부 캘린더에는 반영되지 않습니다. 전체 파일을 다시 가져오면 캘린더에 따라 이미 가져온 일정이 중복될 수 있으니, 새 일정은 📥 로 하나씩 가져가는 것을 권장합니다.

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
| `MODEL_SCHEDULER` | 일정 비서 | gpt-4o-mini | `/일정`마다 |
| `EMBEDDING_MODEL` | (검색용) | text-embedding-3-small | 기록·검색마다 |

> 모델 라인업은 자주 바뀝니다. 설정 전 OpenAI 가격표에서 현재 모델명을 확인하세요. 모든 직원이 temperature를 보내지 않으므로 추론 모델도 그대로 쓸 수 있습니다.

### 임베딩 모델을 바꿀 때
임베딩은 모델마다 벡터 공간이 달라서, 다른 모델로 만든 벡터끼리는 비교할 수 없습니다. 그래서 기록마다 어떤 임베딩 모델로 만들었는지 함께 저장합니다.

- `EMBEDDING_MODEL`을 바꾸면 기존 기록은 "갱신 필요"로 표시되고, 갱신 전까지는 **키워드로만** 검색됩니다 (잘못된 의미 검색 결과를 내지 않음).
- 세컨브레인 탭의 **⚠️ 검색 인덱스 갱신** 버튼(또는 `POST /api/brain/reembed`)을 누르면 전체를 새 모델로 다시 계산합니다. 임베딩 호출이 실패해 벡터 없이 저장된 기록도 같은 버튼으로 채워집니다.
- 처음 정한 모델을 계속 쓰는 것을 권장합니다. 갱신 비용은 기록 수에 비례합니다.

## 새 팀 추가하기 (예: 인스타 콘텐츠팀)

팀 · 방 · 직원 · 명령 · 분류 의도는 모두 `agents/roster.py` 한 곳에서 정의됩니다.

1. **에이전트 작성** — `agents/content_agents.py`에 `BaseAgent`를 상속한 클래스를 만듭니다. 이미지 생성은 `services/openai_client.generate_image()`, 웹 검색은 `web_search_response()`가 이미 있습니다.
2. **등록** — `agents/__init__.py`의 `AGENTS`에 인스턴스를 추가합니다.
3. **로스터** — `roster.py`의 `STAFF`에 직원을 추가합니다 (`team: "content"`, `commands: ["인스타"]`, `intent: {"key": "instagram", "desc": "..."}`, 콘텐츠 스튜디오 안의 `position`).
4. **팀 오픈** — `TEAMS`의 콘텐츠팀과 `ROOMS`의 스튜디오에서 `planned: True`를 지웁니다.

명령어 자동완성, 접수 매니저의 분류, 사무실 배치, 조직도는 자동으로 반영됩니다. `tests/test_roster.py`가 명령 중복 · 좌석 겹침 · 미등록 직원을 검사합니다.

## 내 노트북에서 실행하기

### 실행 전에 확인할 점
- **Python 3.9 이상** (3.10+ 권장). 3.8 이하에서는 실행 즉시 오류가 납니다.
- **Mac은 5000번 포트를 AirPlay 수신기가 사용**합니다. 아래 4단계에서 `FLASK_PORT=5050`으로 바꾸세요.
- **인터넷 연결 필요**: 화면 라이브러리(마크다운 렌더링, 3D)를 CDN에서 받습니다. 3D 라이브러리를 못 받으면 사무실은 자동으로 2D로 표시됩니다.

### 1. Python 확인
```bash
python3 --version      # Mac
python --version       # Windows
```
없거나 3.9 미만이면 python.org에서 설치하세요. Windows는 설치 화면에서 **"Add Python to PATH"** 체크.

### 2. 코드 받기
```bash
git clone https://github.com/milhipym/AI-Office.git
cd AI-Office
git checkout ccr-61aa7d3b-vs0161   # PR 머지 전에만 필요. 머지 후에는 생략
```
비공개 저장소라면 비밀번호 자리에 GitHub Personal Access Token을 입력합니다.

### 3. 가상환경 + 패키지 설치
**Mac**
```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```
**Windows (PowerShell)**
```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```
"스크립트를 실행할 수 없습니다" 오류가 나면 `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`를 한 번 실행한 뒤 다시 활성화하세요.

### 4. API 키 · 모델 설정
```bash
cp .env.example .env       # Mac
copy .env.example .env     # Windows
```
`.env`를 열어 수정합니다.
```
OPENAI_API_KEY=sk-proj-...          # platform.openai.com > API keys
FLASK_PORT=5050                     # Mac은 5000번 충돌 회피

# 직원별 모델 (비워두면 기본값). 정확한 모델 ID는 OpenAI 모델 페이지에서 복사
OPENAI_MODEL=...                    # 업무 비서
MODEL_CLASSIFIER=...                # 접수 매니저 — 저가·고속 모델
MODEL_ARCHIVIST=...                 # 기록관 — 저가 모델
MODEL_MINUTES=...                   # 회의록 서기
MODEL_FINDER=...                    # 자료 사서
MODEL_REPORTER=...                  # 주간보고 담당
MODEL_COACH=...                     # 성과 코치
MODEL_SCHEDULER=...                 # 일정 비서 — 저가 모델
EMBEDDING_MODEL=text-embedding-3-small   # 한번 정하면 바꾸지 않기
```
OpenAI 계정에 결제 수단이 등록되어 있어야 키가 동작합니다. **Billing에서 월 사용 한도(예: $10)를 걸어두기**를 권장합니다.

### 5. 실행
```bash
python app.py        # 가상환경이 켜진 상태에서
```
브라우저에서 **http://localhost:5050** (포트를 안 바꿨으면 5000).

다음부터는:
```bash
cd AI-Office
source .venv/bin/activate     # Windows: .venv\Scripts\Activate.ps1
python app.py
```

### 6. 처음 써볼 것
1. 상단 배지가 **🟢 OpenAI 연결됨**인지 확인
2. 팀 채팅에 `/기록 오늘 OO 회의 참석, 배포 일정 확정` → 사무실에서 기록관이 일하고 말풍선으로 결과를 보여줌
3. 명령 없이 `어제 장애 대응했음` → 접수 매니저가 기록관에게 배정하는지 확인
4. 회의는 `/회의 제목` + Shift+Enter로 메모를 이어 쓴 뒤 Enter
5. `/일정 내일 오후 3시 OO 미팅` → 일정표 탭에 표시되는지 확인
6. 며칠 쌓이면 `/찾기`, `/주간` (`/성과`는 기록 5건 이상부터)

### 7. 백업 · 업데이트
- 기록은 **`data/brain.db` 파일 하나**에 저장됩니다. 이 파일만 복사하면 백업 끝 (git에는 올라가지 않음).
- 업데이트: `git pull` 후 `pip install -r requirements.txt`. 기존 기록은 유지됩니다.

### 문제 해결
| 증상 | 원인 / 조치 |
|---|---|
| 접속 시 403 또는 다른 화면 (Mac) | AirPlay가 5000번 사용 중 → `.env`에 `FLASK_PORT=5050` |
| 배지가 "OPENAI_API_KEY 미설정" | `.env`가 `AI-Office` 폴더 바로 아래 있는지, 키가 `sk-`로 시작하는지 확인 후 서버 재시작 |
| 응답에 `**`, `##` 같은 기호가 그대로 보임 | 마크다운 라이브러리(cdnjs) 로드 실패 → 회사망·보안 프로그램 확인 |
| 사무실이 3D가 아니라 2D로 나옴 | 3D 라이브러리(jsdelivr) 로드 실패 또는 WebGL 미지원 → 네트워크 확인, 크롬/엣지 최신 버전 사용 |
| 3D가 버벅이거나 배터리를 많이 씀 | 사무실 탭의 **🗺️ 2D로 보기** (선택은 브라우저에 기억됨) |
| "model not found" | `.env`의 모델 ID 오타 → OpenAI 모델 페이지에서 그대로 복사 |
| `ModuleNotFoundError: flask` | 가상환경이 꺼져 있음 → `activate` 먼저 |
| 세컨브레인 탭에 "⚠️ 검색 인덱스 갱신 필요" | 버튼을 한 번 누르면 해결 |

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
│   ├── schedule.py         # 일정 비서 + 기록·회의록에서 일정 자동 등록
│   ├── brain_common.py     # 기간 파싱, 기록 포맷
│   └── brain_prompts.py    # 프롬프트
├── services/
│   ├── openai_client.py    # chat / JSON / embedding / image / web_search
│   ├── brain_store.py      # 기록 · 일정 SQLite 저장소
│   ├── ics.py              # 일정 .ics 내보내기
│   └── storage.py          # 채팅 로그 (data/chat_history.json)
├── templates/index.html
├── static/
│   ├── js/app.js           # 화면 전체 (탭, 채팅, 2D 사무실, 세컨브레인)
│   ├── js/office3d.js      # 3D 사무실 (three.js, CDN 실패 시 2D로 대체)
│   └── css/style.css
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
| `/api/brain/meta` | GET | 분류 목록, 직원별 모델, 갱신 필요 기록 수 |
| `/api/brain/reembed` | POST | 임베딩이 없거나 다른 모델로 만든 기록 재계산 |
| `/api/events` | GET | 일정 `?from=&to=` |
| `/api/events/<id>` | DELETE | 일정 삭제 |
| `/api/events.ics` | GET | 일정 .ics 내보내기 (기본: 오늘 이후, `?from=`로 변경) |
| `/api/events/<id>.ics` | GET | 일정 하나 .ics |
| `/api/furniture` | GET | 가구 카탈로그 |

## 주의사항
- **비용**: 명령 없이 보낸 메시지는 분류 모델을 한 번 더 호출합니다. 확실한 경우 `/기록`처럼 명령을 붙이면 그 호출을 아낄 수 있습니다.
- **보안**: `.env`, `data/` 는 git에 커밋되지 않습니다 (.gitignore).
