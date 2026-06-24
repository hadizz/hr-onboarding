#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
export PYTHONPATH="$ROOT:$ROOT/backend"
export OPENAI_API_KEY="${OPENAI_API_KEY:?Set OPENAI_API_KEY}"

if [ ! -d "$ROOT/.venv" ]; then
  python3 -m venv "$ROOT/.venv"
  "$ROOT/.venv/bin/pip" install -r "$ROOT/backend/requirements.txt" -r "$ROOT/evals/requirements.txt"
fi

exec "$ROOT/.venv/bin/uvicorn" app.main:app --reload --app-dir "$ROOT/backend" --host 0.0.0.0 --port 8000
