from __future__ import annotations


DEEP_RESEARCH_KEYWORDS = {
    "compare",
    "analyze",
    "multiple",
    "jurisdiction",
    "across",
    "different",
    "contrast",
}

ANALYSIS_KEYWORDS = {
    "analyze",
    "detailed",
    "explain",
    "breakdown",
    "trend",
    "pattern",
}


def detect_query_complexity(query: str) -> str:
    """Returns 'fast', 'deep_research', or 'analysis'."""
    normalized = query.lower()

    if any(keyword in normalized for keyword in DEEP_RESEARCH_KEYWORDS):
        return "deep_research"

    if any(keyword in normalized for keyword in ANALYSIS_KEYWORDS):
        return "analysis"

    return "fast"


def route_query_to_llm(query: str, model_scores: dict) -> str:
    """Select best model from available models based on query requirements."""
    if not model_scores:
        raise ValueError("model_scores must not be empty")

    _ = query
    selected_model = max(model_scores, key=model_scores.get)
    if selected_model not in model_scores:
        raise KeyError("Selected model is not available")
    return selected_model
