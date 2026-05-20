"""
Config management for Jarvis with concurrent write safety.

Handles reading and writing configuration with file locking
to prevent concurrent write conflicts.
"""
import fcntl
import json
import logging
import tempfile
import time
from pathlib import Path

logger = logging.getLogger(__name__)


class LockTimeoutError(Exception):
    """Raised when lock acquisition times out."""
    pass


class Config:
    """Configuration manager with concurrent write protection."""

    LOCK_TIMEOUT = 5  # seconds
    LOCK_RETRY_DELAY = 0.01  # seconds between lock attempts

    def __init__(self, path=None):
        """
        Initialize Config manager.

        Args:
            path: Optional path to config file. Defaults to ~/.jarvis/config.json
        """
        if path is None:
            path = Path.home() / ".jarvis" / "config.json"
        else:
            path = Path(path)
        
        self.path = path
        self.data = {}
        
        # Ensure parent directory exists
        self.path.parent.mkdir(parents=True, exist_ok=True)
        
        # Load existing config if it exists
        if self.path.exists():
            try:
                with open(self.path) as f:
                    self.data = json.load(f)
            except (json.JSONDecodeError, IOError) as e:
                logger.warning(f"Failed to load config from {self.path}: {e}")
                self.data = {}

    def _acquire_lock_with_timeout(self, lock_file):
        """
        Acquire exclusive lock with timeout.
        
        Args:
            lock_file: Open file object to lock
            
        Raises:
            LockTimeoutError: If lock cannot be acquired within timeout
        """
        start_time = time.time()
        
        while True:
            try:
                # Non-blocking lock attempt
                fcntl.flock(lock_file, fcntl.LOCK_EX | fcntl.LOCK_NB)
                return  # Lock acquired successfully
            except (IOError, OSError) as e:
                elapsed = time.time() - start_time
                if elapsed > self.LOCK_TIMEOUT:
                    raise LockTimeoutError(
                        f"Config write timeout after {self.LOCK_TIMEOUT}s"
                    )
                # Wait a bit before retrying
                time.sleep(self.LOCK_RETRY_DELAY)

    def save(self):
        """
        Save configuration to file with fcntl locking.
        
        Acquires an exclusive lock on the config file before writing.
        Implements read-modify-write cycle to prevent data loss under
        concurrent access.
        
        Raises:
            LockTimeoutError: If lock cannot be acquired within timeout
            IOError: If file write fails
        """
        lock_file = None
        temp_file = None
        try:
            # Open config file in append mode to avoid truncating before lock
            lock_file = open(self.path, 'a')
            self._acquire_lock_with_timeout(lock_file)
            
            # Under lock: read latest state from disk
            if self.path.exists():
                try:
                    with open(self.path) as f:
                        disk_data = json.load(f)
                except (json.JSONDecodeError, IOError):
                    disk_data = {}
            else:
                disk_data = {}
            
            # Merge in-memory changes with disk state
            # In-memory state wins (represents current thread's changes)
            disk_data.update(self.data)
            
            # Create temporary file in same directory for atomic write
            temp_fd, temp_path = tempfile.mkstemp(
                dir=self.path.parent,
                prefix='.config_tmp_'
            )
            temp_file = open(temp_fd, 'w', closefd=True)
            
            # Write merged state to temp file
            json.dump(disk_data, temp_file, indent=2)
            temp_file.flush()
            temp_file.close()
            temp_file = None
            
            # Atomically replace original with temp (still under lock)
            Path(temp_path).replace(self.path)
            
            # Update in-memory state to match disk (consistency)
            self.data = disk_data
            
            logger.debug("Config saved with lock")
            
        except (IOError, OSError) as e:
            logger.error(f"Failed to save config to {self.path}: {e}")
            # Clean up temp file on error
            if temp_file is not None:
                try:
                    temp_file.close()
                except:
                    pass
            try:
                if temp_path and Path(temp_path).exists():
                    Path(temp_path).unlink()
            except:
                pass
            raise
        finally:
            if lock_file is not None:
                # Release lock and close file
                try:
                    fcntl.flock(lock_file, fcntl.LOCK_UN)
                except (IOError, OSError):
                    pass
                lock_file.close()

    def load(self):
        """Load configuration from file."""
        if self.path.exists():
            try:
                with open(self.path) as f:
                    self.data = json.load(f)
            except (json.JSONDecodeError, IOError) as e:
                logger.error(f"Failed to load config from {self.path}: {e}")
                raise

    def set(self, key, value):
        """Set a configuration value."""
        self.data[key] = value

    def get(self, key, default=None):
        """Get a configuration value."""
        return self.data.get(key, default)
