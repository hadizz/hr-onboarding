#!/usr/bin/env bash
# Create/update Cloudflare A records for hr-onboarding on xpotify.cc
set -euo pipefail

ZONE_NAME="${ZONE_NAME:-xpotify.cc}"
VPS_IP="${VPS_IP:-65.109.205.51}"
RECORDS=(hr-api hr hr-app)

: "${CF_API_EMAIL:?Set CF_API_EMAIL}"
: "${CF_API_KEY:?Set CF_API_KEY (Global API Key from Cloudflare profile)}"

command -v jq >/dev/null || { echo "jq required"; exit 1; }

ZONE_ID=$(curl -fsS -X GET "https://api.cloudflare.com/client/v4/zones?name=${ZONE_NAME}" \
  -H "X-Auth-Email: ${CF_API_EMAIL}" \
  -H "X-Auth-Key: ${CF_API_KEY}" \
  -H "Content-Type: application/json" | jq -r '.result[0].id')

if [[ -z "${ZONE_ID}" || "${ZONE_ID}" == "null" ]]; then
  echo "Zone not found: ${ZONE_NAME}"
  exit 1
fi

echo "Zone ${ZONE_NAME} → ${ZONE_ID}"

upsert_a() {
  local name="$1"
  local fqdn="${name}.${ZONE_NAME}"
  local existing
  existing=$(curl -fsS -X GET "https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/dns_records?type=A&name=${fqdn}" \
    -H "X-Auth-Email: ${CF_API_EMAIL}" \
    -H "X-Auth-Key: ${CF_API_KEY}" \
    -H "Content-Type: application/json" | jq -r '.result[0].id // empty')

  if [[ -n "${existing}" ]]; then
    echo "Updating ${fqdn}"
    curl -fsS -X PUT "https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/dns_records/${existing}" \
      -H "X-Auth-Email: ${CF_API_EMAIL}" \
      -H "X-Auth-Key: ${CF_API_KEY}" \
      -H "Content-Type: application/json" \
      --data "{\"type\":\"A\",\"name\":\"${name}\",\"content\":\"${VPS_IP}\",\"ttl\":300,\"proxied\":false}" | jq -r '.success'
  else
    echo "Creating ${fqdn}"
    curl -fsS -X POST "https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/dns_records" \
      -H "X-Auth-Email: ${CF_API_EMAIL}" \
      -H "X-Auth-Key: ${CF_API_KEY}" \
      -H "Content-Type: application/json" \
      --data "{\"type\":\"A\",\"name\":\"${name}\",\"content\":\"${VPS_IP}\",\"ttl\":300,\"proxied\":false}" | jq -r '.success'
  fi
}

for r in "${RECORDS[@]}"; do
  upsert_a "$r"
done

echo "Done. Verify:"
for r in "${RECORDS[@]}"; do
  echo "  dig +short ${r}.${ZONE_NAME}"
done
