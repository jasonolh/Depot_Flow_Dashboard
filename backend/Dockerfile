FROM python:3.11-slim

WORKDIR /app

# Try both possible locations for requirements.txt
# (Docker will just skip if the file doesn't exist)
COPY requirements.txt ./requirements.txt
COPY backend/requirements.txt ./requirements.txt

RUN if [ -f requirements.txt ]; then pip install --no-cache-dir -r requirements.txt; fi

# Copy backend code (works whether context is repo root or backend/)
COPY backend/ ./ || true
COPY . .

# Copy frontend (only if context is repo root)
COPY frontend/ ./frontend

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
