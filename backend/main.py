from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
import httpx, asyncio, time, os

app = FastAPI()

# Cache
cache = {"data": None, "last_update": 0}

# Config
API_URL = os.getenv("NAVIXY_API_URL", "https://api.eu.navixy.com/v2")
API_KEY = os.getenv("NAVIXY_API_KEY", "YOUR_API_KEY")
UPDATE_INTERVAL = int(os.getenv("CACHE_INTERVAL", 30))

# Frontend serving
frontend_dir = os.path.join(os.path.dirname(__file__), "..", "frontend")
app.mount("/static", StaticFiles(directory=frontend_dir), name="static")

@app.get("/")
def root():
    return FileResponse(os.path.join(frontend_dir, "index.html"))

async def fetch_navixy_data():
    async with httpx.AsyncClient(timeout=20) as client:
        try:
            trackers = (await client.post(f"{API_URL}/tracker/list", json={"hash": API_KEY})).json().get("list", [])
            ids = [t["id"] for t in trackers]
            states = (await client.post(f"{API_URL}/tracker/get_states", json={"hash": API_KEY, "trackers": ids})).json().get("states", {})
            zones = (await client.get(f"{API_URL}/zone/list", params={"hash": API_KEY, "with_points": True, "limit": 1000})).json().get("list", [])
            return {
                "trackers": trackers,
                "states": states,
                "zones": zones,
                "updated_at": time.strftime("%Y-%m-%d %H:%M:%S"),
            }
        except Exception as e:
            print(f"❌ Error fetching Navixy: {e}")
            return None

async def refresher():
    global cache
    while True:
        data = await fetch_navixy_data()
        if data:
            cache["data"] = data
            cache["last_update"] = time.time()
            print(f"✅ Cache refreshed at {cache['data']['updated_at']}")
        await asyncio.sleep(UPDATE_INTERVAL)

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(refresher())

@app.get("/tracking")
def get_tracking():
    if not cache["data"]:
        return {"status": "loading", "message": "Data not ready yet"}
    return cache["data"]
