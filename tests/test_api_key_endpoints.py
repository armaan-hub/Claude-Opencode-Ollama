import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from universal_llm.api_key_endpoints import create_api_key_router


@pytest.fixture
def app():
    """Create a FastAPI app with the api_key router for testing."""
    app = FastAPI()
    router = create_api_key_router()
    app.include_router(router)
    return app


@pytest.fixture
def client(app):
    """Create a test client."""
    return TestClient(app)


class TestGetApiKeyStatus:
    """Test suite for GET /api/llm-settings/api-keys/status"""

    def test_get_api_key_status_returns_200(self, client):
        """Test that the endpoint returns a 200 status code."""
        response = client.get("/api/llm-settings/api-keys/status")
        assert response.status_code == 200

    def test_get_api_key_status_has_keys_field(self, client):
        """Test that response contains 'keys' field."""
        response = client.get("/api/llm-settings/api-keys/status")
        data = response.json()
        assert "keys" in data

    def test_get_api_key_status_keys_is_list(self, client):
        """Test that 'keys' field is a list."""
        response = client.get("/api/llm-settings/api-keys/status")
        data = response.json()
        assert isinstance(data["keys"], list)

    def test_get_api_key_status_masks_actual_keys(self, client):
        """Test that actual API keys are masked, never exposed."""
        response = client.get("/api/llm-settings/api-keys/status")
        data = response.json()
        
        # All configured keys should be masked
        for key_info in data["keys"]:
            if key_info.get("configured"):
                value = key_info.get("value", "")
                # Key should be masked with *** or show only last 4 chars
                assert "***" in value or len(value) <= 4

    def test_get_api_key_status_structure(self, client):
        """Test the structure of returned key objects."""
        response = client.get("/api/llm-settings/api-keys/status")
        data = response.json()
        
        if data["keys"]:
            key_info = data["keys"][0]
            assert "provider" in key_info
            assert "value" in key_info
            assert "configured" in key_info


class TestUpdateApiKey:
    """Test suite for POST /api/llm-settings/api-keys/update"""

    def test_update_api_key_success(self, client):
        """Test successful API key update."""
        response = client.post(
            "/api/llm-settings/api-keys/update",
            json={"provider": "openai", "key": "sk-test123456789"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "status" in data
        assert data["status"] == "updated"

    def test_update_api_key_with_different_providers(self, client):
        """Test updating different provider keys."""
        providers_and_keys = [
            ("openai", "sk-test123456789"),
            ("anthropic", "sk-ant-test123456789"),
            ("cohere", "test-cohere-key"),
            ("hugging_face", "hf_test123456789"),
        ]
        for provider, key in providers_and_keys:
            response = client.post(
                "/api/llm-settings/api-keys/update",
                json={"provider": provider, "key": key}
            )
            assert response.status_code == 200
            assert response.json()["status"] == "updated"

    def test_update_api_key_missing_provider(self, client):
        """Test update fails when provider is missing."""
        response = client.post(
            "/api/llm-settings/api-keys/update",
            json={"key": "sk-test123"}
        )
        assert response.status_code == 422

    def test_update_api_key_missing_key(self, client):
        """Test update fails when key is missing."""
        response = client.post(
            "/api/llm-settings/api-keys/update",
            json={"provider": "openai"}
        )
        assert response.status_code == 422

    def test_update_api_key_invalid_provider(self, client):
        """Test update fails with invalid provider."""
        response = client.post(
            "/api/llm-settings/api-keys/update",
            json={"provider": "invalid_provider", "key": "test-key"}
        )
        assert response.status_code == 400

    def test_update_api_key_empty_key(self, client):
        """Test update fails with empty key."""
        response = client.post(
            "/api/llm-settings/api-keys/update",
            json={"provider": "openai", "key": ""}
        )
        assert response.status_code == 400


class TestValidateApiKey:
    """Test suite for POST /api/llm-settings/api-keys/validate"""

    def test_validate_api_key_valid_format(self, client):
        """Test validation with valid key format."""
        response = client.post(
            "/api/llm-settings/api-keys/validate",
            json={"provider": "openai", "key": "sk-test123456789"}
        )
        # Should return 200 or 400 based on validation result
        assert response.status_code in [200, 400]

    def test_validate_api_key_missing_provider(self, client):
        """Test validation fails when provider is missing."""
        response = client.post(
            "/api/llm-settings/api-keys/validate",
            json={"key": "sk-test123"}
        )
        assert response.status_code == 422

    def test_validate_api_key_missing_key(self, client):
        """Test validation fails when key is missing."""
        response = client.post(
            "/api/llm-settings/api-keys/validate",
            json={"provider": "openai"}
        )
        assert response.status_code == 422

    def test_validate_api_key_invalid_provider(self, client):
        """Test validation fails with invalid provider."""
        response = client.post(
            "/api/llm-settings/api-keys/validate",
            json={"provider": "invalid_provider", "key": "test-key"}
        )
        assert response.status_code == 400

    def test_validate_api_key_returns_status(self, client):
        """Test that validation response includes status."""
        response = client.post(
            "/api/llm-settings/api-keys/validate",
            json={"provider": "openai", "key": "sk-test123"}
        )
        if response.status_code == 200:
            data = response.json()
            assert "status" in data
