# OnboardAI — Autonomous HR Onboarding Agent

An autonomous HR onboarding agent that answers policy questions with citations, proactively creates 30-day onboarding plans, tracks task completion, and schedules check-ins — with an automated eval suite.

**Portfolio v2** — evolution of a production RAG system deployed at [hr.433-cloud.com](https://hr.433-cloud.com).

Built for the [Digital Workforce Senior AI Agent Developer](https://careers.digitalworkforce.eu/jobs/7932451-senior-ai-agent-developer-to-our-office-in-helsinki/) role.

## Problem

New hires ask the same 50 HR questions. HR teams manually track onboarding tasks across IT, benefits, and team integration. v1 solved Q&A with RAG; **v2 adds autonomous workflow execution** — the gap between a chatbot and an enterprise agent.

## v1 → v2 Evolution

| v1 (Deployed) | v2 (This repo) |
|---|---|
| Django + LlamaIndex RAG API | FastAPI + LangGraph agent |
| Passive document Q&A | Multi-tool autonomous agent |
| Streaming chat only | Chat + task tracking + check-ins |
| No evals | 12-scenario automated eval suite |
| Backend only | Python + React full stack |
| — | Custom MCP server for HR tools |

## Architecture

```mermaid
flowchart LR
  subgraph frontend [React Frontend]
    Chat[Chat UI]
    Progress[Onboarding Progress]
  end
  subgraph backend [FastAPI Backend]
    API[REST + SSE API]
    Agent[LangGraph Agent]
  end
  subgraph tools [HR Tools]
    MCP[MCP Server]
    RAG[Chroma RAG]
    Tasks[Postgres Tasks]
  end
  Chat --> API
  Progress --> API
  API --> Agent
  Agent --> RAG
  Agent --> Tasks
  MCP --> RAG
  MCP --> Tasks
```

## Features

- **LangGraph ReAct agent** with 4 tools: handbook search, task creation, task listing, check-in scheduling
- **Custom MCP server** exposing the same HR tools for Cursor/Claude integration
- **Chroma RAG** over seed HR documents with source citations
- **React UI** — streaming chat, citation chips, tool-call indicators, onboarding progress sidebar
- **Eval harness** — 12 golden scenarios testing retrieval, tool use, and answer quality

## Quick Start

### Prerequisites

- Docker & Docker Compose
- OpenAI API key

### Run with Docker

```bash
cp .env.example .env
# Edit .env and set OPENAI_API_KEY

docker compose up --build
```

- Frontend: http://localhost:5173
- API docs: http://localhost:8000/docs

### Run locally (development)

**Backend:**
```bash
python -m venv .venv && source .venv/bin/activate
pip install -r backend/requirements.txt
export PYTHONPATH="$(pwd):$(pwd)/backend"
export OPENAI_API_KEY=sk-...
uvicorn app.main:app --reload --app-dir backend
```

**Frontend:**
```bash
cd frontend && npm install && npm run dev
```

**MCP Server:**
```bash
pip install -r mcp-server/requirements.txt
export PYTHONPATH="$(pwd)"
python mcp-server/server.py
```

## Eval Suite

```bash
export PYTHONPATH="$(pwd):$(pwd)/backend"
export OPENAI_API_KEY=sk-...
python evals/run_evals.py
```

Results are saved to `evals/results/latest.json`.

### Eval Scenarios (12)

| Scenario | Tests |
|---|---|
| remote_policy | Handbook citation + remote work keywords |
| pto_policy | 25 PTO days from handbook |
| proactive_tasks | Auto-creates 3+ onboarding tasks |
| benefits_deadline | 30-day insurance enrollment |
| vpn_setup | IT setup doc citation |
| slack_channels | Slack channel info |
| wellness_stipend | €50 wellness benefit |
| security_requirements | 2FA within 48 hours |
| schedule_checkin | Check-in tool invocation |
| list_tasks | Task listing tool |
| code_of_conduct | Harassment policy |
| parental_leave | 16 weeks leave |

## 2-Minute Demo Script (Interview)

1. Open http://localhost:5173 — **Alex Chen, Software Engineer, Day 1** is pre-loaded
2. Ask: *"What's the remote work policy?"* → agent cites `employee-handbook.md`
3. Ask: *"I just started, what should I do this week?"* → agent creates 4–5 tasks, progress bar updates
4. Show eval output: `python evals/run_evals.py` — report pass rate
5. Close: *"v1 was RAG Q&A I deployed for a client. v2 adds autonomous workflow execution."*

## Project Structure

```
hr-onboarding/
├── backend/           # FastAPI + LangGraph agent
├── mcp-server/        # Python MCP HR tools
├── frontend/          # React + Vite + Tailwind
├── evals/             # Golden scenarios + runner
├── shared/            # RAG, tasks, DB (used by backend + MCP)
├── seed-data/         # HR handbook, benefits, IT docs
└── docker-compose.yml
```

## Production Roadmap

- [ ] pgvector instead of embedded Chroma for multi-tenant scale
- [ ] Real Slack / HRIS MCP integrations
- [ ] OAuth + multi-org tenancy
- [ ] PDF upload pipeline for custom handbooks
- [ ] LLM-as-judge for faithfulness scoring in CI
- [ ] OpenTelemetry tracing for agent observability

## Deploy

### Fly.io (backend)

```bash
fly launch --name onboardai-api --dockerfile backend/Dockerfile
fly secrets set OPENAI_API_KEY=sk-...
fly deploy
```

### Railway

Connect the repo and set `OPENAI_API_KEY`. Use `backend/Dockerfile` for the API service and `frontend/Dockerfile` for the UI.

## CV Bullet

> **OnboardAI** — Autonomous HR onboarding agent (Python, LangGraph, MCP, React). Multi-tool agent that answers policy questions with citations, generates 30-day onboarding plans, and tracks task completion. Includes automated eval suite (12 scenarios, faithfulness + tool-use scoring). Evolution of production RAG system deployed at hr.433-cloud.com.

## License

MIT
