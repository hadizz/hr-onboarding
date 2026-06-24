from mcp.server.fastmcp import FastMCP

from shared.config import DEFAULT_EMPLOYEE_ID
from shared.rag import format_search_results, search_handbook
from shared.tasks import (
    create_onboarding_task,
    list_onboarding_tasks,
    schedule_checkin,
)

mcp = FastMCP("hr-onboarding")


@mcp.tool()
def search_handbook_tool(query: str) -> str:
    """Search HR handbook documents for policy and onboarding information. Returns cited excerpts."""
    results = search_handbook(query)
    return format_search_results(results)


@mcp.tool()
def create_onboarding_task_tool(
    title: str,
    due_day: int,
    category: str,
    employee_id: str = DEFAULT_EMPLOYEE_ID,
) -> str:
    """Create an onboarding task for an employee. Category must be HR, IT, or Team."""
    task = create_onboarding_task(employee_id, title, due_day, category)
    return f"Created task #{task['id']}: {task['title']} (due day {task['due_day']}, {task['category']})"


@mcp.tool()
def list_onboarding_tasks_tool(employee_id: str = DEFAULT_EMPLOYEE_ID) -> str:
    """List all onboarding tasks for an employee with status."""
    tasks = list_onboarding_tasks(employee_id)
    if not tasks:
        return "No onboarding tasks yet."
    lines = [
        f"- [{t['status']}] #{t['id']} Day {t['due_day']} ({t['category']}): {t['title']}"
        for t in tasks
    ]
    return "\n".join(lines)


@mcp.tool()
def schedule_checkin_tool(
    day: int,
    topic: str,
    employee_id: str = DEFAULT_EMPLOYEE_ID,
) -> str:
    """Schedule a manager or HR check-in for a specific onboarding day."""
    result = schedule_checkin(employee_id, day, topic)
    return result["message"]


if __name__ == "__main__":
    mcp.run()
