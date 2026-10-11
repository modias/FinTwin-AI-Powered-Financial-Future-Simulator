"""Server configuration. API keys are read from the environment, never hardcoded."""

import os
import re
from pathlib import Path

from dotenv import load_dotenv
from pydantic import BaseModel, Field

BACKEND_ROOT = Path(__file__).resolve().parents[1]
ENV_FILE = BACKEND_ROOT / ".env"

# The committed example uses this placeholder. Treat it as "not configured".
_PLACEHOLDER_KEYS = {
    "",
    "replace_with_your_api_key",
    "replace_with_your_gemini_api_key",
}

_DEFAULT_BASE_URL = "https://api.nessieisreal.com"
_DEFAULT_TIMEOUT_SECONDS = 10.0
_DEFAULT_GEMINI_MODEL = "gemini-3.1-flash-lite"
_MODEL_PATTERN = r"^[A-Za-z0-9][A-Za-z0-9._-]{0,80}$"


class Settings(BaseModel):
    """Runtime settings. Keys are empty when the server is not configured."""

    api_key: str = ""
    base_url: str = _DEFAULT_BASE_URL
    timeout_seconds: float = Field(default=_DEFAULT_TIMEOUT_SECONDS, gt=0)
    gemini_api_key: str = ""
    gemini_model: str = _DEFAULT_GEMINI_MODEL

    @property
    def nessie_configured(self) -> bool:
        return bool(self.api_key)

    @property
    def gemini_configured(self) -> bool:
        return bool(self.gemini_api_key)


def load_settings(env_file: Path | None = ENV_FILE) -> Settings:
    """Load settings from the process environment, then from `backend/.env` if present.

    Existing environment variables win, so a test can set `NESSIE_API_KEY`
    without the local file overriding it. The placeholder in `.env.example`
    counts as a missing key.
    """

    if env_file is not None and env_file.is_file():
        load_dotenv(env_file, override=False)

    raw_key = os.environ.get("NESSIE_API_KEY", "").strip()
    api_key = "" if raw_key in _PLACEHOLDER_KEYS else raw_key
    raw_gemini_key = os.environ.get("GEMINI_API_KEY", "").strip()
    gemini_api_key = "" if raw_gemini_key in _PLACEHOLDER_KEYS else raw_gemini_key
    gemini_model = _gemini_model(os.environ.get("GEMINI_MODEL", _DEFAULT_GEMINI_MODEL))
    base_url = os.environ.get("NESSIE_BASE_URL", _DEFAULT_BASE_URL).strip().rstrip("/")
    timeout_raw = os.environ.get("NESSIE_TIMEOUT_SECONDS", str(_DEFAULT_TIMEOUT_SECONDS)).strip()

    try:
        timeout_seconds = float(timeout_raw)
    except ValueError:
        timeout_seconds = _DEFAULT_TIMEOUT_SECONDS

    if timeout_seconds <= 0:
        timeout_seconds = _DEFAULT_TIMEOUT_SECONDS

    if not base_url:
        base_url = _DEFAULT_BASE_URL

    return Settings(
        api_key=api_key,
        base_url=base_url,
        timeout_seconds=timeout_seconds,
        gemini_api_key=gemini_api_key,
        gemini_model=gemini_model,
    )


def _gemini_model(raw: str) -> str:
    model = raw.strip()

    if re.fullmatch(_MODEL_PATTERN, model):
        return model

    return _DEFAULT_GEMINI_MODEL
