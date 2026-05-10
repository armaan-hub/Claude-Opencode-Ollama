"""Chat interface with dynamic skills loading."""

from __future__ import annotations

import importlib
import logging
import sys
from pathlib import Path
from threading import Lock
from types import ModuleType

logger = logging.getLogger(__name__)


class ChatInterface:
    """Manage runtime skills with optional hot-reload support."""

    def __init__(self, skills_dir: str | Path | None = None, watch_skills: bool = False):
        self.skills_dir = Path(skills_dir) if skills_dir else Path(__file__).resolve().parent / "skills"
        self.skills_dir.mkdir(parents=True, exist_ok=True)
        skills_path = str(self.skills_dir.resolve())
        if skills_path not in sys.path:
            sys.path.insert(0, skills_path)
        self.loaded_skills: dict[str, ModuleType] = {}
        self._skill_mtimes: dict[str, int] = {}
        self._lock = Lock()
        self._observer = None

        self.reload_skills(force=True)

        if watch_skills:
            self._start_watcher()

    def list_skills(self) -> list[str]:
        """Return loaded skills names."""
        return sorted(self.loaded_skills.keys())

    def load_skill(self, skill_name: str) -> bool:
        """Load a single skill module by file name."""
        with self._lock:
            return self._load_skill_unlocked(skill_name)

    def reload_skills(self, force: bool = False) -> list[str]:
        """Reload changed skills and load newly added skills."""
        reloaded: list[str] = []

        with self._lock:
            for skill_file in self._iter_skill_files():
                name = skill_file.stem
                mtime = skill_file.stat().st_mtime_ns
                is_loaded = name in self.loaded_skills
                changed = force or (self._skill_mtimes.get(name) != mtime)

                if not is_loaded:
                    if self._load_skill_unlocked(name):
                        reloaded.append(name)
                    continue

                if not changed:
                    continue

                try:
                    module = self.loaded_skills[name]
                    importlib.reload(module)
                    self._execute_skill_module(module, skill_file)
                    self._skill_mtimes[name] = mtime
                    reloaded.append(name)
                except Exception as exc:
                    logger.exception("Failed to reload skill '%s': %s", name, exc)

        return sorted(set(reloaded))

    def _iter_skill_files(self) -> list[Path]:
        return sorted(
            path
            for path in self.skills_dir.glob("*.py")
            if path.name != "__init__.py"
        )

    def _load_skill_unlocked(self, skill_name: str) -> bool:
        skill_file = self.skills_dir / f"{skill_name}.py"
        if not skill_file.exists():
            return False

        try:
            importlib.invalidate_caches()
            if skill_name in sys.modules:
                del sys.modules[skill_name]
            module = importlib.import_module(skill_name)
            # importlib.import_module() already executes module code.
            # Avoid executing again to prevent double-running skill side effects.

            self.loaded_skills[skill_name] = module
            self._skill_mtimes[skill_name] = skill_file.stat().st_mtime_ns
            return True
        except Exception as exc:
            logger.exception("Failed to load skill '%s': %s", skill_name, exc)
            return False

    def _execute_skill_module(self, module: ModuleType, skill_file: Path) -> None:
        source = skill_file.read_text(encoding="utf-8")
        code = compile(source, str(skill_file), "exec")
        exec(code, module.__dict__)

    def _start_watcher(self) -> None:
        try:
            from watchdog.events import FileSystemEventHandler
            from watchdog.observers import Observer
        except Exception:
            logger.debug("watchdog not available; skipping filesystem watcher")
            return

        interface = self

        class _SkillChangeHandler(FileSystemEventHandler):
            def on_any_event(self, event):  # type: ignore[override]
                if event.is_directory:
                    return
                if str(event.src_path).endswith(".py"):
                    interface.reload_skills()

        self._observer = Observer()
        self._observer.daemon = True
        self._observer.schedule(_SkillChangeHandler(), str(self.skills_dir), recursive=False)
        self._observer.start()

    def close(self) -> None:
        """Stop filesystem watcher if it was started."""
        if self._observer is None:
            return
        self._observer.stop()
        self._observer.join(timeout=2)
        self._observer = None
