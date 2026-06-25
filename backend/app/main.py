from __future__ import annotations

import json
from typing import Any

from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from agent.onboarding_agent import run_agent, stream_agent
from shared.config import DEFAULT_EMPLOYEE_ID
from shared.tasks import complete_task, get_onboarding_status, list_checkins, reset_employee_data


@asynccontextmanager
async def lifespan(app: FastAPI):
    from shared.db import init_db

    init_db()
    yield


app = FastAPI(
    title="OnboardAI API",
    description="Autonomous HR onboarding agent",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    message: str
    employee_id: str = DEFAULT_EMPLOYEE_ID
    history: list[ChatMessage] = Field(default_factory=list)


class CompleteTaskRequest(BaseModel):
    employee_id: str = DEFAULT_EMPLOYEE_ID


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/api/chat")
def chat(request: ChatRequest):
    try:
        history = [m.model_dump() for m in request.history]
        result = run_agent(request.message, request.employee_id, history)
        return result
    except ValueError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@app.post("/api/chat/stream")
async def chat_stream(request: ChatRequest):
    history = [m.model_dump() for m in request.history]

    async def event_generator():
        try:
            async for event in stream_agent(request.message, request.employee_id, history):
                yield f"event: {event['event']}\ndata: {json.dumps(event['data'])}\n\n"
        except Exception as e:
            yield f"event: error\ndata: {json.dumps({'message': str(e)})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@app.get("/api/onboarding/{employee_id}/status")
def onboarding_status(employee_id: str):
    return get_onboarding_status(employee_id)


@app.post("/api/onboarding/{employee_id}/tasks/{task_id}/complete")
def mark_task_complete(employee_id: str, task_id: int, body: CompleteTaskRequest | None = None):
    result = complete_task(task_id, employee_id)
    if not result:
        raise HTTPException(status_code=404, detail="Task not found")
    return result


@app.post("/api/onboarding/{employee_id}/reset")
def reset_onboarding(employee_id: str):
    reset_employee_data(employee_id)
    return {"status": "reset", "employee_id": employee_id}


@app.get("/api/admin/checkins")
def admin_checkins(employee_id: str | None = None):
    return {"checkins": list_checkins(employee_id)}


@app.get("/api/employee/demo")
def demo_employee() -> dict[str, Any]:
    return {
        "id": DEFAULT_EMPLOYEE_ID,
        "name": "Alex Chen",
        "role": "Software Engineer",
        "start_day": 1,
        "company": "Acme Corp",
    }
