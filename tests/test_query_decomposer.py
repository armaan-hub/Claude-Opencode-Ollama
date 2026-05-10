from universal_llm.query_decomposer import decompose_query


def test_decompose_complex_query():
    steps = decompose_query("Compare AI regulations in US, EU, and China for healthcare")
    assert len(steps) >= 3
    assert any("US" in step for step in steps)
    assert any("EU" in step for step in steps)
    assert any("China" in step for step in steps)


def test_decompose_returns_list_of_strings():
    steps = decompose_query("Analyze market and competitive landscape")
    assert all(isinstance(s, str) for s in steps)
    assert all(len(s.strip()) > 0 for s in steps)


def test_decompose_with_none():
    """Should handle None input gracefully."""
    result = decompose_query(None)
    assert result == []


def test_decompose_with_empty_string():
    """Should handle empty string."""
    result = decompose_query("")
    assert result == []


def test_decompose_with_whitespace():
    """Should handle whitespace-only string."""
    result = decompose_query("   ")
    assert result == []
