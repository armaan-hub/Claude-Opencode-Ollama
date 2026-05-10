from __future__ import annotations

import re
from typing import List


def deduplicate_citations(citations: List[dict]) -> List[dict]:
    """Remove duplicate citations while preserving order."""
    unique: List[dict] = []
    seen_sources = set()

    for citation in citations or []:
        source = citation.get("source")
        if not source:
            unique.append(citation)
            continue
        if source in seen_sources:
            continue
        seen_sources.add(source)
        unique.append(citation)

    return unique


def _replace_claim_once(text: str, claim: str, replacement: str) -> str:
    pattern = re.compile(re.escape(claim), flags=re.IGNORECASE)
    return pattern.sub(replacement, text, count=1)


def _reference_line(index: int, citation: dict) -> str:
    source = citation.get("source", f"source-{index}")
    page = citation.get("page")
    url = citation.get("url")

    details = []
    if page is not None:
        details.append(f"p. {page}")
    if url:
        details.append(str(url))

    suffix = f" ({'; '.join(details)})" if details else ""
    return f"[{index}] {source}{suffix}"


def inject_citations(text: str, citations: List[dict], format: str = "inline") -> str:
    """Add citations to text (inline, footnote, apa, ieee)."""
    if not citations:
        return text

    mode = (format or "inline").lower()
    mode = "footnote" if mode == "ieee" else mode

    unique_citations = deduplicate_citations(citations)
    result = text

    if mode in {"footnote", "inline", "apa"}:
        for index, citation in enumerate(unique_citations, start=1):
            claim = citation.get("claim")
            source = citation.get("source", f"source-{index}")
            if not claim:
                continue

            if mode == "inline":
                replacement = lambda m, s=source: f"{m.group(0)} [source: {s}]"
                result = re.sub(re.escape(claim), replacement, result, count=1, flags=re.IGNORECASE)
            elif mode == "apa":
                page = citation.get("page")
                page_part = f", p. {page}" if page is not None else ""
                replacement = lambda m, s=source, p=page_part: f"{m.group(0)} ({s}{p})"
                result = re.sub(re.escape(claim), replacement, result, count=1, flags=re.IGNORECASE)
            else:
                result = _replace_claim_once(result, claim, f"[{index}]")

    if mode == "footnote":
        bibliography = "\n".join(
            _reference_line(index, citation) for index, citation in enumerate(unique_citations, start=1)
        )
        result = f"{result}\n\nReferences:\n{bibliography}"

    return result
