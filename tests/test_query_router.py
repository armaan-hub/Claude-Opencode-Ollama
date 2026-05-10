from universal_llm.query_router import detect_query_complexity, route_query_to_llm


def test_detect_simple_query():
    mode = detect_query_complexity("What is machine learning?")
    assert mode == "fast"


def test_detect_complex_research_query():
    mode = detect_query_complexity(
        "Analyze and compare tax regulations across US, UK, and Canada for AI companies"
    )
    assert mode == "deep_research"


def test_detect_analytical_query():
    mode = detect_query_complexity("Provide detailed analysis of market trends")
    assert mode == "analysis"


def test_detect_complexity_with_none():
    """Should handle None input gracefully."""
    result = detect_query_complexity(None)
    assert result == "fast"


def test_detect_complexity_with_empty_string():
    """Should handle empty string."""
    result = detect_query_complexity("")
    assert result == "fast"


def test_detect_complexity_with_non_string():
    """Should handle non-string input."""
    result = detect_query_complexity(123)
    assert result == "fast"


def test_route_to_llm():
    llm = route_query_to_llm("Compare frameworks", {"gpt-4": 0.9, "claude-3": 0.8})
    assert llm in ["gpt-4", "claude-3"]
