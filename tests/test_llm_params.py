import pytest

from universal_llm.llm_compute import compute_llm_params
from universal_llm.params_registry import LLMParamsRegistry


def test_llm_params_registry_loads():
    registry = LLMParamsRegistry.load()
    assert registry.get_mode("fast") is not None
    assert registry.get_mode("deep_research") is not None
    assert registry.get_mode("analysis") is not None


def test_compute_llm_params_fast_query():
    params = compute_llm_params("What is AI?", "fast", "gpt-4")
    assert params["max_tokens"] == 4096
    assert params["temperature"] == 0.3
    assert params["mode"] == "fast"


def test_compute_llm_params_research_query():
    params = compute_llm_params(
        "Compare legal frameworks in 5 jurisdictions",
        "deep_research",
        "gpt-4-turbo",
    )
    assert params["max_tokens"] == 32768
    assert params["temperature"] == 0.7
    assert "retrieval_steps" in params


def test_analysis_mode_params():
    params = compute_llm_params("Analyze market trends", "analysis", "claude-3")
    assert params["max_tokens"] == 32768
    assert params["temperature"] == 0.5
    assert params["top_p"] == 0.95


def test_unknown_mode_raises_error():
    with pytest.raises(KeyError, match="Unknown mode"):
        compute_llm_params("test", "invalid_mode", "gpt-4")


def test_empty_query_string():
    params = compute_llm_params("", "fast", "gpt-4")
    assert params["mode"] == "fast"
    assert params["max_tokens"] == 4096


def test_whitespace_only_query():
    params = compute_llm_params("   ", "fast", "gpt-4")
    assert params["mode"] == "fast"


def test_case_insensitive_mode_lookup():
    params1 = compute_llm_params("test", "FAST", "gpt-4")
    params2 = compute_llm_params("test", "fast", "gpt-4")
    assert params1["max_tokens"] == params2["max_tokens"]
