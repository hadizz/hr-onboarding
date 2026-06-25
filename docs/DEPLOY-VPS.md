# Deploy to VPS (xpotify.cc)

Host **hr-onboarding** on the Hetzner VPS shared with [Zanbeel](https://zanbeel.app), using the Traefik reverse proxy.

| URL | Service |
|-----|---------|
| https://hr-api.xpotify.cc | FastAPI backend |
| https://hr.xpotify.cc | React frontend |
| https://hr.xpotify.cc/admin/evals | Eval results dashboard |

**VPS:** `65.109.205.51` · **Path:** `/opt/hr-onboarding` · **Traefik network:** `zanbeel`

---

## Automatic deploys (GitHub Actions)

Workflow: [`.github/workflows/deploy-vps.yml`](../.github/workflows/deploy-vps.yml)

**Triggers on push to `main` when these paths change:**

- `backend/**`, `frontend/**`, `shared/**`, `seed-data/**`
- `evals/**`, `scripts/**`, `docker-compose.yml`, `deploy/vps/**`

**What runs on deploy:**

1. `git pull` on VPS
2. `docker compose up -d --build` (all services, or `backend` / `frontend` via manual dispatch)
3. **Golden evals** via `deploy/vps/run-evals.sh` after `all` or `backend` deploys (~10–15 min)
4. Results written to `/opt/hr-onboarding/evals/results/latest.json`

Eval results are **gitignored** — they only exist on the server after a deploy eval run or a manual `deploy.sh evals`. The backend mounts that directory; `/admin/evals` reads it through `GET /api/evals/results`.

**Deploy does not fail** when the golden pass rate is below 85%. A warning is logged; the site stays up and the report still updates.

CI timeouts: **45m** SSH command, **60m** job (evals need headroom).

### GitHub secrets

| Secret | Purpose |
|--------|---------|
| `VPS_SSH_HOST` | VPS IP or hostname |
| `VPS_SSH_USER` | SSH user (e.g. `root`) |
| `VPS_SSH_PRIVATE_KEY` | SSH private key |

---

## Manual deploy

```bash
# On VPS
bash /opt/hr-onboarding/deploy/vps/deploy.sh          # all + post-deploy evals
bash /opt/hr-onboarding/deploy/vps/deploy.sh backend  # backend + post-deploy evals
bash /opt/hr-onboarding/deploy/vps/deploy.sh frontend # frontend only (no evals)
bash /opt/hr-onboarding/deploy/vps/deploy.sh evals    # evals only
```

**GitHub:** Actions → **Deploy to VPS** → Run workflow (optional `service` input).

---

## DNS (Cloudflare)

Create **DNS only** (grey cloud) A records to the VPS IP:

- `hr-api.xpotify.cc`
- `hr.xpotify.cc`

TLS via Traefik + Let's Encrypt. Proxied (orange cloud) records can break certificate issuance.

---

## One-time bootstrap

```bash
git clone https://github.com/hadizz/hr-onboarding.git /opt/hr-onboarding
cp /root/hr-onboarding.env /opt/hr-onboarding/.env   # OPENAI_API_KEY required
bash /opt/hr-onboarding/deploy/vps/deploy.sh
```

Or use `deploy/vps/bootstrap-vps.sh` — see repo for full steps.

---

## Architecture

```
Internet :443
    │
    ▼
┌──────────┐
│ traefik  │  (shared with Zanbeel — /opt/zanbeel)
└────┬─────┘
     ├── hr-api.xpotify.cc ──► hr-onboarding-backend:8000
     │                              └── mounts evals/results/
     └── hr.xpotify.cc     ──► hr-onboarding-frontend:80
                                      └── /admin/evals
```

Compose: [`deploy/vps/docker-compose.yml`](../deploy/vps/docker-compose.yml)

---

## Verify

```bash
curl -s https://hr-api.xpotify.cc/health
# {"status":"ok"}

curl -s https://hr-api.xpotify.cc/api/evals/results | jq '.golden.available'
# true after evals have run
```

Open https://hr.xpotify.cc/admin/evals after deploy completes.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `/admin/evals` shows "No report yet" | Wait for post-deploy evals, or `bash deploy/vps/deploy.sh evals`. Local `evals/results/` is not synced to VPS. |
| Push to `main` did not deploy | Path filter — only listed directories trigger the workflow. Eval-only changes need `evals/**` in the filter (included since Jun 2025). |
| Deploy evals all fail: `failed to resolve host 'postgres'` | Evals container must be on `zanbeel` network (same as postgres). Fixed in compose — redeploy. |
| Stale API or blank admin after pull | `docker compose -f deploy/vps/docker-compose.yml up -d --build backend frontend` |
| Chat 500 | Set `OPENAI_API_KEY` in `/opt/hr-onboarding/.env` |
| Traefik 404 | Container must be on `zanbeel` network with correct labels |
| CORS errors | Frontend built with `VITE_API_URL=https://hr-api.xpotify.cc` |

---

## Related

- [EVALS.md](./EVALS.md) — golden harness, Docker evals, known failures
- [RUN.md](./RUN.md) — local dev and eval commands
- [SECURITY.md](./SECURITY.md) — prompt injection defenses
