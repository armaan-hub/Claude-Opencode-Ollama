from pathlib import Path
import tempfile
import time

from jarvis.chat_interface import ChatInterface


def test_skills_can_be_reloaded():
    with tempfile.TemporaryDirectory(dir=Path("tests")) as runtime_dir:
        skills_dir = Path(runtime_dir) / "skills"
        skills_dir.mkdir(exist_ok=True)

        skill_file = skills_dir / "sample_skill.py"
        skill_file.write_text("NAME = 'v1'\n", encoding="utf-8")

        interface = ChatInterface(skills_dir=skills_dir)
        skills1 = interface.list_skills()
        assert "sample_skill" in skills1
        assert interface.loaded_skills["sample_skill"].NAME == "v1"

        time.sleep(1.1)
        skill_file.write_text("NAME = 'v2'\n", encoding="utf-8")

        reloaded = interface.reload_skills()
        assert "sample_skill" in reloaded
        assert interface.loaded_skills["sample_skill"].NAME == "v2"


def test_dynamic_skill_loading():
    with tempfile.TemporaryDirectory(dir=Path("tests")) as runtime_dir:
        skills_dir = Path(runtime_dir) / "skills"
        skills_dir.mkdir(exist_ok=True)

        interface = ChatInterface(skills_dir=skills_dir)

        new_skill = skills_dir / "new_skill.py"
        new_skill.write_text("ENABLED = True\n", encoding="utf-8")

        success = interface.load_skill("new_skill")

        assert success
        assert "new_skill" in interface.list_skills()
        assert interface.loaded_skills["new_skill"].ENABLED is True
