from __future__ import annotations

import json
import time
import uuid
from typing import Any

from fastapi import APIRouter, Header, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from agent.onboarding_agent import run_agent, stream_agent
from shared.config import DEFAULT_EMPLOYEE_ID, ONBOARDAI_API_KEY

router = APIRouter(prefix="/v1", tags=["openai-compat"])

ONBOARDAI_MODEL_ID = "onboardai"


class OpenAIChatMessage(BaseModel):
    role: str
    content: str | list[Any] | None = None


class OpenAIChatRequest(BaseModel):
    model: str = ONBOARDAI_MODEL_ID
    messages: list[OpenAIChatMessage]
    stream: bool = False
    temperature: float | None = None
    max_tokens: int | None = None


def _verify_api_key(authorization: str | None) -> None:
    if not ONBOARDAI_API_KEY:
        return
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")
    token = authorization.removeprefix("Bearer ").strip()
    if token != ONBOARDAI_API_KEY:
        raise HTTPException(status_code=401, detail="Invalid API key")


def _extract_text_content(content: str | list[Any] | None) -> str:
    if content is None:
        return ""
    if isinstance(content, str):
        return content
    parts: list[str] = []
    for item in content:
        if isinstance(item, dict) and item.get("type") == "text":
            parts.append(str(item.get("text", "")))
    return "\n".join(parts)


def _split_history(messages: list[OpenAIChatMessage]) -> tuple[list[dict[str, str]], str]:
    history: list[dict[str, str]] = []
    for message in messages[:-1]:
        if message.role in {"user", "assistant"}:
            text = _extract_text_content(message.content)
            if text:
                history.append({"role": message.role, "content": text})

    last = messages[-1]
    if last.role != "user":
        raise HTTPException(status_code=400, detail="Last message must be from the user")
    user_message = _extract_text_content(last.content)
    if not user_message:
        raise HTTPException(status_code=400, detail="User message content is required")
    return history, user_message


def _build_completion(
    content: str,
    model: str,
    citations: list[str] | None = None,
    tool_calls: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    completion_id = f"chatcmpl-{uuid.uuid4().hex[:24]}"
    metadata: dict[str, Any] = {}
    if citations:
        metadata["citations"] = citations
    if tool_calls:
        metadata["tool_calls"] = tool_calls

    response: dict[str, Any] = {
        "id": completion_id,
        "object": "chat.completion",
        "created": int(time.time()),
        "model": model,
        "choices": [
            {
                "index": 0,
                "message": {"role": "assistant", "content": content},
                "finish_reason": "stop",
            }
        ],
        "usage": {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0},
    }
    if metadata:
        response["onboardai"] = metadata
    return response


def _chunk_payload(
    completion_id: str,
    model: str,
    delta: dict[str, Any],
    finish_reason: str | None = None,
) -> str:
    payload = {
        "id": completion_id,
        "object": "chat.completion.chunk",
        "created": int(time.time()),
        "model": model,
        "choices": [{"index": 0, "delta": delta, "finish_reason": finish_reason}],
    }
    return f"data: {json.dumps(payload)}\n\n"


@router.get("/models")
def list_models(authorization: str | None = Header(default=None)) -> dict[str, Any]:
    _verify_api_key(authorization)
    return {
        "object": "list",
        "data": [
            {
                "id": ONBOARDAI_MODEL_ID,
                "object": "model",
                "created": int(time.time()),
                "owned_by": "onboardai",
            }
        ],
    }


@router.post("/chat/completions")
async def chat_completions(
    request: OpenAIChatRequest,
    authorization: str | None = Header(default=None),
):
    _verify_api_key(authorization)
    if not request.messages:
        raise HTTPException(status_code=400, detail="messages are required")

    history, user_message = _split_history(request.messages)
    employee_id = DEFAULT_EMPLOYEE_ID
    model = request.model or ONBOARDAI_MODEL_ID

    if request.stream:
        completion_id = f"chatcmpl-{uuid.uuid4().hex[:24]}"

        async def event_generator():
            try:
                async for event in stream_agent(user_message, employee_id, history):
                    if event["event"] == "token":
                        yield _chunk_payload(
                            completion_id,
                            model,
                            {"content": event["data"]},
                        )
                    elif event["event"] == "done":
                        yield _chunk_payload(completion_id, model, {}, finish_reason="stop")
                        yield "data: [DONE]\n\n"
            except Exception as exc:
                yield _chunk_payload(completion_id, model, {"content": f"Error: {exc}"})
                yield _chunk_payload(completion_id, model, {}, finish_reason="stop")
                yield "data: [DONE]\n\n"

        return StreamingResponse(event_generator(), media_type="text/event-stream")

    try:
        result = run_agent(user_message, employee_id, history)
    except ValueError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    return _build_completion(
        result["response"],
        model,
        citations=result.get("citations"),
        tool_calls=result.get("tool_calls"),
    )
