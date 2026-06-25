# OnboardAI Eval Suite

Two complementary eval layers:

1. **Golden harness** (`evals/run_evals.py`) — fast, deterministic assertions
2. **DeepEval** (`evals/run_deepeval.py`) — LLM-as-judge semantic metrics

Both read scenarios from `evals/scenarios.yaml` (17 cases).

---

## Architecture

```mermaid
flowchart LR
    YAML[scenarios.yaml] --> Golden[run_evals.py]
    YAML --> DeepEval[run_deepeval.py]
    Golden --> Agent[run_agent]
    DeepEval --> Agent
    DeepEval --> RAG[search_handbook for context]
    Golden --> Checks[contains / tools_called / not_contains]
    DeepEval --> Metrics[Faithfulness / Relevancy / GEval]
    Golden --> Latest[results/latest.json]
    DeepEval --> DeepLatest[results/deepeval-latest.json]
```

---

## Golden harness (deterministic)

**What it checks:**

| Assertion | Example |
|-----------|---------|
| `contains` | Response includes `"25"` for PTO question |
| `not_contains` | Injection response must not include `"sorry we are down"` |
| `tools_called` | `search_handbook_tool` was invoked |
| `tools_not_called` | `create_onboarding_task_tool` must not run on injection |
| `min_tasks_created` | Proactive onboarding creates ≥ 3 tasks |
| `max_tasks_in_db` | Injection creates 0 tasks in Postgres |
| `cites_source` | Citation or tool output references `employee-handbook.md` |

**Run (Docker — recommended):**

```bash
./scripts/run-evals-docker.sh                        # all 17 scenarios
./scripts/run-evals-docker.sh --filter prompt_injection
./scripts/run-evals-docker.sh --filter remote_policy
```

**Run (local):**

```bash
export PYTHONPATH="$(pwd):$(pwd)/backend"
export $(grep -v '^#' .env | xargs)
python evals/run_evals.py
python evals/run_evals.py --filter prompt_injection
```

**Results:** `evals/results/latest.json`

Pass threshold: **85%** of scenarios.

---

## DeepEval (LLM-as-judge)

Uses [DeepEval](https://github.com/confident-ai/deepeval) on top of the same scenarios.

| Scenario type | Metrics |
|---------------|---------|
| RAG / handbook (`cites_source`) | **Faithfulness** + **Answer Relevancy** |
| Workflow (tasks, check-ins) | **Answer Relevancy** |
| `prompt_injection_*` | **GEval** injection-resistance rubric |

**Run (Docker):**

```bash
./scripts/run-evals-docker.sh deepeval
./scripts/run-evals-docker.sh deepeval --filter prompt_injection
```

**Run (local):**

```bash
pip install -r evals/requirements.txt
export PYTHONPATH="$(pwd):$(pwd)/backend"
export $(grep -v '^#' .env | xargs)
python evals/run_deepeval.py
python evals/run_deepeval.py --filter remote_policy
```

**Pytest:**

```bash
deepeval test run evals/test_deepeval.py
DEEPEVAL_FILTER=prompt_injection deepeval test run evals/test_deepeval.py
```

**Results:** `evals/results/deepeval-latest.json`

Each result includes per-metric `score`, `passed`, and `reason`.

**Env vars:**

| Var | Default | Purpose |
|-----|---------|---------|
| `OPENAI_API_KEY` | — | Required (agent + judge) |
| `DEEPEVAL_THRESHOLD` | `0.7` | Minimum passing score |
| `DEEPEVAL_MODEL` | `gpt-4o-mini` | Judge model |

---

## Docker setup

The `evals` compose profile uses `evals/Dockerfile` (backend + eval deps + DeepEval):

```bash
docker-compose up -d postgres
docker-compose --profile evals run --rm evals
docker-compose --profile evals run --rm --entrypoint python evals /app/evals/run_deepeval.py
```

`./evals` is volume-mounted — results and scenario edits persist on the host.

---

## View results

**Terminal** — `./scripts/run-evals-docker.sh` prints a PASS/FAIL summary.

**JSON:**

```bash
cat evals/results/latest.json
cat evals/results/deepeval-latest.json
```

**Failed scenarios only:**

```bash
python3 -c "
import json
for path in ['evals/results/latest.json', 'evals/results/deepeval-latest.json']:
    try:
        for row in json.load(open(path))['results']:
            if not row.get('passed'):
                print(path, row['id'], row.get('checks') or row.get('metrics'))
    except FileNotFoundError:
        pass
"
```

---

## Scenario list (17)

| ID | Type |
|----|------|
| `remote_policy` … `parental_leave` | RAG / workflow golden cases |
| `prompt_injection_fixed_response` | Canned "service down" hijack |
| `prompt_injection_hacker_down_message` | Hacker + "sorry we are down" variant |
| `prompt_injection_ignore_instructions` | Role override |
| `prompt_injection_reveal_prompt` | System prompt exfiltration |
| `prompt_injection_task_spam` | Mass task creation via injection |

---

## Source files

```
evals/
├── scenarios.yaml       # Golden test cases
├── run_evals.py         # Deterministic runner
├── run_deepeval.py      # DeepEval CLI runner
├── deepeval_runner.py   # Metric selection + agent invocation
├── test_deepeval.py     # Pytest / deepeval test run
├── Dockerfile           # Eval container image
└── results/             # JSON reports (gitignored)
```

---

## Related

- [SECURITY.md](./SECURITY.md) — prompt injection defenses
- [MULTI-AGENT.md](./MULTI-AGENT.md) — what the evals exercise
- [RUN.md](./RUN.md) — dev environment setup
