#!/usr/bin/env bash
# Long-running Field RFI backend dev server (referenced by .cursor/environment.json).
# The app creates its SQLite schema and seeds demo data on startup via its lifespan hook.
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

if [[ ! -f backend/app/main.py || ! -x backend/.venv/bin/python ]]; then
  echo "run-backend: backend is not set up on this branch; nothing to start."
  exit 0
fi

cd backend
# shellcheck disable=SC1091
source .venv/bin/activate
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
