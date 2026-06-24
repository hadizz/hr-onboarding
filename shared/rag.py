from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path

import chromadb
from chromadb.utils import embedding_functions

from shared.config import CHROMA_PATH, OPENAI_API_KEY, SEED_DATA_DIR

COLLECTION_NAME = "hr_handbook"
_indexed = False


@dataclass
class SearchResult:
    content: str
    source: str
    score: float


def _chunk_markdown(text: str, source: str, chunk_size: int = 500) -> list[dict]:
    sections = re.split(r"\n(?=#{1,3}\s)", text)
    chunks: list[dict] = []
    for section in sections:
        section = section.strip()
        if not section:
            continue
        for i in range(0, len(section), chunk_size):
            chunk = section[i : i + chunk_size].strip()
            if chunk:
                chunks.append({"content": chunk, "source": source})
    return chunks


def _embedding_function():
    if OPENAI_API_KEY:
        return embedding_functions.OpenAIEmbeddingFunction(
            api_key=OPENAI_API_KEY,
            model_name="text-embedding-3-small",
        )
    return embedding_functions.DefaultEmbeddingFunction()


def _get_client():
    return chromadb.PersistentClient(path=str(CHROMA_PATH))


def _get_collection():
    client = _get_client()
    ef = _embedding_function()
    try:
        return client.get_or_create_collection(name=COLLECTION_NAME, embedding_function=ef)
    except ValueError:
        # Collection was indexed with a different embedding function (e.g. before API key was set).
        try:
            client.delete_collection(COLLECTION_NAME)
        except Exception:
            pass
        global _indexed
        _indexed = False
        return client.get_or_create_collection(name=COLLECTION_NAME, embedding_function=ef)


def ensure_index() -> None:
    global _indexed
    if _indexed:
        return

    collection = _get_collection()
    if collection.count() > 0:
        _indexed = True
        return

    all_chunks: list[dict] = []
    for path in sorted(SEED_DATA_DIR.glob("*.md")):
        text = path.read_text(encoding="utf-8")
        all_chunks.extend(_chunk_markdown(text, path.name))

    if not all_chunks:
        _indexed = True
        return

    collection.add(
        ids=[f"chunk-{i}" for i in range(len(all_chunks))],
        documents=[c["content"] for c in all_chunks],
        metadatas=[{"source": c["source"]} for c in all_chunks],
    )
    _indexed = True


def search_handbook(query: str, top_k: int = 3) -> list[SearchResult]:
    ensure_index()
    collection = _get_collection()
    results = collection.query(query_texts=[query], n_results=top_k)

    search_results: list[SearchResult] = []
    if not results["documents"] or not results["documents"][0]:
        return search_results

    for doc, meta, dist in zip(
        results["documents"][0],
        results["metadatas"][0],
        results["distances"][0],
    ):
        search_results.append(
            SearchResult(
                content=doc,
                source=meta.get("source", "unknown"),
                score=1.0 - dist if dist is not None else 0.0,
            )
        )
    return search_results


def format_search_results(results: list[SearchResult]) -> str:
    if not results:
        return "No relevant handbook sections found."

    parts = []
    for i, r in enumerate(results, 1):
        parts.append(f"[{i}] Source: {r.source}\n{r.content}")
    return "\n\n".join(parts)
