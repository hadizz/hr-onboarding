from __future__ import annotations

import json
from typing import Any

from langchain_core.tools import tool

from agent.security import MAX_TASKS_PER_REQUEST
from shared.rag import format_search_results, search_handbook
from shared.tasks import create_onboarding_task, list_onboarding_tasks, schedule_checkin

WRITE_BLOCKED_MSG = (
    "Action blocked: this request was flagged as a potential prompt-injection attempt. "
    "Read-only operations are still available."
)


def build_research_tools():
    @tool
    def search_handbook_tool(query: str) -> str:
        """Search HR handbook documents for policy and onboarding information."""
        results = search_handbook(query)
        return format_search_results(results)

    return [search_handbook_tool]


def build_workflow_tools(employee_id: str, injection_suspected: bool = False):
    tasks_created = 0

    @tool
    def create_onboarding_task_tool(title: str, due_day: int, category: str) -> str:
        """Create an onboarding task. Category: HR, IT, or Team."""
        nonlocal tasks_created
        if injection_suspected:
            return WRITE_BLOCKED_MSG
        if tasks_created >= MAX_TASKS_PER_REQUEST:
            return f"Task limit reached ({MAX_TASKS_PER_REQUEST} per message)."
        try:
            task = create_onboarding_task(employee_id, title, due_day, category)
        except ValueError as exc:
            return f"Invalid task: {exc}"
        tasks_created += 1
        return json.dumps(task, default=str)

    @tool
    def list_onboarding_tasks_tool() -> str:
        """List all onboarding tasks for the current employee."""
        tasks = list_onboarding_tasks(employee_id)
        return json.dumps(tasks, default=str)

    @tool
    def schedule_checkin_tool(day: int, topic: str) -> str:
        """Schedule a manager or HR check-in for a specific onboarding day."""
        if injection_suspected:
            return WRITE_BLOCKED_MSG
        try:
            result = schedule_checkin(employee_id, day, topic)
        except ValueError as exc:
            return f"Invalid check-in: {exc}"
        return json.dumps(result, default=str)

    return [
        create_onboarding_task_tool,
        list_onboarding_tasks_tool,
        schedule_checkin_tool,
    ]


def build_all_tools(employee_id: str, injection_suspected: bool = False) -> list[Any]:
    return build_research_tools() + build_workflow_tools(employee_id, injection_suspected)
