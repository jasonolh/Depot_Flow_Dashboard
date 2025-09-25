FROM python:3.11-slim

WORKDIR /app

# Copy requirements first for caching
COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code
COPY backend/ ./backend

# Copy frontend (available if build context = repo root)
COPY frontend/ ./frontend

# Start app
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8080"]
