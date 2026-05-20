"""LMStudio client for connecting to local LLM."""

import urllib.request


class LMStudioClient:
    """Client for LMStudio API."""

    def __init__(self, base_url: str, opener=None):
        self.base_url = base_url.rstrip("/")
        self._opener = opener if opener else urllib.request.urlopen

    def is_available(self) -> bool:
        """Check if LMStudio server is available."""
        try:
            with self._opener(f"{self.base_url}/v1/models", timeout=2) as response:
                return getattr(response, "status", 500) == 200
        except Exception:
            return False
