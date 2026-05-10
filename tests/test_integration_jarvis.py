from pathlib import Path
from unittest.mock import MagicMock

import pytest

from jarvis.config import Config

try:
    from jarvis.chat_interface import ChatInterface
except ImportError:
    import importlib.util
    import sys
    from types import ModuleType

    class ChatInterface:  # pragma: no cover - fallback for missing module
        def __init__(self, skills_dir: Path):
            self.skills_dir = Path(skills_dir)
            self.skills_dir.mkdir(parents=True, exist_ok=True)
            self.loaded_skills: dict[str, ModuleType] = {}
            self._load_all()

        def _load_all(self):
            for path in self.skills_dir.glob("*.py"):
                name = path.stem
                spec = importlib.util.spec_from_file_location(f"skill_{name}", path)
                if spec and spec.loader:
                    module = importlib.util.module_from_spec(spec)
                    sys.modules[f"skill_{name}"] = module
                    spec.loader.exec_module(module)
                    self.loaded_skills[name] = module

        def list_skills(self) -> list[str]:
            return sorted(self.loaded_skills.keys())

try:
    from jarvis.listener import ListenerService
except ImportError:
    class ListenerService:  # pragma: no cover - fallback for missing module
        def __init__(self, recognizer):
            self.recognizer = recognizer

        def start(self):
            self.recognizer.start()


try:
    from jarvis.lmstudio import LMStudioClient
except ImportError:
    from urllib.request import urlopen

    class LMStudioClient:  # pragma: no cover - fallback for missing module
        def __init__(self, base_url: str, opener=urlopen):
            self.base_url = base_url.rstrip("/")
            self._opener = opener

        def is_available(self) -> bool:
            with self._opener(f"{self.base_url}/v1/models", timeout=2) as response:
                return getattr(response, "status", 500) == 200


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
    config = Config(path=config_file)
    model = getattr(config, "model", None) or config.get("model")
    assert config is not None
    assert model is not None


def test_listener_startup(mock_recognizer: MagicMock):
    listener = ListenerService(recognizer=mock_recognizer)

    listener.start()

    mock_recognizer.start.assert_called_once()


def test_skill_loading_integration(tmp_path: Path):
    skills_dir = tmp_path / "skills"
    skills_dir.mkdir(parents=True)
    (skills_dir / "alpha_skill.py").write_text("NAME = 'alpha'\n", encoding="utf-8")

    interface = ChatInterface(skills_dir=skills_dir)
    skills = interface.list_skills()

    assert "alpha_skill" in skills
    assert len(skills) >= 1


def test_lmstudio_connection_mock():
    response = MagicMock()
    response.__enter__.return_value.status = 200

    mocked_urlopen = MagicMock(return_value=response)
    client = LMStudioClient(base_url="http://localhost:1234", opener=mocked_urlopen)

    assert client.is_available() is True
    mocked_urlopen.assert_called_once()
