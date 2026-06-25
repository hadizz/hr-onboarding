"""Pytest + DeepEval integration. Run with: deepeval test run evals/test_deepeval.py"""

from __future__ import annotations

import os
import sys
from pathlib import Path

import pytest
from deepeval import assert_test

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "backend"))

from agent.onboarding_agent import run_agent  # noqa: E402
from deepeval_runner import build_metrics, load_scenarios, retrieval_context_for  # noqa: E402
from deepeval.test_case import LLMTestCase  # noqa: E402
from shared.tasks import reset_employee_data  # noqa: E402

pytestmark = pytest.mark.skipif(
    not os.getenv("OPENAI_API_KEY"),
    reason="OPENAI_API_KEY required for DeepEval",
)

SCENARIOS = load_scenarios()
FILTER = os.getenv("DEEPEVAL_FILTER")
if FILTER:
    SCENARIOS = [scenario for scenario in SCENARIOS if FILTER in scenario["id"]]


@pytest.mark.parametrize("scenario", SCENARIOS, ids=[scenario["id"] for scenario in SCENARIOS])
def test_deepeval_scenario(scenario: dict) -> None:
    employee_id = f"deepeval-pytest-{scenario['id']}"
    reset_employee_data(employee_id)

    result = run_agent(scenario["input"], employee_id=employee_id, history=[])
    test_case = LLMTestCase(
        input=scenario["input"],
        actual_output=result["response"],
        retrieval_context=retrieval_context_for(scenario["input"]) or None,
    )
    assert_test(test_case, build_metrics(scenario))
