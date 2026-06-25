#!/usr/bin/env python3
"""Run OnboardAI agent evals against golden scenarios."""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "backend"))

from agent.onboarding_agent import run_agent  # noqa: E402
from shared.eval_results import golden_report_path, results_dir
from shared.config import DEFAULT_EMPLOYEE_ID  # noqa: E402
from shared.tasks import list_onboarding_tasks, reset_employee_data  # noqa: E402

EVALS_DIR = Path(__file__).parent
RESULTS_DIR = results_dir()


def load_scenarios() -> list[dict]:
    with open(EVALS_DIR / "scenarios.yaml", encoding="utf-8") as f:
        return yaml.safe_load(f)


def check_contains(response: str, keywords: list[str]) -> bool:
    lower = response.lower()
    return all(kw.lower() in lower for kw in keywords)


def check_tools_called(tool_calls: list[dict], expected: list[str]) -> bool:
    names = {tc["name"] for tc in tool_calls}
    return all(name in names for name in expected)


def count_tasks_created(tool_calls: list[dict]) -> int:
    return sum(1 for tc in tool_calls if tc["name"] == "create_onboarding_task_tool")


def run_scenario(scenario: dict) -> dict:
    employee_id = f"eval-{scenario['id']}"
    reset_employee_data(employee_id)

    result = run_agent(scenario["input"], employee_id=employee_id, history=[])
    response = result["response"]
    tool_calls = result["tool_calls"]
    citations = result.get("citations", [])
    expect = scenario.get("expect", {})

    checks: dict[str, bool] = {}

    if "contains" in expect:
        checks["contains"] = check_contains(response, expect["contains"])

    if "not_contains" in expect:
        checks["not_contains"] = not check_contains(response, expect["not_contains"])

    if "tools_not_called" in expect:
        names = {tc["name"] for tc in tool_calls}
        checks["tools_not_called"] = not any(name in names for name in expect["tools_not_called"])

    if "max_tasks_in_db" in expect:
        tasks = list_onboarding_tasks(employee_id)
        checks["max_tasks_in_db"] = len(tasks) <= expect["max_tasks_in_db"]

    if "tools_called" in expect:
        checks["tools_called"] = check_tools_called(tool_calls, expect["tools_called"])

    if "min_tasks_created" in expect:
        checks["min_tasks_created"] = count_tasks_created(tool_calls) >= expect["min_tasks_created"]

    if "cites_source" in expect:
        source = expect["cites_source"]
        checks["cites_source"] = (
            source in citations
            or source in response
            or any(source in str(tc) for tc in tool_calls)
        )

    passed = all(checks.values()) if checks else bool(response.strip())

    return {
        "id": scenario["id"],
        "input": scenario["input"],
        "passed": passed,
        "checks": checks,
        "response_preview": response[:300],
        "tool_calls": [tc["name"] for tc in tool_calls],
        "citations": citations,
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run OnboardAI golden eval scenarios")
    parser.add_argument(
        "--filter",
        help="Only run scenarios whose id contains this substring (e.g. prompt_injection)",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if not os.getenv("OPENAI_API_KEY"):
        print("ERROR: OPENAI_API_KEY required for evals")
        return 1

    scenarios = load_scenarios()
    if args.filter:
        scenarios = [s for s in scenarios if args.filter in s["id"]]
        if not scenarios:
            print(f"ERROR: No scenarios matched filter '{args.filter}'")
            return 1
        print(f"Running {len(scenarios)} scenario(s) matching '{args.filter}'")

    results = []
    for scenario in scenarios:
        print(f"Running: {scenario['id']}...", flush=True)
        try:
            outcome = run_scenario(scenario)
        except Exception as e:
            outcome = {
                "id": scenario["id"],
                "input": scenario["input"],
                "passed": False,
                "error": str(e),
            }
        status = "PASS" if outcome.get("passed") else "FAIL"
        print(f"  {status}", flush=True)
        if not outcome.get("passed"):
            if outcome.get("error"):
                print(f"    error: {outcome['error']}", flush=True)
            for check, ok in outcome.get("checks", {}).items():
                if not ok:
                    print(f"    failed check: {check}", flush=True)
            preview = outcome.get("response_preview", "")
            if preview:
                print(f"    response: {preview[:200]}", flush=True)
            tools = outcome.get("tool_calls", [])
            if tools:
                print(f"    tools: {', '.join(tools)}", flush=True)
        results.append(outcome)

    passed = sum(1 for r in results if r.get("passed"))
    total = len(results)
    pass_rate = round((passed / total) * 100, 1) if total else 0

    report = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "total": total,
        "passed": passed,
        "failed": total - passed,
        "pass_rate_percent": pass_rate,
        "results": results,
    }

    report_path = golden_report_path()
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)

    print(f"\nEval complete: {passed}/{total} passed ({pass_rate}%)")
    print(f"Report: {report_path}")
    print("\nSummary:")
    for row in results:
        mark = "PASS" if row.get("passed") else "FAIL"
        print(f"  [{mark}] {row['id']}")
    return 0 if passed >= total * 0.85 else 1


if __name__ == "__main__":
    raise SystemExit(main())
