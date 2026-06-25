#!/usr/bin/env bash
# One-time bootstrap on Hetzner VPS (run as root)
set -euo pipefail

APP_DIR="/opt/hr-onboarding"
REPO_URL="${REPO_URL:-https://github.com/hadizz/hr-onboarding.git}"
BRANCH="${BRANCH:-main}"

if [[ ! -d "${APP_DIR}/.git" ]]; then
  git clone --branch "${BRANCH}" "${REPO_URL}" "${APP_DIR}"
fi

if [[ ! -f "${APP_DIR}/.env" ]]; then
  if [[ -f /root/hr-onboarding.env ]]; then
    cp /root/hr-onboarding.env "${APP_DIR}/.env"
  else
    cp "${APP_DIR}/.env.example" "${APP_DIR}/.env"
    echo "Edit ${APP_DIR}/.env and set OPENAI_API_KEY, then re-run deploy.sh"
    exit 1
  fi
fi

docker network inspect zanbeel >/dev/null 2>&1 || docker network create zanbeel

chmod +x "${APP_DIR}/deploy/vps/deploy.sh" "${APP_DIR}/deploy/dns/apply-xpotify-dns.sh"
bash "${APP_DIR}/deploy/vps/deploy.sh"
