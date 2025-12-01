from __future__ import annotations

import logging
import re

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


def _simple_normalize(text: str) -> str:
    """
    LLM이 실패했을 때를 위한 단순 문자열 정규화.
    - 소문자
    - 양쪽 공백 제거
    - 문장부호 제거
    - 연속 공백 하나로
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
    LLM이 만들어 준 문장을 한 번 더 규칙 기반으로 정리한다.

    - 앞에 붙은 주어/대명사 제거 (나/너/이 사람/그 사람 ...)
    - "이 사람 이름", "너 이름" → "이름"
    - "이 사람 좋아하는 것", "너 좋아하는 것" → "좋아하는 것"
    """
    s = s.strip()

    # 1) 앞에 붙은 주어/대명사 제거
    for p in PRONOUN_PREFIXES:
        if s.startswith(p):
            s = s[len(p) :].strip()

    # 2) 자주 나오는 패턴: "이 사람 ~" 이 남아 있으면 한 번 더 제거
    for p in ["이 사람 ", "그 사람 ", "저 사람 "]:
        if s.startswith(p):
            s = s[len(p) :].strip()

    # 3) 이름 관련 패턴 통합
    if s.endswith("이름") and s != "이름":
        s = "이름"

    # 4) 좋아하는 것 관련 패턴 통합
    if "좋아하는 것" in s and s != "좋아하는 것":
        s = "좋아하는 것"

    return s.strip()


async def normalize_question_semantic(question: str) -> str:
    """
    질문을 '의도' 기준으로 정규화한다.
    1) LLM으로 의미 기반 정규화 시도
    2) 후처리(postprocess_normalized)로 주어 제거/패턴 통합
    3) 실패 시 simple normalize 로 fallback

    어떤 예외가 나도 여기서 예외를 밖으로 던지지 않고,
    항상 문자열을 반환하도록 한다.
    """
    base_fallback = _simple_normalize(question)

    if (
        not settings.azure_openai_endpoint
        or not settings.azure_openai_api_key
        or not settings.azure_openai_chat_deployment
    ):
        logger.warning("normalize_question_semantic: Azure OpenAI 설정이 없어 fallback 사용")
        return base_fallback

    prompt = f"""
다음 사용자의 질문을 '의도' 기준으로 정규화해.

규칙(아주 중요):
- 존댓말/반말, 문장 끝 어미(뭐야/뭐야?, 뭐임? 등)는 무시.
- "나", "너", "이 사람", "저 사람", "그 사람" 같은 주어/대명사는 제거.
- "이 사람 이름", "너 이름", "그 사람의 이름" → "이름"
- "이 사람 좋아하는 것", "너가 좋아하는 것", "이 사람이 좋아하는 것" → "좋아하는 것"
- 최종 결과는 "이름", "좋아하는 것", "성별", "직장" 같은
  핵심 명사구 하나만 남기도록 최대한 단순하게 만든다.
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
    except Exception as e:
        logger.exception("normalize_question_semantic: LLM 호출 실패 - fallback 사용", exc_info=e)
        return base_fallback

    try:
        resp.raise_for_status()
        data = resp.json()
        raw = (data["choices"][0]["message"]["content"] or "").strip()
    except Exception as e:
        logger.exception("normalize_question_semantic: 응답 파싱 실패 - fallback 사용", exc_info=e)
        return base_fallback

    if not raw:
        logger.warning("normalize_question_semantic: LLM 응답이 비어 있음 - fallback 사용")
        return base_fallback

    line = raw.splitlines()[0].strip()
    if not line:
        logger.warning("normalize_question_semantic: 첫 줄이 비어 있음 - fallback 사용")
        return base_fallback

    try:
        normalized = postprocess_normalized(line)
    except Exception as e:
        logger.exception("normalize_question_semantic: postprocess 실패 - fallback 사용", exc_info=e)
        return base_fallback

    return normalized or base_fallback
