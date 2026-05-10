from __future__ import annotations

import re
from typing import List, Tuple


DEFAULT_RULES = {
    "detect_pii": True,
    "legal_requires_citation": False,
}

PII_PATTERNS = (
    re.compile(r"\b\d{3}-\d{2}-\d{4}\b"),
    re.compile(r"\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b"),
    re.compile(r"(?:\(\d{3}\)\s*\d{3}-\d{4}|\b\d{3}-\d{3}-\d{4}\b)"),
    re.compile(r"\b(?:Patient|Person|Name)\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\b"),
)

LEGAL_KEYWORD_PATTERN = re.compile(r"\b(?:law|regulation|gdpr|requirement|must)\b", re.IGNORECASE)
CITATION_PATTERN = re.compile(r"\[(?:source|citation)\]", re.IGNORECASE)


def _detect_pii(response: str, issues: List[str]) -> None:
    if any(pattern.search(response) for pattern in PII_PATTERNS):
        issues.append("PII detected")


def _detect_legal_citation_issue(response: str, issues: List[str]) -> None:
    legal_matches = list(LEGAL_KEYWORD_PATTERN.finditer(response))
    if not legal_matches:
        return

    citation_matches = list(CITATION_PATTERN.finditer(response))
    if not citation_matches:
        issues.append("Legal claim missing citation")
        return

    nearby_citation_exists = any(
        abs(legal.start() - citation.start()) <= 120
        for legal in legal_matches
        for citation in citation_matches
    )
    if not nearby_citation_exists:
        issues.append("Legal claim missing nearby citation")


def check_compliance(response: str, rules: dict = None) -> Tuple[bool, List[str]]:
    """Validate response against compliance rules.

    Returns: (is_compliant, issues)
    """
    active_rules = {**DEFAULT_RULES, **(rules or {})}
    issues: List[str] = []

    if active_rules.get("detect_pii", True):
        _detect_pii(response, issues)

    if active_rules.get("legal_requires_citation", False):
        _detect_legal_citation_issue(response, issues)

    return len(issues) == 0, issues
