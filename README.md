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
│   └── router.py           # @멘션 / 키워드 라우팅
├── services/
│   ├── openai_client.py    # OpenAI SDK 래퍼
│   └── storage.py          # chat_history.json
├── data/
│   └── chat_history.json   # 대화 로그 영속
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
| `/api/org` | GET | 조직도 |
| `/api/rooms` | GET | 오피스 룸 정보 |
| `/api/furniture` | GET | 가구 카탈로그 |

## 주의사항
- **비용**: GPT-4o 호출 및 DALL-E 3 이미지 생성은 OpenAI 요금이 부과됩니다.
- **보안**: `.env` 파일은 **절대 git에 커밋하지 마세요** (.gitignore 처리됨).
- **Rate limit**: OpenAI 계정의 API rate limit을 확인하세요.
