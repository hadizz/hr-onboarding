#!/usr/bin/env python3
"""Run OnboardAI scenarios through DeepEval LLM-as-judge metrics."""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "backend"))

from deepeval_runner import load_scenarios, run_scenario_deepeval  # noqa: E402
from shared.eval_results import deepeval_report_path, results_dir  # noqa: E402

RESULTS_DIR = results_dir()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run OnboardAI DeepEval metrics")
    parser.add_argument(
        "--filter",
        help="Only run scenarios whose id contains this substring (e.g. prompt_injection)",
    )
    return parser.parse_args()


def main() -> int:
    if not os.getenv("OPENAI_API_KEY"):
        print("ERROR: OPENAI_API_KEY required for DeepEval")
        return 1

    args = parse_args()
    scenarios = load_scenarios()
    if args.filter:
        scenarios = [s for s in scenarios if args.filter in s["id"]]
        if not scenarios:
            print(f"ERROR: No scenarios matched filter '{args.filter}'")
            return 1
        print(f"Running DeepEval on {len(scenarios)} scenario(s) matching '{args.filter}'")

    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    results = []

    for scenario in scenarios:
        print(f"Running: {scenario['id']}...", flush=True)
        try:
            outcome = run_scenario_deepeval(scenario)
        except Exception as exc:
            outcome = {
                "id": scenario["id"],
                "input": scenario["input"],
                "passed": False,
                "error": str(exc),
            }

        status = "PASS" if outcome.get("passed") else "FAIL"
        print(f"  {status}", flush=True)
        if not outcome.get("passed"):
            if outcome.get("error"):
                print(f"    error: {outcome['error']}", flush=True)
            for metric in outcome.get("metrics", []):
                if not metric.get("passed"):
                    print(
                        f"    {metric['name']}: score={metric.get('score')} — {metric.get('reason', '')[:160]}",
                        flush=True,
                    )
        results.append(outcome)

    passed = sum(1 for row in results if row.get("passed"))
    total = len(results)
    pass_rate = round((passed / total) * 100, 1) if total else 0

    report = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "framework": "deepeval",
        "total": total,
        "passed": passed,
        "failed": total - passed,
        "pass_rate_percent": pass_rate,
        "results": results,
    }

    report_path = deepeval_report_path()
    with open(report_path, "w", encoding="utf-8") as handle:
        json.dump(report, handle, indent=2)

    print(f"\nDeepEval complete: {passed}/{total} passed ({pass_rate}%)")
    print(f"Report: {report_path}")
    return 0 if passed >= total * 0.85 else 1


if __name__ == "__main__":
    raise SystemExit(main())
