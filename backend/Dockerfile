FROM python:3.11-slim

WORKDIR /app

# --- Handle requirements.txt ---
# Case 1: repo root context (requirements is in backend/)
# Case 2: subdir context (requirements is in current dir)
COPY requirements.txt* backend/requirements.txt* ./ || true
RUN if [ -f requirements.txt ]; then pip install --no-cache-dir -r requirements.txt; \
    elif [ -f backend/requirements.txt ]; then pip install --no-cache-dir -r backend/requirements.txt; \
    fi

# --- Copy backend code ---
# Works whether backend/ exists or just files
COPY backend/ ./ || true
COPY . .

# --- Copy frontend if available ---
COPY frontend/ ./frontend || true

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
