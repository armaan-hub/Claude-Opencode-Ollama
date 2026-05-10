from __future__ import annotations

import re
from typing import List

_JURISDICTIONS = [
    (r"\bU\.?S\.?A?\b|\bUnited States\b", "US"),
    (r"\bE\.?U\.?\b|\bEuropean Union\b", "EU"),
    (r"\bChina\b", "China"),
    (r"\bCanada\b", "Canada"),
    (r"\bU\.?K\.?\b|\bUnited Kingdom\b|\bBritain\b", "UK"),
    (r"\bIndia\b", "India"),
    (r"\bJapan\b", "Japan"),
    (r"\bAustralia\b", "Australia"),
]

_TOPIC_PATTERNS = [
    r"competitive landscape",
    r"market(?:\s+analysis)?",
    r"ai regulations?",
    r"tax law",
    r"healthcare",
    r"regulations?",
    r"compliance",
    r"policy",
    r"risk",
]

_FILLER_PATTERNS = [
    r"\bcompare\b",
    r"\banaly[sz]e\b",
    r"\bfor\b",
    r"\bin\b",
    r"\band\b",
    r"\bof\b",
    r"\bthe\b",
]

_TIME_PATTERNS = [
    r"\b(?:20\d{2}|19\d{2})\s*(?:-|to|through|until)\s*(?:20\d{2}|19\d{2})\b",
    r"\b(?:20\d{2}|19\d{2})\b",
    r"\blast\s+\d+\s+years\b",
    r"\b(?:Q[1-4]\s+)?(?:20\d{2}|19\d{2})\b",
]


def _extract_jurisdictions(query: str) -> List[str]:
    matches = []
    for pattern, label in _JURISDICTIONS:
        for m in re.finditer(pattern, query, flags=re.IGNORECASE):
            matches.append((m.start(), label))

    seen = set()
    ordered = []
    for _, label in sorted(matches, key=lambda item: item[0]):
        if label not in seen:
            seen.add(label)
            ordered.append(label)
    return ordered


def _extract_time_ranges(query: str) -> List[str]:
    matches = []
    for pattern in _TIME_PATTERNS:
        for m in re.finditer(pattern, query, flags=re.IGNORECASE):
            matches.append((m.start(), m.group(0).strip()))

    seen = set()
    ordered = []
    for _, value in sorted(matches, key=lambda item: item[0]):
        normalized = re.sub(r"\s+", " ", value)
        if normalized.lower() not in seen:
            seen.add(normalized.lower())
            ordered.append(normalized)
    return ordered


def _extract_topics(query: str) -> List[str]:
    lowered = query.lower()
    found = []

    for pattern in _TOPIC_PATTERNS:
        for m in re.finditer(pattern, lowered):
            found.append((m.start(), re.sub(r"\s+", " ", m.group(0)).strip()))

    if not found:
        cleaned = lowered
        for pattern, _ in _JURISDICTIONS:
            cleaned = re.sub(pattern, " ", cleaned, flags=re.IGNORECASE)
        for pattern in _FILLER_PATTERNS + _TIME_PATTERNS:
            cleaned = re.sub(pattern, " ", cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r"[,;:]", " ", cleaned)
        pieces = [p.strip() for p in re.split(r"\band\b|/|,", cleaned) if p.strip()]
        found = [(idx, part) for idx, part in enumerate(pieces)]

    seen = set()
    topics = []
    for _, topic in sorted(found, key=lambda item: item[0]):
        normalized = topic.strip(" .")
        if normalized and normalized not in seen:
            seen.add(normalized)
            topics.append(normalized)

    return topics


def _compose_suffix(topics: List[str], time_ranges: List[str]) -> str:
    topic_part = " and ".join(topics) if topics else "analysis"
    if time_ranges:
        return f"{topic_part} ({', '.join(time_ranges)})"
    return topic_part


def decompose_query(query: str) -> List[str]:
    """Break complex query into sub-queries for multi-stage retrieval.

    Returns list of sub-query strings.
    """
    text = query.strip()
    if not text:
        return []

    jurisdictions = _extract_jurisdictions(text)
    topics = _extract_topics(text)
    time_ranges = _extract_time_ranges(text)

    steps: List[str] = []

    if jurisdictions:
        suffix = _compose_suffix(topics, time_ranges)
        steps.extend([f"{jurisdiction} {suffix}".strip() for jurisdiction in jurisdictions])
    elif len(topics) > 1:
        scope = ""
        if time_ranges:
            scope = f" ({', '.join(time_ranges)})"
        steps.extend([f"{topic.capitalize()}{scope}".strip() for topic in topics])
    else:
        steps.append(text)

    return [step for step in steps if step and step.strip()]
