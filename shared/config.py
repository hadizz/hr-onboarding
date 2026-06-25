import os
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
SEED_DATA_DIR = ROOT_DIR / "seed-data"
DATA_DIR = ROOT_DIR / "data"
DB_PATH = DATA_DIR / "onboarding.db"
CHROMA_PATH = DATA_DIR / "chroma"

DATA_DIR.mkdir(parents=True, exist_ok=True)

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
DEFAULT_EMPLOYEE_ID = "alex-chen"
