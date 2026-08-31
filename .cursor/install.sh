#!/usr/bin/env bash
# Idempotent dev-environment setup for the Field RFI FastAPI backend.
# Safe to run repeatedly and on branches that do not carry the backend slice.
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

if [[ ! -f backend/requirements.txt ]]; then
  echo "install: backend/requirements.txt not found on this branch; nothing to set up."
  exit 0
fi

# The default image ships Python 3.12 but not the venv module. Install it once.
if ! python3 -c "import ensurepip" >/dev/null 2>&1; then
  echo "install: installing the python venv package…"
  pyver="$(python3 -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')"
  sudo apt-get update -qq
  sudo apt-get install -y -qq python3-venv || sudo apt-get install -y -qq "python${pyver}-venv"
fi

cd backend
if [[ ! -x .venv/bin/python ]]; then
  python3 -m venv .venv
fi
# shellcheck disable=SC1091
source .venv/bin/activate
python -m pip install --upgrade pip
pip install -r requirements.txt

echo "install: backend dependencies ready."
