FROM python:3.11-slim

WORKDIR /app

COPY mcp-server/requirements.txt /app/mcp-server/requirements.txt
RUN pip install --no-cache-dir -r /app/mcp-server/requirements.txt

COPY shared /app/shared
COPY seed-data /app/seed-data
COPY mcp-server /app/mcp-server

ENV PYTHONPATH=/app

CMD ["python", "mcp-server/server.py"]
