"""
API Key Visibility Endpoints for Universal LLM Settings.

Provides FastAPI endpoints for managing and viewing API keys with proper masking.
"""
import json
import os
import re
from pathlib import Path
from typing import Any, Dict, List, Literal, Optional

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

# Supported LLM providers
SUPPORTED_PROVIDERS = {"openai", "anthropic", "cohere", "hugging_face"}

# Store keys in a JSON file in the current directory
KEYS_FILE = Path("api_keys.json")


class ApiKeyStatusResponse(BaseModel):
    """Response model for API key status."""
    keys: List[Dict[str, Any]] = Field(default_factory=list)


class ApiKeyUpdateRequest(BaseModel):
    """Request model for updating an API key."""
    provider: str
    key: str


class ApiKeyValidationRequest(BaseModel):
    """Request model for validating an API key."""
    provider: str
    key: str


class ApiKeyValidationResponse(BaseModel):
    """Response model for API key validation."""
    status: Literal["valid"]


class ApiKeyUpdateResponse(BaseModel):
    """Response model for API key update."""
    status: Literal["updated"]


def _load_keys() -> Dict[str, str]:
    """Load API keys from storage."""
    if KEYS_FILE.exists():
        try:
            with open(KEYS_FILE, "r") as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError):
            return {}
    return {}


def _save_keys(keys: Dict[str, str]) -> None:
    """Save API keys to storage."""
    with open(KEYS_FILE, "w") as f:
        json.dump(keys, f)


def _mask_key(key: str) -> str:
    """
    Mask an API key for display.
    
    Shows only the last 4 characters or uses *** if key is short.
    """
    if len(key) <= 4:
        return "***"
    return f"***{key[-4:]}"


def _validate_key_format(provider: str, key: str) -> bool:
    """
    Validate key format based on provider.
    
    Args:
        provider: The LLM provider name
        key: The API key to validate
        
    Returns:
        True if the key format is valid for the provider
    """
    if not key or not provider:
        return False
    
    # Provider-specific validation patterns
    validators = {
        "openai": r"^sk-[A-Za-z0-9-]+$",
        "anthropic": r"^sk-ant-[A-Za-z0-9-]+$|^[A-Za-z0-9-]+$",
        "cohere": r"^[A-Za-z0-9-]+$",
        "hugging_face": r"^hf_[A-Za-z0-9]+$|^[A-Za-z0-9_]+$",
    }
    
    if provider not in validators:
        return False
    
    pattern = validators[provider]
    return bool(re.match(pattern, key))


def create_api_key_router() -> APIRouter:
    """
    Create and return the API key management router.
    
    Returns:
        APIRouter configured with API key endpoints
    """
    router = APIRouter(prefix="/api/llm-settings/api-keys", tags=["api-keys"])

    @router.get("/status", response_model=ApiKeyStatusResponse)
    def get_api_key_status():
        """
        Get status of all configured API keys.
        
        Returns masked keys to prevent exposure.
        """
        keys = _load_keys()
        key_statuses = []
        
        for provider in SUPPORTED_PROVIDERS:
            key_info = {
                "provider": provider,
                "value": _mask_key(keys[provider]) if provider in keys else "***",
                "configured": provider in keys,
            }
            key_statuses.append(key_info)
        
        return ApiKeyStatusResponse(keys=key_statuses)

    @router.post("/update", response_model=ApiKeyUpdateResponse)
    def update_api_key(request: ApiKeyUpdateRequest):
        """
        Update or set an API key for a provider.
        
        Args:
            request: Contains provider and key
            
        Returns:
            Confirmation of update
            
        Raises:
            HTTPException: If request is invalid
        """
        # Validate input
        if not request.provider or not request.key:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="provider and key are required"
            )
        
        if request.provider not in SUPPORTED_PROVIDERS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported provider. Supported: {', '.join(SUPPORTED_PROVIDERS)}"
            )
        
        if not _validate_key_format(request.provider, request.key):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid key format for provider {request.provider}"
            )
        
        # Load, update, and save keys
        keys = _load_keys()
        keys[request.provider] = request.key
        _save_keys(keys)
        
        return ApiKeyUpdateResponse(status="updated")

    @router.post("/validate", response_model=ApiKeyValidationResponse)
    def validate_api_key(request: ApiKeyValidationRequest):
        """
        Validate an API key format without storing it.
        
        Args:
            request: Contains provider and key to validate
            
        Returns:
            Validation status
            
        Raises:
            HTTPException: If validation fails or request is invalid
        """
        # Validate input
        if not request.provider or not request.key:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="provider and key are required"
            )
        
        if request.provider not in SUPPORTED_PROVIDERS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported provider. Supported: {', '.join(SUPPORTED_PROVIDERS)}"
            )
        
        if not _validate_key_format(request.provider, request.key):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid key format for provider {request.provider}"
            )
        
        return ApiKeyValidationResponse(status="valid")

    return router
