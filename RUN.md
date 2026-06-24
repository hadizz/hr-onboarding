# How to Run OnboardAI

Exact commands from the project root: `/Users/hadi/dev/hr-onboarding`

You already have `.env` with your API key. Follow one path below.

---

## Option A — Local dev (recommended for testing)

### Step 1 — Open terminal 1: start backend

```bash
cd /Users/hadi/dev/hr-onboarding
source .venv/bin/activate
export PYTHONPATH="$(pwd):$(pwd)/backend"
export $(grep -v '^#' .env | xargs)
uvicorn app.main:app --reload --app-dir backend --host 0.0.0.0 --port 8000
```

Wait until you see: `Application startup complete.`

**Verify backend:**

```bash
curl http://localhost:8000/health
```

Expected: `{"status":"ok"}`

---

### Step 2 — Open terminal 2: start frontend

```bash
cd /Users/hadi/dev/hr-onboarding/frontend
npm install
npm run dev
```

Open in browser: **http://localhost:5173**

---

### Step 3 — Try the demo in the UI

1. Open http://localhost:5173
2. Click a suggestion chip, or type one of these:
   - `What's the remote work policy?`
   - `I just started today — what should I do this week?`
   - `When do I need to enroll in health insurance?`
3. Watch the right sidebar — tasks should appear after the proactive onboarding question.

---

### Step 4 — Run evals (optional, uses OpenAI credits)

Open a **third terminal**:

```bash
cd /Users/hadi/dev/hr-onboarding
source .venv/bin/activate
export PYTHONPATH="$(pwd):$(pwd)/backend"
export $(grep -v '^#' .env | xargs)
python evals/run_evals.py
```

Results saved to: `evals/results/latest.json`

Takes ~2–5 minutes (12 scenarios, each calls the agent).

---

### Step 5 — Stop everything

- Terminal 1 (backend): `Ctrl+C`
- Terminal 2 (frontend): `Ctrl+C`

---

## Option B — Docker (all services at once)

### Step 1 — Build and start

```bash
cd /Users/hadi/dev/hr-onboarding
docker-compose up --build
```

Wait until backend is healthy and frontend is up.

---

### Step 2 — Open the app

- **Frontend:** http://localhost:5173
- **API docs:** http://localhost:8000/docs

---

### Step 3 — Stop Docker

```bash
cd /Users/hadi/dev/hr-onboarding
docker-compose down
```

---

## Option C — MCP server in Cursor (optional)

### Step 1 — Create MCP config

```bash
cd /Users/hadi/dev/hr-onboarding
cp .cursor/mcp.json.example .cursor/mcp.json
```

Make sure `.env` has `OPENAI_API_KEY` set. Cursor reads it via `${env:OPENAI_API_KEY}` — export it in your shell profile or set it in Cursor's environment.

### Step 2 — Restart Cursor

Reload the window so the `hr-onboarding` MCP server connects.

### Step 3 — Test a tool in chat

Ask Cursor to use `search_handbook_tool` with query: `remote work policy`

---

## Quick API test (without UI)

With backend running on port 8000:

```bash
curl -s http://localhost:8000/api/employee/demo | python3 -m json.tool
```

```bash
curl -s -X POST http://localhost:8000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "What is the remote work policy?", "employee_id": "alex-chen", "history": []}' \
  | python3 -m json.tool
```

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `OPENAI_API_KEY is required` | Run `export $(grep -v '^#' .env \| xargs)` before starting backend |
| Chroma embedding conflict on startup | Fixed automatically on restart — or delete `data/chroma/` and restart |
| Frontend can't reach API | Backend must be on port 8000; Vite proxies `/api` to it |
| `docker compose` not found | Use `docker-compose` (with hyphen) on your machine |
| Port already in use | Kill old process: `lsof -ti :8000 \| xargs kill` |
| Reset demo tasks | Click **Reset** in the UI sidebar, or: `curl -X POST http://localhost:8000/api/onboarding/alex-chen/reset` |

---

## 2-minute interview demo order

1. http://localhost:5173 — show Alex Chen, Day 1
2. Ask: *What's the remote work policy?* → citation from `employee-handbook.md`
3. Ask: *I just started, what should I do this week?* → tasks appear in sidebar
4. Run: `python evals/run_evals.py` → show pass rate in `evals/results/latest.json`
5. Say: *v1 was RAG at hr.433-cloud.com; v2 adds autonomous agents + evals*
