# Deploy to VPS (xpotify.cc)

Host **hr-onboarding** on the same Hetzner VPS as [Zanbeel](https://zanbeel.app), using the shared Traefik reverse proxy.

| URL | Service |
|-----|---------|
| https://hr-api.xpotify.cc | FastAPI backend |
| https://hr.xpotify.cc | React frontend |

**VPS:** `65.109.205.51` · **Path:** `/opt/hr-onboarding` · **Traefik network:** `zanbeel`

---

## DNS (Cloudflare)

Import [`deploy/dns/xpotify.cc.txt`](dns/xpotify.cc.txt) or run:

```bash
export CF_API_EMAIL=hadizareoriginal@gmail.com
export CF_API_KEY=your-global-api-key   # Profile → API Tokens → Global API Key
bash deploy/dns/apply-xpotify-dns.sh
```

Records must be **DNS only** (grey cloud / `proxied: false`) so Traefik can obtain Let's Encrypt certificates.

Verify:

```bash
dig +short hr-api.xpotify.cc
dig +short hr.xpotify.cc
# Both should return 65.109.205.51
```

---

## One-time VPS setup

SSH uses a **deploy key** (same pattern as `/opt/zanbeel`). Password auth is disabled on the server.

### 1. Bootstrap on VPS (as root)

```bash
# On your laptop (one-time): add GitHub Actions deploy public key to VPS
ssh root@65.109.205.51 'mkdir -p ~/.ssh && echo "YOUR_DEPLOY_PUBLIC_KEY" >> ~/.ssh/authorized_keys'

# Create secrets file on VPS
ssh root@65.109.205.51 'cat > /root/hr-onboarding.env <<EOF
OPENAI_API_KEY=sk-your-key-here
EOF'

# Clone and deploy
ssh root@65.109.205.51 'curl -fsSL https://raw.githubusercontent.com/hadizz/hr-onboarding/main/deploy/vps/bootstrap-vps.sh | bash'
```

Or manually:

```bash
git clone https://github.com/hadizz/hr-onboarding.git /opt/hr-onboarding
cp /root/hr-onboarding.env /opt/hr-onboarding/.env
bash /opt/hr-onboarding/deploy/vps/deploy.sh
```

### 2. GitHub Actions secrets

| Secret | Purpose |
|--------|---------|
| `VPS_SSH_PRIVATE_KEY` | SSH private key (matches public key on VPS) |
| `CF_API_EMAIL` | Cloudflare account email |
| `CF_API_KEY` | Cloudflare Global API Key (for DNS workflow) |

Workflow: [`.github/workflows/deploy-vps.yml`](../.github/workflows/deploy-vps.yml)

---

## Ongoing deploys

```bash
# On VPS
bash /opt/hr-onboarding/deploy/vps/deploy.sh          # all
bash /opt/hr-onboarding/deploy/vps/deploy.sh backend
bash /opt/hr-onboarding/deploy/vps/deploy.sh frontend
```

**Automatic:** push to `main` (when VPS paths change) → GitHub Actions → SSH deploy.

**Manual:** GitHub → Actions → **Deploy to VPS** → Run workflow.

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
     └── hr.xpotify.cc     ──► hr-onboarding-frontend:80
```

Compose file: [`deploy/vps/docker-compose.yml`](vps/docker-compose.yml)

---

## Verify

```bash
curl -s https://hr-api.xpotify.cc/health
# {"status":"ok"}

curl -sI https://hr.xpotify.cc
# HTTP/2 200
```

From VPS before DNS propagates:

```bash
curl -sSk --resolve hr-api.xpotify.cc:443:127.0.0.1 https://hr-api.xpotify.cc/health
```

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| SSH `Permission denied` | VPS uses key auth only — add deploy public key to `/root/.ssh/authorized_keys` |
| TLS certificate fails | Ensure Cloudflare records are **DNS only**, not proxied |
| `/api` CORS errors | Frontend must be built with `VITE_API_URL=https://hr-api.xpotify.cc` |
| Traefik 404 | Check `traefik.docker.network=zanbeel` label and container on `zanbeel` network |
| Chat returns 500 | Set `OPENAI_API_KEY` in `/opt/hr-onboarding/.env` and redeploy backend |
