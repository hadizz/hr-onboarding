from __future__ import annotations

import asyncio
import queue
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
    event_queue: queue.Queue[tuple[str, Any] | BaseException | None] = queue.Queue()

    def run_sync_stream() -> None:
        try:
            for event_type, data in stream_multi_agent(message, employee_id, history):
                event_queue.put((event_type, data))
        except BaseException as exc:
            event_queue.put(exc)
        finally:
            event_queue.put(None)

    loop = asyncio.get_running_loop()
    loop.run_in_executor(None, run_sync_stream)

    result: dict[str, Any] | None = None

    while True:
        item = await loop.run_in_executor(None, event_queue.get)
        if item is None:
            break
        if isinstance(item, BaseException):
            raise item
        event_type, data = item
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
        await asyncio.sleep(0)
    yield {"event": "done", "data": result["response"]}
