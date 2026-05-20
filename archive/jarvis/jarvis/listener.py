"""Listener service for Jarvis."""


class ListenerService:
    """Manages speech recognition and listening."""

    def __init__(self, recognizer):
        self.recognizer = recognizer

    def start(self):
        """Start listening."""
        self.recognizer.start()
