"""Integration tests for Jarvis components (must use real modules)."""

from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from jarvis.config import Config
from jarvis.chat_interface import ChatInterface
from jarvis.listener import ListenerService
from jarvis.lmstudio import LMStudioClient


@pytest.fixture
def config_file(tmp_path: Path) -> Path:
    config_path = tmp_path / "config.json"
    config_path.write_text('{"model": "gpt-5-mini"}', encoding="utf-8")
    return config_path


@pytest.fixture
def mock_recognizer() -> MagicMock:
    recognizer = MagicMock()
    recognizer.start.return_value = None
    return recognizer


def test_config_loads(config_file: Path):
    """Integration: Config loads and stores real data."""
    config = Config(path=config_file)
    model = config.get("model")
    assert config is not None
    assert model == "gpt-5-mini"


def test_listener_startup(mock_recognizer: MagicMock):
    """Integration: Listener service can be instantiated and started."""
    listener = ListenerService(recognizer=mock_recognizer)
    listener.start()
    mock_recognizer.start.assert_called_once()


def test_skill_loading_integration(tmp_path: Path):
    """Integration: ChatInterface loads real Python skill files."""
    skills_dir = tmp_path / "skills"
    skills_dir.mkdir(parents=True)

    (skills_dir / "alpha_skill.py").write_text(
        "NAME = 'alpha'\nVERSION = '1.0'\n",
        encoding="utf-8"
    )

    interface = ChatInterface(skills_dir=skills_dir)
    skills = interface.list_skills()

    assert "alpha_skill" in skills
    assert len(skills) >= 1

    # Verify skill module was actually loaded (not a stub)
    assert hasattr(interface.loaded_skills["alpha_skill"], "NAME")
    assert interface.loaded_skills["alpha_skill"].NAME == "alpha"


def test_lmstudio_connection_mock():
    """Integration: LMStudioClient initializes and can check availability (with mocked HTTP)."""
    response_mock = MagicMock()
    response_mock.__enter__.return_value.status = 200

    with patch("urllib.request.urlopen", return_value=response_mock) as mock_urlopen:
        client = LMStudioClient(base_url="http://localhost:1234")
        is_available = client.is_available()

        assert is_available is True
        mock_urlopen.assert_called_once()
        called_url = mock_urlopen.call_args[0][0]
        assert "http://localhost:1234/v1/models" in called_url
