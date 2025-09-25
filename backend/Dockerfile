FROM python:3.11-slim

WORKDIR /app

# Copy requirements (repo root or backend/)
COPY requirements.txt ./ || true
COPY backend/requirements.txt ./ || true
RUN if [ -f requirements.txt ]; then pip install --no-cache-dir -r requirements.txt; \
    elif [ -f backend/requirements.txt ]; then pip install --no-cache-dir -r backend/requirements.txt; \
    fi

# Copy backend (if present at context root or in ./backend)
COPY backend/ ./ || true
COPY . .

# Copy frontend if it exists
# This trick uses ADD with a wildcard that won't fail if missing
ADD frontend* ./frontend

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
