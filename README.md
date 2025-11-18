# HEYME: 나를 부르면 대답하는 AI, 헤이미  
_2025년 새싹 해커톤(SeSAC Hackathon) – CODE:ME 팀 기획 & 기술 문서_

---

## 0. 프로젝트 개요

- **해커톤명**: 2025년 새싹 해커톤(SeSAC Hackathon)  
- **팀명**: CODE:ME  
- **팀원**: 홍원택, 유보영, 유단영, 한승범, 박무걸  
- **서비스 명칭**: **HEYME**  
- **한줄 소개**:  
  > _“Second Me” — 내 클라우드 문서를 이해하고 대신 답해주는 퍼스널 AI 동반자_

---

## 1. 서비스 컨셉

### 1-1. 네이밍

- **CODE:ME**
  - `CODE`: 기술, 자동화, AI 엔진
  - `ME`: 개인, 나만의 데이터, 나만의 에이전트
- **HEYME (헤이미)**
  - “Hey, Me!” → 부르면 대답하는 **디지털 나(Second Me)**  
  - 코드미(CODE:ME)가 만든, 인간적인 접근을 지향하는 AI 동반자

---

## 2. 활용 데이터 & 인공지능 학습용 데이터

### 2-1. 활용 데이터 개요

| 번호 | 활용 데이터명                                       | 분야                                  | 출처                               |
|------|-----------------------------------------------------|---------------------------------------|------------------------------------|
| 1    | 개인 클라우드 문서 (계약서/매뉴얼/회의록/노트/ PDF/DOCX/XLSX/PPTX) | 사내 규정, 개인 지식, 프로젝트 자료  | 사용자의 Cloud Storage (Google Drive, OneDrive 등) |
| 2    | 이메일 / 캘린더 요약                                | 일정 맥락, 의사결정 히스토리         | Gmail / Outlook API (사용자 동의 범위 내) |

### 2-2. 데이터 활용 방식

- 사용자의 **Cloud Storage**와 **메일/캘린더**를 연결
- 문서/이메일 내용을 텍스트로 추출 후:
  - 클린업(불필요 텍스트 제거)
  - 의미 단위로 **Chunk 분할**
  - 메타데이터(파일명, 작성일, 페이지/섹션 정보 등) 부여
  - Embedding 벡터 생성 → 벡터 스토어(예: Azure AI Search, Pinecone)에 저장
- 질의 시, 관련 문서 chunk를 검색 → LLM이 이를 바탕으로 답변 생성

---

## 3. 문제 정의 & 해결 아이디어

### 3-1. 문제점

1. **문서 분산 & 반복 질의**
   - 규정/정책/회의록/매뉴얼이 드라이브 여기저기 흩어져 있음
   - 새로 온 사람, 다른 팀원이 계속 같은 질문을 반복
   - “그 파일 어디 있었지?”로 시작하는 검색 지옥

2. **프라이버시 & 보안 우려**
   - 민감한 계약서, 인사 관련 문서, 개인 노트 등을  
     범용 챗봇 서비스에 그대로 업로드하기 부담스러움

3. **맥락 없는 Q&A**
   - 일반적인 AI 챗봇은 “인터넷 지식”에는 강하지만  
     **“내 데이터와 내 문맥”**을 이해해서 답변해주지 못함

### 3-2. HEYME의 해결 방식

1. **문서 자동 동기화 + 의미검색**
   - 개인/팀 드라이브 폴더를 지정하면  
     n8n 워크플로우가 문서 추가/수정/삭제를 자동 감지
   - 텍스트 추출 → 전처리 → Embedding → 벡터 인덱싱
   - 챗봇에서 질문하면 **의미 기반 벡터 검색**으로 관련 문서 chunk를 찾아 바로 답변

2. **프라이버시 중심 설계**
   - OAuth 기반 **최소 권한** 접근 (사용자가 선택한 폴더/메일만)
   - PII(개인정보) 마스킹 / 필터링 가능
   - 벡터/메타데이터는 **사용자 소유 저장소 영역**에만 인덱싱

3. **출처 인용 + 후속 질문 제안**
   - 답변 시:
     - “어떤 파일의 몇 번째 문단에서 가져온 내용인지” 함께 표시
     - 후속 질문 템플릿도 제안
       - 예: “관련 출장비 상한 예시는?”, “개정 이력도 보여줘”

---

## 4. 사용자 경험(UX) & 플로우

### 4-1. 사용자 동작 흐름

1. **로그인 & 클라우드 연결**
   - HEYME에 회원가입 / 로그인
   - “클라우드 연결” 버튼 클릭
   - Google Drive / OneDrive 중 선택 → OAuth 인증
   - 동기화할 폴더를 선택

2. **폴더 데이터셋 등록**
   - 백엔드 DB에 `FolderDataset` 생성:

     | 필드명             | 설명                                   |
     |--------------------|----------------------------------------|
     | id                 | 폴더 데이터셋 PK                      |
     | user_id            | 사용자 ID                             |
     | cloud_provider     | google / onedrive 등                  |
     | cloud_folder_id    | 해당 클라우드의 폴더 ID               |
     | title              | 폴더의 이름/별칭                      |
     | description        | 폴더 설명                             |
     | persona_prompt     | 이 폴더용 챗봇 페르소나 프롬프트      |

3. **문서 동기화 & 인덱싱 (n8n 워크플로우)**

   - 트리거:
     - Cloud Storage Webhook (파일 추가/수정/삭제 알림)
     - 또는 주기적 폴링(CRON)
   - 처리 단계:
     1. 파일 메타데이터 조회
     2. 파일 내용 파싱 (PDF/DOCX/PPTX/HTML 등)
     3. 텍스트 전처리 및 Chunk 분할
     4. Embedding 생성 (Azure OpenAI Embedding)
     5. 벡터 스토어(Azure AI Search 등)에 Upsert

4. **챗봇 질의 & 응답**

   - 예: “지난 분기 출장비 규정 요약해줘”
   - 플로우:
     1. 프론트엔드에서 **POST `/api/chat/{slug}`**
     2. 백엔드(FastAPI):
        - `slug`로 ChatbotLink 조회 → `folder_dataset_id`, `system_prompt` 가져오기
        - Azure AI Search에 벡터 검색
          - filter: `folder_dataset_id == ...`
        - 상위 Top-k chunk + system_prompt + 유저 질문으로 프롬프트 구성
        - Azure OpenAI ChatCompletion 호출
     3. 응답:
        - 답변 텍스트
        - 사용된 문서/페이지/문단 정보
   - 프론트:
     - 채팅 UI에 답변 렌더링
     - 출처(파일명, 링크) 및 후속 질문 버튼 노출

5. **문서 변경 시 자동 반영**

   - 새 파일 업로드 / 수정 / 삭제 → 웹훅 / 폴링으로 감지
   - 해당 문서만 재파싱 및 Re-Embedding → 인덱스 갱신
   - 사용자는 **별도의 수동 재학습 없이** 최신 정보를 바로 사용 가능

---

## 5. 제안 배경 및 목적

### 5-1. AI가 ‘기술’에서 ‘생활문화’로

- ChatGPT, Gemini, Claude 등 생성형 AI가 일상에 깊게 들어오면서,
- “모델이 얼마나 대단한가?”보다  
  **“내 삶과 업무에 어떻게 녹여낼 것인가?”**가 더 중요해짐.

### 5-2. 개인화된 지능형 워크플로우의 필요성

- 회사/프로젝트/개인 생활에서,
  - 내 자료, 내 메모, 내 문서들을
  - AI가 이해하고, 내 방식으로 대화해주는 **퍼스널 AI 오토메이션** 필요
- 예:
  - Cloud Storage에 쌓인 자료를 n8n으로 자동 연결
  - “나만의 지식 베이스” 구축
  - 챗봇이 나 대신 응답하도록 설정

### 5-3. ‘디지털 나(Second Me)’의 등장

- AI는 더 이상 외부 조언자가 아닌,
  - 내 데이터에 기반해
  - 나의 생각과 맥락을 이어주는 **확장된 나(Extended Self)**
- HEYME는 이러한 **문화적 변화**를 실험하는 서비스

---

## 6. 서비스 세부 내용

### 6-1. 서비스 개념

> **“Second Me” — 개인의 문서와 대화를 이해하고, 맥락 기반 답변을 제공하는 AI 동반자**

- 개인의 Cloud Storage에서 문서를 자동 수집
- 의미 기반 검색 + LLM을 통해 자연어로 질의응답 수행
- 각 폴더별로 다른 **페르소나** 설정도 가능
  - 예: “회사 인사규정 전문가”, “내 논문 초안 코파일럿”, “개인 재무비서” 등

### 6-2. 핵심 기술 스택

- **워크플로우 자동화**: n8n
- **클라우드 스토리지 연동**: Google Drive API, OneDrive API 등
- **LLM & Embedding**: Azure OpenAI (ChatCompletion, Embedding)
- **문서 파싱**: Unstructured (PDF, PPTX, DOCX, HTML 등)
- **벡터 스토어**: Azure AI Search (벡터 인덱스)
- **백엔드**: FastAPI (Python)
- **프론트엔드**: React / Next.js (또는 단일 HTML + JS 페이지)
- **DB**: RDB (예: PostgreSQL) – User, FolderDataset, ChatbotLink, ChatLog 관리
- **분석/Dashboard**: Power BI 또는 Superset 등 (ChatLog 기반)

### 6-3. 서비스 동작 방식 요약

1. 사용자의 Cloud Storage Service를 n8n으로 연동  
2. 문서 파싱 → Chunk → Embedding  
3. Azure AI Search에 벡터 인덱싱  
4. 챗봇 UI에서 질문  
5. 벡터 검색 + LLM으로 답변 생성  
6. 출처 인용 + 후속 질문 제안  
7. 모든 대화 로그를 저장 → “어떤 질문이 많이 나오는지” 대시보드로 제공

### 6-4. 차별점 / 창의성

- **개인 단위 지식베이스** 구축에 초점
  - 기업용 “사내 검색”이 아닌,
  - **개인의 삶/업무 전체**를 아우르는 퍼스널 AI
- B2B뿐 아니라 **B2C로 확장** 가능한 구조
- 저코드 도구(n8n)를 활용하여
  - 비개발자도 워크플로우를 확장/변경 가능
- **질문 분석 대시보드** 제공:
  - 개인/팀이 “어떤 주제로 가장 많이 묻고 있는지”를 시각화
  - 규정/매뉴얼 개선 포인트 도출

### 6-5. 구현 가능성

- n8n + Azure OpenAI + Azure AI Search 조합으로  
  **해커톤 기간 내 MVP 구현 가능**
- Google/OneDrive API, Gemini 모델 등도 상용 사용 가능

---

## 7. 시스템 아키텍처 (개요)

```mermaid
flowchart LR
    subgraph User
        U1["웹/모바일 브라우저 HEYME Chat UI"]
    end

    subgraph Cloud["Cloud Storage / Mail"]
        GDrive["Google Drive"]
        OneDrive["OneDrive"]
        Gmail["Gmail API"]
        Outlook["Outlook API"]
    end

    subgraph n8n["n8n 워크플로우"]
        N1["파일 변경 감지 (Webhook/폴링)"]
        N2["문서 파싱 (Unstructured)"]
        N3["전처리 및 청킹 (Chunking)"]
        N4["Embedding 생성 (Azure OpenAI)"]
        N5["벡터 인덱스 Upsert (Azure AI Search)"]
    end

    subgraph Backend["Backend (FastAPI + DB)"]
        API["REST API (/api/chat, /api/chatbot-meta)"]
        DB["RDB (User, FolderDataset, ChatbotLink, ChatLog)"]
    end

    subgraph Vector["Azure AI Search"]
        VS["벡터 인덱스"]
    end

    subgraph LLM["Azure OpenAI"]
        ChatModel["ChatCompletion"]
        EmbModel["Embedding"]
    end

    subgraph Analytics["Analytics / Dashboard"]
        BI["Power BI 또는 기타 BI 도구"]
    end

    U1 -->|질문 POST| API
    API -->|folder_dataset_id| VS
    VS -->|Top-k Chunks| API
    API --> ChatModel
    ChatModel --> API -->|응답 JSON| U1

    Cloud --> N1 --> N2 --> N3 --> N4
    N4 --> EmbModel
    EmbModel --> N5 --> VS

    API <---> DB
    DB --> BI
    BI --> U1

    U1 -->|질문/응답 로그 저장| API
    API -->|ChatLog 기록| DB
