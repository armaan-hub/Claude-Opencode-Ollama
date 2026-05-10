from __future__ import annotations

import re
from itertools import combinations
from typing import List


def _normalize_tokens(text: str) -> set[str]:
    tokens = re.findall(r"[a-z0-9]+", text.lower())
    stop_words = {
        "the",
        "and",
        "for",
        "that",
        "with",
        "from",
        "this",
        "into",
        "are",
        "was",
        "were",
        "have",
        "has",
        "had",
        "may",
        "can",
    }
    return {token for token in tokens if token not in stop_words}


def _multiple_sources_agree(docs: List[dict]) -> bool:
    normalized = [_normalize_tokens(doc.get("content", "")) for doc in docs]
    normalized = [tokens for tokens in normalized if tokens]

    if len(normalized) < 2:
        return False

    for a, b in combinations(normalized, 2):
        union = a | b
        if not union:
            continue
        jaccard = len(a & b) / len(union)
        if jaccard >= 0.6:
            return True

    return False


def _is_authoritative_source(doc: dict) -> bool:
    source = str(doc.get("source", "")).lower()
    content = str(doc.get("content", "")).lower()

    source_markers = ("official", "gov", "regulator", "standard", "nist", "iso", "fips")
    content_markers = ("must", "shall", "required", "requires")
    return any(marker in source for marker in source_markers) or any(
        marker in content for marker in content_markers
    )


def _fallback_synthesis(docs: List[dict]) -> str:
    key_points = []
    for index, doc in enumerate(docs, start=1):
        content = str(doc.get("content", "")).strip()
        source = str(doc.get("source", f"source_{index}")).strip() or f"source_{index}"
        if content:
            key_points.append(f"Source {source} indicates: {content}.")

    if not key_points:
        return (
            "No reliable evidence was retrieved for synthesis. Additional sources are needed "
            "to produce a grounded, actionable summary."
        )

    narrative = " ".join(key_points)
    return (
        "This synthesis consolidates key facts from retrieved documents into a single "
        "narrative for decision-making. "
        f"{narrative} "
        "Taken together, these findings outline practical compliance obligations, highlight "
        "where requirements align, and identify areas requiring further verification."
    )


def synthesize_docs(docs: List[dict], llm_client) -> str:
    """Extract key facts from docs and synthesize into coherent answer. Returns synthesized text."""
    docs = docs or []

    if hasattr(llm_client, "synthesize") and callable(llm_client.synthesize):
        synthesis = llm_client.synthesize(docs)
    elif callable(llm_client):
        synthesis = llm_client(docs)
    else:
        synthesis = _fallback_synthesis(docs)

    synthesis_text = str(synthesis).strip()
    if len(synthesis_text) < 100:
        synthesis_text = f"{synthesis_text} {_fallback_synthesis(docs)}".strip()

    return synthesis_text


def _compute_confidence(docs: List[dict]) -> float:
    if not docs:
        return 0.0

    if len(docs) >= 2:
        if _multiple_sources_agree(docs):
            return 0.92
        return 0.66

    if _is_authoritative_source(docs[0]):
        return 0.8
    return 0.6




def _ordered_unique_sources(docs: List[dict]) -> list[str]:
    seen = set()
    sources = []
    for doc in docs:
        source = doc.get("source")
        if not source or source in seen:
            continue
        seen.add(source)
        sources.append(source)
    return sources

def generate_report(docs: List[dict], query: str, llm_client) -> dict:
    """Generate report with synthesis, sources, confidence.

    Returns: {"synthesis": "...", "sources_used": [...], "confidence_score": 0.0-1.0}
    """
    synthesis = synthesize_docs(docs, llm_client)
    sources_used = _ordered_unique_sources(docs)
    confidence_score = float(_compute_confidence(docs))

    if query and query.lower() not in synthesis.lower():
        synthesis = (
            f"Query focus: {query}. "
            f"{synthesis}"
        )

    return {
        "synthesis": synthesis,
        "sources_used": sources_used,
        "confidence_score": max(0.0, min(1.0, confidence_score)),
    }
