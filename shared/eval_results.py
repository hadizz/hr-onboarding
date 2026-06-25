"""Read/write eval report JSON files (golden + DeepEval)."""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

from shared.config import ROOT_DIR

GOLDEN_FILENAME = "latest.json"
DEEPEVAL_FILENAME = "deepeval-latest.json"


def results_dir() -> Path:
    path = Path(os.getenv("EVALS_RESULTS_DIR", str(ROOT_DIR / "evals" / "results")))
    path.mkdir(parents=True, exist_ok=True)
    return path


def golden_report_path() -> Path:
    return results_dir() / GOLDEN_FILENAME


def deepeval_report_path() -> Path:
    return results_dir() / DEEPEVAL_FILENAME


def _read_report(path: Path) -> dict[str, Any] | None:
    if not path.is_file():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return None


def load_eval_reports() -> dict[str, Any]:
    golden_path = golden_report_path()
    deepeval_path = deepeval_report_path()
    golden = _read_report(golden_path)
    deepeval = _read_report(deepeval_path)

    return {
        "results_dir": str(results_dir()),
        "golden": {
            "available": golden is not None,
            "path": str(golden_path),
            "report": golden,
        },
        "deepeval": {
            "available": deepeval is not None,
            "path": str(deepeval_path),
            "report": deepeval,
        },
    }
