from __future__ import annotations

from universal_llm.params_registry import LLMParamsRegistry


def _estimate_tokens(text: str) -> int:
    cleaned = text.strip()
    if not cleaned:
        return 0
    return max(1, len(cleaned) // 4)


def compute_llm_params(query: str, mode: str, model: str) -> dict:
    """Returns dict with mode, max_tokens, temperature, top_p, retrieval_steps."""
    config = LLMParamsRegistry.load().get_mode(mode)
    estimated_query_tokens = _estimate_tokens(query)
    estimated_context_tokens = min(config.max_tokens, estimated_query_tokens * max(1, config.retrieval_steps))

    return {
        "mode": config.name,
        "model": model,
        "max_tokens": config.max_tokens,
        "temperature": config.temperature,
        "top_p": config.top_p,
        "retrieval_steps": config.retrieval_steps,
        "estimated_query_tokens": estimated_query_tokens,
        "estimated_context_tokens": estimated_context_tokens,
    }
