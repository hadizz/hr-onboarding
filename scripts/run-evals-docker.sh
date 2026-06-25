#!/usr/bin/env bash
# Run golden or DeepEval evals inside Docker.
# Golden results: evals/results/latest.json
# DeepEval results: evals/results/deepeval-latest.json
set -euo pipefail

cd "$(dirname "$0")/.."

MODE="golden"
if [[ "${1:-}" == "deepeval" ]]; then
  MODE="deepeval"
  shift
fi

if [[ ! -f .env ]]; then
  echo "Missing .env — copy .env.example and set OPENAI_API_KEY"
  exit 1
fi

echo "Starting Postgres (if needed)..."
docker-compose up -d postgres

if [[ "$MODE" == "deepeval" ]]; then
  echo "Running DeepEval in Docker..."
  docker-compose --profile evals run --rm --build --entrypoint python evals /app/evals/run_deepeval.py "$@"
  RESULTS_FILE="evals/results/deepeval-latest.json"
else
  echo "Running golden evals in Docker..."
  docker-compose --profile evals run --rm --build evals "$@"
  RESULTS_FILE="evals/results/latest.json"
fi

echo ""
echo "Results saved to: $RESULTS_FILE"
echo ""
echo "Quick view:"
RESULTS_FILE="$RESULTS_FILE" python3 - <<'PY' 2>/dev/null || cat "$RESULTS_FILE"
import json
import os
from pathlib import Path

path = Path(os.environ["RESULTS_FILE"])
if not path.exists():
    raise SystemExit("No results file yet.")

report = json.loads(path.read_text())
print(f"{report['passed']}/{report['total']} passed ({report['pass_rate_percent']}%)")
print()
for row in report["results"]:
    mark = "PASS" if row.get("passed") else "FAIL"
    print(f"  [{mark}] {row['id']}")
    if not row.get("passed"):
        if row.get("error"):
            print(f"         error: {row['error']}")
        for check, ok in row.get("checks", {}).items():
            if not ok:
                print(f"         failed check: {check}")
        for metric in row.get("metrics", []):
            if not metric.get("passed"):
                print(
                    f"         {metric.get('name')}: score={metric.get('score')} "
                    f"— {str(metric.get('reason', ''))[:100]}"
                )
        preview = row.get("response_preview", "")
        if preview:
            print(f"         response: {preview[:120]}...")
PY
