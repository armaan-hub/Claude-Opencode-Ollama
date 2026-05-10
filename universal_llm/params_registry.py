from __future__ import annotations

from dataclasses import dataclass
from typing import Dict


@dataclass(frozen=True)
class ModeConfig:
    name: str
    max_tokens: int
    temperature: float
    top_p: float
    retrieval_steps: int


Registry = Dict[str, ModeConfig]


class LLMParamsRegistry:
    _instance: "LLMParamsRegistry | None" = None

    def __init__(self, modes: Registry):
        self._modes = modes

    @classmethod
    def load(cls) -> "LLMParamsRegistry":
        if cls._instance is None:
            cls._instance = cls(
                {
                    "fast": ModeConfig(
                        name="fast",
                        max_tokens=4096,
                        temperature=0.3,
                        top_p=0.9,
                        retrieval_steps=1,
                    ),
                    "deep_research": ModeConfig(
                        name="deep_research",
                        max_tokens=32768,
                        temperature=0.7,
                        top_p=0.95,
                        retrieval_steps=3,
                    ),
                    "analysis": ModeConfig(
                        name="analysis",
                        max_tokens=32768,
                        temperature=0.5,
                        top_p=0.95,
                        retrieval_steps=2,
                    ),
                }
            )
        return cls._instance

    def get_mode(self, mode_name: str) -> ModeConfig:
        key = mode_name.strip().lower()
        if key not in self._modes:
            raise KeyError(f"Unknown mode: {mode_name}")
        return self._modes[key]
