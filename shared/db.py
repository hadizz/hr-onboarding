from contextlib import contextmanager
from datetime import datetime, timezone

import psycopg
from psycopg.rows import dict_row

from shared.config import DATABASE_URL


def init_db() -> None:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS onboarding_tasks (
                    id SERIAL PRIMARY KEY,
                    employee_id TEXT NOT NULL,
                    title TEXT NOT NULL,
                    due_day INTEGER NOT NULL,
                    category TEXT NOT NULL,
                    status TEXT NOT NULL DEFAULT 'pending',
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
                """
            )
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS checkins (
                    id SERIAL PRIMARY KEY,
                    employee_id TEXT NOT NULL,
                    day INTEGER NOT NULL,
                    topic TEXT NOT NULL,
                    scheduled_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
                """
            )
        conn.commit()


@contextmanager
def get_connection():
    conn = psycopg.connect(DATABASE_URL, row_factory=dict_row)
    try:
        yield conn
    finally:
        conn.close()


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()
