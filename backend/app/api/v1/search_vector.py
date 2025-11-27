from __future__ import annotations

from typing import List, Optional
from uuid import UUID

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.api.v1.deps import get_current_user
from app.core.config import settings
from app.models.user import User

router = APIRouter(prefix="/api/v1/search", tags=["search"])


class VectorSearchRequest(BaseModel):
    query: str
    group_id: Optional[UUID] = None
    top_k: int = 5


class SearchHit(BaseModel):
    id: str
    document_id: Optional[str] = None
    user_id: Optional[str] = None
    group_id: Optional[str] = None
    chunk_id: Optional[int] = None
    title: Optional[str] = None
    content: Optional[str] = None
    source_path: Optional[str] = None
    original_file_name: Optional[str] = None
    score: float


class VectorSearchResponse(BaseModel):
    query: str
    top_k: int
    hits: List[SearchHit]


async def embed_query(text: str) -> List[float]:
    """Create an embedding for the query using Azure OpenAI."""
    url = (
        f"{settings.azure_openai_endpoint}/openai/deployments/"
        f"{settings.azure_openai_embed_deployment}/embeddings"
        "?api-version=2024-02-15-preview"
    )
    headers = {
        "api-key": settings.azure_openai_api_key,
        "Content-Type": "application/json",
    }
    payload = {"input": text}

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(url, headers=headers, json=payload)

    if resp.status_code >= 400:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to get embedding from Azure OpenAI: {resp.status_code} {resp.text}",
        )

    data = resp.json()
    try:
        return data["data"][0]["embedding"]
    except (KeyError, IndexError) as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Invalid embedding response: {e}",
        )


async def vector_search(
    query_vector: List[float],
    user_id: UUID,
    group_id: Optional[UUID],
    top_k: int,
) -> VectorSearchResponse:
    """Run vector search on Azure AI Search scoped to user (and optional group)."""
    search_url = (
        f"{settings.azure_search_endpoint}/indexes/{settings.azure_search_index_name}"
        "/docs/search?api-version=2023-11-01"
    )

    filters = [f"user_id eq '{user_id}'"]
    if group_id is not None:
        filters.append(f"group_id eq '{group_id}'")
    filter_expr = " and ".join(filters)

    body = {
        "vectorQueries": [
            {
                "kind": "vector",
                "vector": query_vector,
                "fields": "embedding",
                "k": top_k,
            }
        ],
        "filter": filter_expr,
        "select": (
            "id,document_id,user_id,group_id,chunk_id,"
            "title,content,source_path,original_file_name"
        ),
        "top": top_k,
    }

    headers = {
        "Content-Type": "application/json",
        "api-key": settings.azure_search_admin_key,
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(search_url, headers=headers, json=body)

    if resp.status_code >= 400:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Azure Search error: {resp.status_code} {resp.text}",
        )

    data = resp.json()
    hits: List[SearchHit] = []
    for doc in data.get("value", []):
        hits.append(
            SearchHit(
                id=doc.get("id"),
                document_id=doc.get("document_id"),
                user_id=doc.get("user_id"),
                group_id=doc.get("group_id"),
                chunk_id=doc.get("chunk_id"),
                title=doc.get("title"),
                content=doc.get("content"),
                source_path=doc.get("source_path"),
                original_file_name=doc.get("original_file_name"),
                score=float(doc.get("@search.score", 0.0)),
            )
        )

    return VectorSearchResponse(query="", top_k=top_k, hits=hits)


@router.post("/vector", response_model=VectorSearchResponse)
async def search_with_vector(
    payload: VectorSearchRequest,
    current_user: User = Depends(get_current_user),
):
    """Vector search within the current user's documents (optionally scoped by group)."""
    query_vec = await embed_query(payload.query)
    result = await vector_search(
        query_vector=query_vec,
        user_id=current_user.id,
        group_id=payload.group_id,
        top_k=payload.top_k,
    )
    result.query = payload.query
    return result
