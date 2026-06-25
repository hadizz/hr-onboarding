from __future__ import annotations

import json
from typing import Any

from shared.db import _now_iso, get_connection, init_db

VALID_CATEGORIES = {"HR", "IT", "Team"}
MIN_DUE_DAY = 1
MAX_DUE_DAY = 90
MAX_TITLE_LENGTH = 200
MAX_TOPIC_LENGTH = 500


def ensure_db() -> None:
    init_db()


def create_onboarding_task(
    employee_id: str,
    title: str,
    due_day: int,
    category: str,
) -> dict[str, Any]:
    ensure_db()
    title = title.strip()
    if not title:
        raise ValueError("Task title cannot be empty")
    if len(title) > MAX_TITLE_LENGTH:
        raise ValueError(f"Task title too long (max {MAX_TITLE_LENGTH} chars)")
    if not MIN_DUE_DAY <= due_day <= MAX_DUE_DAY:
        raise ValueError(f"due_day must be between {MIN_DUE_DAY} and {MAX_DUE_DAY}")

    category = category.strip().title()
    if category not in VALID_CATEGORIES:
        category = "Team"

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO onboarding_tasks (employee_id, title, due_day, category, status, created_at)
                VALUES (%s, %s, %s, %s, 'pending', %s)
                RETURNING id
                """,
                (employee_id, title, due_day, category, _now_iso()),
            )
            row = cur.fetchone()
            conn.commit()
            task_id = row["id"]

    return {
        "id": task_id,
        "employee_id": employee_id,
        "title": title,
        "due_day": due_day,
        "category": category,
        "status": "pending",
    }


def list_onboarding_tasks(employee_id: str) -> list[dict[str, Any]]:
    ensure_db()
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, employee_id, title, due_day, category, status, created_at
                FROM onboarding_tasks
                WHERE employee_id = %s
                ORDER BY due_day ASC, id ASC
                """,
                (employee_id,),
            )
            rows = cur.fetchall()

    return [dict(row) for row in rows]


def complete_task(task_id: int, employee_id: str) -> dict[str, Any] | None:
    ensure_db()
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE onboarding_tasks SET status = 'completed'
                WHERE id = %s AND employee_id = %s
                """,
                (task_id, employee_id),
            )
            cur.execute(
                "SELECT * FROM onboarding_tasks WHERE id = %s AND employee_id = %s",
                (task_id, employee_id),
            )
            row = cur.fetchone()
            conn.commit()
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


def list_checkins(employee_id: str | None = None) -> list[dict[str, Any]]:
    ensure_db()
    with get_connection() as conn:
        with conn.cursor() as cur:
            if employee_id:
                cur.execute(
                    """
                    SELECT id, employee_id, day, topic, scheduled_at
                    FROM checkins
                    WHERE employee_id = %s
                    ORDER BY day ASC, scheduled_at DESC, id ASC
                    """,
                    (employee_id,),
                )
            else:
                cur.execute(
                    """
                    SELECT id, employee_id, day, topic, scheduled_at
                    FROM checkins
                    ORDER BY scheduled_at DESC, day ASC, id ASC
                    """
                )
            rows = cur.fetchall()
    return [dict(row) for row in rows]


def schedule_checkin(employee_id: str, day: int, topic: str) -> dict[str, Any]:
    ensure_db()
    topic = topic.strip()
    if not topic:
        raise ValueError("Check-in topic cannot be empty")
    if len(topic) > MAX_TOPIC_LENGTH:
        raise ValueError(f"Check-in topic too long (max {MAX_TOPIC_LENGTH} chars)")
    if not MIN_DUE_DAY <= day <= MAX_DUE_DAY:
        raise ValueError(f"Check-in day must be between {MIN_DUE_DAY} and {MAX_DUE_DAY}")

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO checkins (employee_id, day, topic, scheduled_at)
                VALUES (%s, %s, %s, %s)
                RETURNING id
                """,
                (employee_id, day, topic, _now_iso()),
            )
            row = cur.fetchone()
            conn.commit()
            checkin_id = row["id"]

    return {
        "id": checkin_id,
        "employee_id": employee_id,
        "day": day,
        "topic": topic,
        "message": f"Check-in scheduled for day {day}: {topic}",
    }


def reset_employee_data(employee_id: str) -> None:
    ensure_db()
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM onboarding_tasks WHERE employee_id = %s", (employee_id,))
            cur.execute("DELETE FROM checkins WHERE employee_id = %s", (employee_id,))
        conn.commit()


def tasks_to_json(tasks: list[dict]) -> str:
    return json.dumps(tasks, indent=2, default=str)
