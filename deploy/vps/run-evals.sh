#!/usr/bin/env bash
# Run golden evals on the VPS (writes evals/results/latest.json for /admin/evals).
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/hr-onboarding}"
COMPOSE_FILE="${APP_DIR}/deploy/vps/docker-compose.yml"

cd "${APP_DIR}"
mkdir -p "${APP_DIR}/evals/results"

echo "==== Running golden evals ===="
docker compose -f "${COMPOSE_FILE}" --profile evals run --rm --build evals "$@"
