from __future__ import annotations

import json
from typing import Any

from langchain_core.tools import tool

from shared.rag import format_search_results, search_handbook
from shared.tasks import create_onboarding_task, list_onboarding_tasks, schedule_checkin


def build_research_tools():
    @tool
    def search_handbook_tool(query: str) -> str:
        """Search HR handbook documents for policy and onboarding information."""
        results = search_handbook(query)
        return format_search_results(results)

    return [search_handbook_tool]


def build_workflow_tools(employee_id: str):
    @tool
    def create_onboarding_task_tool(title: str, due_day: int, category: str) -> str:
        """Create an onboarding task. Category: HR, IT, or Team."""
        task = create_onboarding_task(employee_id, title, due_day, category)
        return json.dumps(task, default=str)

    @tool
    def list_onboarding_tasks_tool() -> str:
        """List all onboarding tasks for the current employee."""
        tasks = list_onboarding_tasks(employee_id)
        return json.dumps(tasks, default=str)

    @tool
    def schedule_checkin_tool(day: int, topic: str) -> str:
        """Schedule a manager or HR check-in for a specific onboarding day."""
        result = schedule_checkin(employee_id, day, topic)
        return json.dumps(result, default=str)

    return [
        create_onboarding_task_tool,
        list_onboarding_tasks_tool,
        schedule_checkin_tool,
    ]


def build_all_tools(employee_id: str) -> list[Any]:
    return build_research_tools() + build_workflow_tools(employee_id)
