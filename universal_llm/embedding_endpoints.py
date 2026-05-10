"""
Embedding Provider UI Endpoints for Universal LLM Settings.
"""

from typing import Any, Dict, Literal, Optional

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field


EMBEDDING_PROVIDERS: Dict[str, Dict[str, Any]] = {
    "openai": {
        "config_schema": {
            "model": {
                "type": "string",
                "required": True,
                "allowed": ["text-embedding-3-small", "text-embedding-3-large"],
            },
            "api_key": {"type": "string", "required": False},
            "dimensions": {"type": "integer", "required": False},
        },
        "capabilities": {"max_dimensions": 3072, "supports_custom_dimensions": True},
    },
    "cohere": {
        "config_schema": {
            "model": {
                "type": "string",
                "required": True,
                "allowed": ["embed-english-v3.0", "embed-multilingual-v3.0"],
            },
            "api_key": {"type": "string", "required": False},
            "dimensions": {"type": "integer", "required": False},
        },
        "capabilities": {"max_dimensions": 1024, "supports_custom_dimensions": False},
    },
    "hugging_face": {
        "config_schema": {
            "model": {
                "type": "string",
                "required": True,
                "allowed": [
                    "sentence-transformers/all-MiniLM-L6-v2",
                    "BAAI/bge-large-en-v1.5",
                ],
            },
            "api_key": {"type": "string", "required": False},
            "dimensions": {"type": "integer", "required": False},
        },
        "capabilities": {"max_dimensions": 1024, "supports_custom_dimensions": False},
    },
    "local": {
        "config_schema": {
            "model": {
                "type": "string",
                "required": True,
                "allowed": ["bge-small-en-onnx", "all-minilm-l6-v2-onnx"],
            },
            "api_key": {"type": "string", "required": False},
            "dimensions": {"type": "integer", "required": False},
        },
        "capabilities": {"runtime": "onnx", "supports_custom_dimensions": True},
    },
}


class EmbeddingProviderRequest(BaseModel):
    provider: str
    config: Dict[str, Any] = Field(default_factory=dict)


class ActivateEmbeddingResponse(BaseModel):
    status: Literal["activated"]


class TestEmbeddingResponse(BaseModel):
    status: Literal["ok"]


class EmbeddingStatusResponse(BaseModel):
    active_provider: Optional[str]
    config: Dict[str, Any]
    metrics: Dict[str, Any]


class EmbeddingState:
    def __init__(self) -> None:
        self.active_provider: Optional[str] = None
        self.config: Dict[str, Any] = {}
        self.metrics: Dict[str, Any] = {
            "test_calls": 0,
            "activation_count": 0,
            "last_tested_provider": None,
        }


_state = EmbeddingState()


def _validate_provider_config(provider: str, config: Dict[str, Any]) -> None:
    if provider not in EMBEDDING_PROVIDERS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported provider: {provider}",
        )

    model_name = config.get("model")
    if not model_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="config.model is required",
        )

    allowed_models = EMBEDDING_PROVIDERS[provider]["config_schema"]["model"]["allowed"]
    if model_name not in allowed_models:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Model '{model_name}' is not supported for provider '{provider}'",
        )


def create_embedding_router() -> APIRouter:
    router = APIRouter(prefix="/api/llm-settings/embeddings", tags=["embeddings"])

    @router.get("/providers")
    def get_embedding_providers():
        providers = [
            {
                "name": name,
                "config_schema": data["config_schema"],
                "capabilities": data["capabilities"],
            }
            for name, data in EMBEDDING_PROVIDERS.items()
        ]
        return {"providers": providers}

    @router.post("/set-active", response_model=ActivateEmbeddingResponse)
    def set_active_embedding_provider(request: EmbeddingProviderRequest):
        _validate_provider_config(request.provider, request.config)
        _state.active_provider = request.provider
        _state.config = request.config
        _state.metrics["activation_count"] += 1
        return ActivateEmbeddingResponse(status="activated")

    @router.post("/test", response_model=TestEmbeddingResponse)
    def test_embedding_provider(request: EmbeddingProviderRequest):
        _validate_provider_config(request.provider, request.config)
        _state.metrics["test_calls"] += 1
        _state.metrics["last_tested_provider"] = request.provider
        return TestEmbeddingResponse(status="ok")

    @router.get("/status", response_model=EmbeddingStatusResponse)
    def get_embedding_status():
        return EmbeddingStatusResponse(
            active_provider=_state.active_provider,
            config=_state.config,
            metrics=_state.metrics,
        )

    return router
