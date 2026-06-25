from __future__ import annotations

from typing import Any

from agent.multi_agent import run_multi_agent
from shared.config import DEFAULT_EMPLOYEE_ID


def run_agent(
    message: str,
    employee_id: str = DEFAULT_EMPLOYEE_ID,
    history: list[dict] | None = None,
) -> dict[str, Any]:
    return run_multi_agent(message, employee_id, history)


async def stream_agent(
    message: str,
    employee_id: str = DEFAULT_EMPLOYEE_ID,
    history: list[dict] | None = None,
):
    """Yield SSE events from multi-agent execution."""
    result = run_agent(message, employee_id, history)
    yield {"event": "agent_events", "data": result.get("agent_events", [])}
    yield {"event": "tool_calls", "data": result["tool_calls"]}
    yield {"event": "citations", "data": result["citations"]}
    text = result["response"]
    chunk_size = 40
    for i in range(0, len(text), chunk_size):
        yield {"event": "token", "data": text[i : i + chunk_size]}
    yield {"event": "done", "data": result["response"]}
