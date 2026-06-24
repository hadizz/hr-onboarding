# Deploy to Fly.io

Deploy **backend** and **frontend** as two Fly apps from this monorepo.

---

## Part 1 — Backend API (start here)

### GitHub deploy form (your screenshot)

Use these exact values:

| Field | Value |
|-------|-------|
| **App name** | `hr-onboarding` |
| **Organization** | Personal |
| **Branch to deploy** | `main` |
| **Current Working Directory** | *(leave empty)* |
| **Config path** | *(leave empty)* |

**Important:** Leave **Current Working Directory** empty. The Dockerfile at `backend/Dockerfile` copies `shared/` and `seed-data/` from the repo root — it will fail if you set this to `backend`.

Click **Deploy**.

---

### After first deploy — set API key (required)

**The app will not respond to chat without this.** `/health` works without it, but RAG indexing is much faster with OpenAI embeddings.

In [Fly.io dashboard](https://fly.io/dashboard) → your app **hr-onboarding** → **Secrets**:

```
OPENAI_API_KEY=sk-your-key-here
```

Or with CLI:

```bash
brew install flyctl
fly auth login
fly secrets set OPENAI_API_KEY=sk-your-key-here --app hr-onboarding
```

---

### Create persistent volume (recommended)

Without this, onboarding tasks reset on every redeploy.

```bash
fly volumes create hr_onboarding_data --region arn --size 1 --app hr-onboarding
```

Then redeploy once (GitHub push or `fly deploy`).

---

### Verify backend

```bash
curl https://hr-onboarding.fly.dev/health
```

Expected: `{"status":"ok"}`

API docs: https://hr-onboarding.fly.dev/docs

Test chat:

```bash
curl -s -X POST https://hr-onboarding.fly.dev/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "What is the remote work policy?", "employee_id": "alex-chen", "history": []}'
```

---

## Part 2 — Frontend (optional, for live demo URL)

The backend alone is enough for API demos. For a full UI:

### Option A — CLI from `frontend/` folder

```bash
cd frontend
fly launch --config fly.toml --no-deploy
# Confirm app name: hr-onboarding-web

fly deploy --config fly.toml
```

`frontend/fly.toml` sets `VITE_API_URL=https://hr-onboarding.fly.dev` at build time.

Open: **https://hr-onboarding-web.fly.dev**

### Option B — Second GitHub deploy

Create another Fly app from the same repo:

| Field | Value |
|-------|-------|
| **App name** | `hr-onboarding-web` |
| **Current Working Directory** | `frontend` |
| **Config path** | `fly.toml` |

---

## CLI deploy (alternative to GitHub UI)

From repo root (backend):

```bash
brew install flyctl
fly auth login
fly launch --config fly.toml
fly secrets set OPENAI_API_KEY=sk-your-key-here
fly volumes create hr_onboarding_data --region arn --size 1
fly deploy
```

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Build fails: `COPY shared` not found | Working directory must be **repo root**, not `backend` |
| `OPENAI_API_KEY is required` | Set secret in Fly dashboard, then redeploy |
| `/health` times out | Redeploy latest code (startup no longer blocks on Chroma). Set `OPENAI_API_KEY` secret. First request may take ~10s (cold start). |
| App sleeps (cold start) | Free tier stops machines when idle — first request takes ~5–10s |
| Frontend can't reach API | Set `VITE_API_URL` to `https://hr-onboarding.fly.dev` before building frontend |
| Volume mount error on first deploy | Create volume first: `fly volumes create hr_onboarding_data --region arn --size 1` |

---

## What to put on your CV

- **API:** https://hr-onboarding.fly.dev
- **UI:** https://hr-onboarding-web.fly.dev
- **Admin:** https://hr-onboarding-web.fly.dev/admin/checkins
