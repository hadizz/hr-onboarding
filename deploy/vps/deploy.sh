#!/usr/bin/env bash
# Deploy hr-onboarding on the Zanbeel VPS (run on server or via CI SSH)
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/hr-onboarding}"
COMPOSE_FILE="${APP_DIR}/deploy/vps/docker-compose.yml"
SERVICE="${1:-all}"

cd "${APP_DIR}"

if [[ ! -f .env ]]; then
  echo "Missing ${APP_DIR}/.env — copy .env.example and set OPENAI_API_KEY"
  exit 1
fi

docker network inspect zanbeel >/dev/null 2>&1 || docker network create zanbeel

git fetch origin "${DEPLOY_BRANCH:-main}"
git checkout "${DEPLOY_BRANCH:-main}"
git reset --hard "origin/${DEPLOY_BRANCH:-main}"

case "${SERVICE}" in
  all)
    docker compose -f "${COMPOSE_FILE}" up -d --build --remove-orphans
    ;;
  backend)
    docker compose -f "${COMPOSE_FILE}" up -d --build backend
    ;;
  frontend)
    docker compose -f "${COMPOSE_FILE}" up -d --build frontend
    ;;
  *)
    docker compose -f "${COMPOSE_FILE}" up -d --build "${SERVICE}"
    ;;
esac

docker compose -f "${COMPOSE_FILE}" ps

echo ""
echo "URLs (after DNS propagates):"
echo "  API:      https://hr-api.xpotify.cc/health"
echo "  Frontend: https://hr.xpotify.cc"
