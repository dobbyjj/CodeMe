from __future__ import annotations

import logging
from typing import Iterable

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


async def trigger_n8n_indexing(docs: Iterable) -> None:
    """
    업로드한 문서 목록을 n8n 인덱스 웹훅으로 전달한다.
    docs는 Pydantic 모델(예: DocumentRead)의 iterable이어야 하며, model_dump()를 지원해야 한다.
    """
    webhook = settings.n8n_index_webhook_url
    if not webhook:
        logger.warning("N8N_INDEX_WEBHOOK_URL not set – skipping indexing trigger")
        return

    async with httpx.AsyncClient(timeout=10.0) as client:
        for doc in docs:
            try:
                # model_dump(mode="json") ensures UUID/datetime are stringified
                payload = doc.model_dump(mode="json") if hasattr(doc, "model_dump") else doc
                resp = await client.post(webhook, json=payload)
                resp.raise_for_status()
                logger.info("Triggered indexing for document %s", payload.get("id"))
            except Exception as exc:
                logger.exception("Failed to trigger indexing for %s: %s", payload.get("id"), exc)
