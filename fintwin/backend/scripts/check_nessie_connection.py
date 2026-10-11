#!/usr/bin/env python3
"""Check that backend/.env can reach Capital One Nessie. Never prints the API key."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.connection import main

if __name__ == "__main__":
    raise SystemExit(main())
