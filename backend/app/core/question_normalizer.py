from __future__ import annotations

import re

import httpx

from app.core.config import settings


def _simple_normalize(text: str) -> str:
    """
    LLM 실패 시 사용하는 단순 정규화.
    - 소문자/공백 트리밍
    - 문장부호 제거
    - 연속 공백 축소
    """
    s = text.strip().lower()
    s = re.sub(r"[^\w\s가-힣]", "", s)
    s = re.sub(r"\s+", " ", s)
    return s


PRONOUN_PREFIXES = [
    "나 ",
    "너 ",
    "이 사람 ",
    "저 사람 ",
    "그 사람 ",
    "이사람 ",
    "저사람 ",
    "그사람 ",
]


def postprocess_normalized(s: str) -> str:
    """
    LLM이 만든 문장을 규칙 기반으로 추가 정리:
    - 앞의 주어/대명사 제거
    - 이름/좋아하는 것 패턴 통합
    """
    s = s.strip()

    for p in PRONOUN_PREFIXES:
        if s.startswith(p):
            s = s[len(p):].strip()

    if s.startswith("이 사람 "):
        s = s[len("이 사람 "):].strip()
    if s.startswith("그 사람 "):
        s = s[len("그 사람 "):].strip()
    if s.startswith("저 사람 "):
        s = s[len("저 사람 "):].strip()

    if s.endswith("이름") and s != "이름":
        s = "이름"

    if "좋아하는 것" in s and s != "좋아하는 것":
        s = "좋아하는 것"

    s = s.strip()
    return s


async def normalize_question_semantic(question: str) -> str:
    """
    질문을 의도 기준으로 정규화한다.
    1) Azure OpenAI chat으로 의미 정규화 시도
    2) postprocess_normalized로 추가 정리
    3) 실패 시 simple normalize로 fallback
    """
    base_fallback = _simple_normalize(question)

    if (
        not settings.azure_openai_endpoint
        or not settings.azure_openai_api_key
        or not settings.azure_openai_chat_deployment
    ):
        return base_fallback

    prompt = f"""
다음 사용자의 질문을 '의도' 기준으로 정규화해.

규칙(아주 중요):
- 존댓말/반말, 문장 끝 어미(뭐야/뭐야?, 뭐임? 등)는 무시.
- "나", "너", "이 사람", "저 사람", "그 사람" 같은 주어/대명사는 제거.
- "이 사람 이름", "너 이름", "그 사람의 이름" → "이름"
- "이 사람 좋아하는 것", "너가 좋아하는 것", "이 사람이 좋아하는 것" → "좋아하는 것"
- 최종 결과는 "이름", "좋아하는 것", "성별", "직장" 같은 핵심 명사구 하나만 남기도록 최대한 단순하게 만든다.
- 예시 없이, 결과 문장 한 줄만 출력해.

예시:
- "이사람의 이름이 뭐야?" -> "이름"
- "나 이사람의 이름은?" -> "이름"
- "이 사람 이름 알려줘" -> "이름"
- "너 이름 뭐야?" -> "이름"

- "너가 좋아하는 것은 뭐야?" -> "좋아하는 것"
- "이 사람 좋아하는 것?" -> "좋아하는 것"
- "이 사람이 뭘 좋아해?" -> "좋아하는 것"

- "코드미가 뭐야?" -> "코드미"
- "코드미 알아?" -> "코드미"
- "코드잇은 알아?" -> "코드잇"

사용자 질문: "{question}"
"""

    url = (
        f"{settings.azure_openai_endpoint.rstrip('/')}/openai/deployments/"
        f"{settings.azure_openai_chat_deployment}/chat/completions"
        f"?api-version={settings.azure_openai_api_version or '2024-02-15-preview'}"
    )
    headers = {
        "api-key": settings.azure_openai_api_key,
        "Content-Type": "application/json",
    }
    body = {
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0,
        "max_tokens": 64,
    }

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.post(url, headers=headers, json=body)
            resp.raise_for_status()
            data = resp.json()
            content = (data["choices"][0]["message"]["content"] or "").strip()
            if not content:
                return base_fallback
            line = content.splitlines()[0].strip()
            if not line:
                return base_fallback
            normalized = postprocess_normalized(line)
            return normalized or base_fallback
    except Exception:
        return base_fallback
