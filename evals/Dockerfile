FROM python:3.11-slim

WORKDIR /app

COPY backend/requirements.txt /app/backend/requirements.txt
COPY evals/requirements.txt /app/evals/requirements.txt
RUN pip install --no-cache-dir -r /app/backend/requirements.txt -r /app/evals/requirements.txt

COPY shared /app/shared
COPY seed-data /app/seed-data
COPY backend /app/backend
COPY evals /app/evals

RUN mkdir -p /app/data

ENV PYTHONPATH=/app:/app/backend

ENTRYPOINT ["python", "/app/evals/run_evals.py"]
