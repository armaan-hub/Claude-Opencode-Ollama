"""Universal LLM settings package."""

from .llm_compute import compute_llm_params
from .params_registry import LLMParamsRegistry, ModeConfig
from .query_decomposer import decompose_query
from .query_router import detect_query_complexity, route_query_to_llm
from .synthesis_engine import generate_report, synthesize_docs

__all__ = [
    "compute_llm_params",
    "LLMParamsRegistry",
    "ModeConfig",
    "decompose_query",
    "detect_query_complexity",
    "route_query_to_llm",
    "synthesize_docs",
    "generate_report",
]
