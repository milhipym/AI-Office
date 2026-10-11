# AI Office - 가상 AI 오피스 v2

월급 0원으로 AI 직원 6명을 운영하는 픽셀아트 스타일 가상 오피스 웹 서비스.
**OpenAI API(GPT-4o + DALL-E 3 + Responses web_search)** 와 연동되어 실제 업무에 사용 가능.

## 주요 기능

### AI 에이전트 (6명, 역할별 특화)
| 에이전트 | 역할 | 출력 형식 |
|---|---|---|
| **Claude Opus** (`@opus`) | CTO / 아키텍처 | 마크다운 + Mermaid 다이어그램 |
| **Claude Sonnet** (`@sonnet`) | 시니어 개발자 | **파일명/언어 명시 코드블록** (실행 가능) |
| **Manus** (`@manus`) | PM / 기획 | 체크리스트 + 마일스톤 + 의존성 표 |
| **Gemini** (`@gemini`) | 디자이너 | 텍스트 + **DALL-E 3 실제 이미지** |
| **ChatGPT** (`@chatgpt`) | 분석가 / 교육 | 구조화 보고서 / 커리큘럼 |
| **Perplexity** (`@perplexity`) | 리서처 | **실시간 웹검색 + 인용 링크** |

### 4개 탭
- **사무실**: 픽셀아트 9x7 그리드, AI 직원 캐릭터 배치
- **팀 채팅**: 마크다운 / 코드블록 / 이미지 / 인용 렌더링, @멘션 자동완성
- **조직도**: CEO → CTO/PM → 4개 팀 구조
- **사무실 편집**: 가구 배치 커스터마이징

## 🧠 세컨브레인 (v3)

업무를 자연어로 기록하면 날짜·분류·태그를 붙여 저장하고, 나중에 찾기 / 주간 보고 / 성과 정리에 재사용합니다.

| 명령 | 담당 | 하는 일 | 예시 |
|---|---|---|---|
| `/기록` | 아카이브 | 기록 → 날짜·분류·태그·성과 여부. 여러 일이 섞여 있으면 나눠서 저장 | `/기록 어제 PG 타임아웃 원인 찾아 핫픽스, 응답 3.1초→0.8초` |
| `/회의` | 회의록 서기 | 회의 메모 → 요약·결정사항·액션 아이템·미결 사항 | `/회의 리뉴얼 킥오프 김OO 이OO` + 줄바꿈 메모 (Shift+Enter) |
| `/찾기` | 파인더 | 기간 필터 + 임베딩 검색 → 근거 기록 [#id] 인용 답변 | `/찾기 지난달 결제 장애 몇 번?` |
| `/주간` | 리포터 | 이번 주(또는 `지난주`, 날짜) 기록 → 주간 보고 초안 | `/주간 지난주` |
| `/성과` | 커리어 코치 | 기간 기록 → STAR 성과, 이력서 문장, 보완점 | `/성과 올해 상반기` |

- 명령 없이 보내면 저가 모델이 의도(기록/회의/검색/주간/성과/기타)를 분류합니다. "기타"면 기존 @멘션 에이전트로 라우팅.
- **세컨브레인 탭**에서 기록 목록 확인 · 필터 · 삭제, 버튼으로 주간 보고/성과 정리 실행.
- 기간 표현: `오늘`, `어제`, `이번주`, `지난주`, `이번달`, `지난달`, `최근 N개월/주/일`, `올해`, `작년`, `상반기/하반기`, `N분기`, `2026-01-01~2026-03-31`
- 분류 목록은 고정(`BRAIN_CATEGORIES`)입니다. 모델이 임의로 분류를 만들면 같은 일이 여러 이름으로 흩어지기 때문입니다.
- 데이터는 `data/brain.db` (SQLite) 한 파일에 저장됩니다. 백업은 이 파일만 복사하면 됩니다.

### 에이전트별 모델

`.env`에서 역할마다 다른 모델을 지정할 수 있습니다. 호출이 잦은 분류/기록은 저가 모델, 드물지만 품질이 중요한 보고/성과는 상위 모델을 권장합니다.

| 변수 | 기본값 | 호출 빈도 |
|---|---|---|
| `MODEL_CLASSIFIER` | gpt-4o-mini | 명령 없는 메시지마다 |
| `MODEL_ARCHIVIST` | gpt-4o-mini | 기록마다 |
| `MODEL_MINUTES` | `OPENAI_MODEL` | 회의마다 |
| `MODEL_FINDER` | `OPENAI_MODEL` | 검색마다 |
| `MODEL_REPORTER` | `OPENAI_MODEL` | 주 1회 |
| `MODEL_COACH` | `OPENAI_MODEL` | 분기/연 1회 |
| `EMBEDDING_MODEL` | text-embedding-3-small | 기록·검색마다 |

> 모델 라인업은 자주 바뀝니다. 설정 전 OpenAI 가격표에서 현재 모델명을 확인하세요. 세컨브레인 에이전트는 temperature를 보내지 않으므로 추론 모델도 그대로 쓸 수 있습니다.

### 개인정보 주의
기록 내용은 OpenAI API로 전송됩니다. 고객 정보·내부 시스템 상세·실명은 적지 말고, 이니셜과 추상화된 표현(예: "결제 모듈 타임아웃")을 쓰세요.

## 실행 방법

### 1. 의존성 설치
```bash
cd AI-Office
pip install -r requirements.txt
```

### 2. 환경변수 설정
```bash
cp .env.example .env
# .env 파일을 열어 OPENAI_API_KEY 입력
# OPENAI_API_KEY=sk-proj-...
```

API 키는 https://platform.openai.com/api-keys 에서 발급.

### 3. 서버 실행
```bash
python app.py
```

브라우저에서 `http://localhost:5000` 접속.

> 기본값은 `127.0.0.1` 바인딩 + 디버그 off 입니다. 디버그 모드(`FLASK_DEBUG=true`)는 Werkzeug 디버거를 통해 원격 코드 실행이 가능하므로 외부에 노출된 상태로 켜지 마세요.

### 테스트
```bash
pip install pytest
python -m pytest tests
```

> API 키 없이도 실행 가능 (모든 에이전트가 "미설정" 안내 메시지 반환)

## 사용 예시

### 개발자 (Sonnet)
```
@sonnet Flask JWT 로그인 API 만들어줘
```
→ `app/routes/auth.py`, `app/models/user.py` 등 **여러 파일의 실행 가능한 코드** 반환

### 리서처 (Perplexity)
```
@perplexity 2026년 최신 AI 규제 동향
```
→ **실시간 웹검색** + 인용 링크 자동 첨부

### 디자이너 (Gemini)
```
@gemini 픽셀아트 스타일 오피스 로고 만들어줘
```
→ **DALL-E 3로 실제 이미지** 생성 후 렌더링

### 자동 라우팅 (멘션 없음)
- "버그 고쳐줘" → Sonnet
- "최신 트렌드 검색" → Perplexity
- "로고 디자인" → Gemini
- "3개월 로드맵" → Manus

## 프로젝트 구조

```
AI-Office/
├── app.py                  # Flask 엔트리
├── config.py               # .env 로더
├── .env.example            # 환경변수 템플릿
├── requirements.txt
├── agents/
│   ├── base.py             # BaseAgent + AgentResponse
│   ├── prompts.py          # 역할별 시스템 프롬프트
│   ├── claude_opus.py      # CTO
│   ├── claude_sonnet.py    # 개발자
│   ├── manus.py            # PM
│   ├── gemini.py           # 디자이너 (DALL-E)
│   ├── chatgpt.py          # 분석가
│   ├── perplexity.py       # 리서처 (web_search)
│   ├── brain_agents.py     # 세컨브레인: 기록/회의록/검색/주간보고/성과
│   ├── brain_common.py     # 기간 파싱, 기록 포맷
│   ├── brain_prompts.py    # 세컨브레인 프롬프트
│   └── router.py           # /명령 · @멘션 · 의도 분류 · 키워드 라우팅
├── services/
│   ├── openai_client.py    # OpenAI SDK 래퍼 (chat / JSON / embedding)
│   ├── brain_store.py      # 세컨브레인 SQLite 저장소
│   └── storage.py          # chat_history.json
├── data/
│   ├── chat_history.json   # 대화 로그 영속
│   └── brain.db            # 세컨브레인 기록
├── tests/                  # pytest (OpenAI 호출은 가짜로 대체)
├── templates/index.html
└── static/
    ├── css/style.css
    └── js/app.js
```

## 기술 스택
- **백엔드**: Python Flask + OpenAI SDK
- **프론트엔드**: HTML5, CSS3, Vanilla JS
- **렌더링**: marked.js (마크다운), highlight.js (코드), DOMPurify (XSS), DALL-E (이미지)
- **테마**: 픽셀아트 / 레트로 게임

## API

| Endpoint | Method | Description |
|---|---|---|
| `/` | GET | 메인 페이지 |
| `/api/status` | GET | OpenAI 연결 상태 |
| `/api/agents` | GET | 에이전트 목록 |
| `/api/chat` | GET | 채팅 기록 |
| `/api/chat` | POST | 메시지 전송 `{message, channel?}` |
| `/api/chat/clear` | POST | 채팅 기록 삭제 |
| `/api/entries` | GET | 세컨브레인 기록 `?from=&to=&category=&kind=` |
| `/api/entries/<id>` | DELETE | 기록 삭제 |
| `/api/brain/meta` | GET | 분류 목록, 에이전트별 모델 |
| `/api/org` | GET | 조직도 |
| `/api/rooms` | GET | 오피스 룸 정보 |
| `/api/furniture` | GET | 가구 카탈로그 |

## 주의사항
- **비용**: GPT-4o 호출 및 DALL-E 3 이미지 생성은 OpenAI 요금이 부과됩니다.
- **보안**: `.env` 파일은 **절대 git에 커밋하지 마세요** (.gitignore 처리됨).
- **Rate limit**: OpenAI 계정의 API rate limit을 확인하세요.
