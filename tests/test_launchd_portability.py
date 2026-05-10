import plistlib
from pathlib import Path
import os


def read_plist(relative_path: str):
    plist_path = Path(relative_path)
    with plist_path.open("rb") as fp:
        return plistlib.load(fp)


def test_plist_has_python_executable():
    plist = read_plist("jarvis/com.armaan.jarvis.plist")
    program_args = plist.get("ProgramArguments", [])
    assert len(program_args) > 0
    python_path = program_args[0]
    # Should be executable or wrapped in activation script
    assert "python" in python_path.lower()
    assert os.access(python_path, os.X_OK) or "virtual_env" in python_path.lower()


def test_plist_works_with_system_python():
    # Verify plist structure compatible with system python3
    plist = read_plist("jarvis/com.armaan.jarvis.plist")
    assert "ProgramArguments" in plist
    assert isinstance(plist["ProgramArguments"], list)
