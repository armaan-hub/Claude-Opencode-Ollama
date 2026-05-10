import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from universal_llm.embedding_endpoints import create_embedding_router


@pytest.fixture
def app():
    app = FastAPI()
    app.include_router(create_embedding_router())
    return app


@pytest.fixture
def client(app):
    return TestClient(app)


@pytest.mark.asyncio
async def test_get_embedding_providers(client):
    response = client.get("/api/llm-settings/embeddings/providers")
    assert response.status_code == 200
    data = response.json()
    assert len(data["providers"]) > 0
    assert all("name" in p and "config_schema" in p for p in data["providers"])


@pytest.mark.asyncio
async def test_set_active_embedding_provider(client):
    response = client.post(
        "/api/llm-settings/embeddings/set-active",
        json={"provider": "openai", "config": {"model": "text-embedding-3-large"}},
    )
    assert response.status_code == 200
    assert response.json() == {"status": "activated"}


@pytest.mark.asyncio
async def test_test_embedding_provider(client):
    response = client.post(
        "/api/llm-settings/embeddings/test",
        json={"provider": "openai", "config": {"model": "text-embedding-3-small"}},
    )
    assert response.status_code in [200, 400]


@pytest.mark.asyncio
async def test_embedding_status_returns_active_provider(client):
    client.post(
        "/api/llm-settings/embeddings/set-active",
        json={"provider": "cohere", "config": {"model": "embed-english-v3.0"}},
    )
    response = client.get("/api/llm-settings/embeddings/status")
    assert response.status_code == 200
    data = response.json()
    assert data["active_provider"] == "cohere"
    assert data["config"]["model"] == "embed-english-v3.0"
    assert "metrics" in data


@pytest.mark.asyncio
async def test_set_active_embedding_provider_rejects_unknown_provider(client):
    response = client.post(
        "/api/llm-settings/embeddings/set-active",
        json={"provider": "unknown", "config": {"model": "x"}},
    )
    assert response.status_code == 400
