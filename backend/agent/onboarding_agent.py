from __future__ import annotations

from typing import Any

from agent.multi_agent import run_multi_agent, stream_multi_agent
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
    result: dict[str, Any] | None = None

    for event_type, data in stream_multi_agent(message, employee_id, history):
        if event_type == "agent_log":
            yield {"event": "agent_log", "data": data}
        elif event_type == "result":
            result = data

    if not result:
        return

    yield {"event": "agent_events", "data": result.get("agent_events", [])}
    yield {"event": "tool_calls", "data": result["tool_calls"]}
    yield {"event": "citations", "data": result["citations"]}
    text = result["response"]
    chunk_size = 40
    for i in range(0, len(text), chunk_size):
        yield {"event": "token", "data": text[i : i + chunk_size]}
    yield {"event": "done", "data": result["response"]}
