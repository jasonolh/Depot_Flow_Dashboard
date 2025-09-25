import os
from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

app = FastAPI()

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
# frontend lives in /app/frontend after Docker COPY
frontend_dir = os.path.join(os.path.dirname(BASE_DIR), "frontend")

if not os.path.exists(frontend_dir):
    print(f"⚠️ Warning: frontend directory not found at {frontend_dir}")

# Serve static assets
app.mount("/static", StaticFiles(directory=frontend_dir), name="static")

# Serve index.html at root
@app.get("/")
async def read_index():
    index_path = os.path.join(frontend_dir, "index.html")
    return FileResponse(index_path)

# Add health check for Koyeb
@app.get("/health")
async def health():
    return {"status": "ok"}
