from __future__ import annotations

import json
from typing import Any

from shared.db import _now_iso, get_connection, init_db

VALID_CATEGORIES = {"HR", "IT", "Team"}


def ensure_db() -> None:
    init_db()


def create_onboarding_task(
    employee_id: str,
    title: str,
    due_day: int,
    category: str,
) -> dict[str, Any]:
    ensure_db()
    category = category.strip().title()
    if category not in VALID_CATEGORIES:
        category = "Team"

    with get_connection() as conn:
        cursor = conn.execute(
            """
            INSERT INTO onboarding_tasks (employee_id, title, due_day, category, status, created_at)
            VALUES (?, ?, ?, ?, 'pending', ?)
            """,
            (employee_id, title.strip(), due_day, category, _now_iso()),
        )
        conn.commit()
        task_id = cursor.lastrowid

    return {
        "id": task_id,
        "employee_id": employee_id,
        "title": title.strip(),
        "due_day": due_day,
        "category": category,
        "status": "pending",
    }


def list_onboarding_tasks(employee_id: str) -> list[dict[str, Any]]:
    ensure_db()
    with get_connection() as conn:
        rows = conn.execute(
            """
            SELECT id, employee_id, title, due_day, category, status, created_at
            FROM onboarding_tasks
            WHERE employee_id = ?
            ORDER BY due_day ASC, id ASC
            """,
            (employee_id,),
        ).fetchall()

    return [dict(row) for row in rows]


def complete_task(task_id: int, employee_id: str) -> dict[str, Any] | None:
    ensure_db()
    with get_connection() as conn:
        conn.execute(
            """
            UPDATE onboarding_tasks SET status = 'completed'
            WHERE id = ? AND employee_id = ?
            """,
            (task_id, employee_id),
        )
        conn.commit()
        row = conn.execute(
            "SELECT * FROM onboarding_tasks WHERE id = ? AND employee_id = ?",
            (task_id, employee_id),
        ).fetchone()
    return dict(row) if row else None


def get_onboarding_status(employee_id: str) -> dict[str, Any]:
    tasks = list_onboarding_tasks(employee_id)
    total = len(tasks)
    completed = sum(1 for t in tasks if t["status"] == "completed")
    pct = round((completed / total) * 100) if total else 0
    return {
        "employee_id": employee_id,
        "total_tasks": total,
        "completed_tasks": completed,
        "completion_percent": pct,
        "tasks": tasks,
    }


def schedule_checkin(employee_id: str, day: int, topic: str) -> dict[str, Any]:
    ensure_db()
    with get_connection() as conn:
        cursor = conn.execute(
            """
            INSERT INTO checkins (employee_id, day, topic, scheduled_at)
            VALUES (?, ?, ?, ?)
            """,
            (employee_id, day, topic.strip(), _now_iso()),
        )
        conn.commit()
        checkin_id = cursor.lastrowid

    return {
        "id": checkin_id,
        "employee_id": employee_id,
        "day": day,
        "topic": topic.strip(),
        "message": f"Check-in scheduled for day {day}: {topic.strip()}",
    }


def reset_employee_data(employee_id: str) -> None:
    ensure_db()
    with get_connection() as conn:
        conn.execute("DELETE FROM onboarding_tasks WHERE employee_id = ?", (employee_id,))
        conn.execute("DELETE FROM checkins WHERE employee_id = ?", (employee_id,))
        conn.commit()


def tasks_to_json(tasks: list[dict]) -> str:
    return json.dumps(tasks, indent=2)
