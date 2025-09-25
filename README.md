# 🚚 Depot Flow Dashboard

This project provides a **Depot Truck Tracking Dashboard** with:
- **FastAPI backend** (caching Navixy API calls for fast responses)
- **Frontend dashboard** (Leaflet map + zones UI)
- **CI/CD pipeline** (GitHub Actions auto-deploy to Koyeb)

---

## 📂 Repo Structure
```
Depot_Flow_Dashboard/
│── backend/
│   │── main.py            # FastAPI backend (Navixy caching + API + serve frontend)
│   │── requirements.txt
│   │── Dockerfile
│
│── frontend/
│   │── index.html         # Dashboard UI
│   │── assets/...
│
│── .github/workflows/
│   │── deploy-direct.yml  # CI/CD workflow for Koyeb
│
└── README.md
```

---

## ⚡ Backend
The backend:
- Runs a FastAPI server
- Refreshes Navixy data every 30 seconds in the background
- Exposes:
  - `/tracking` → JSON of trackers, states, and zones
  - `/` → serves the dashboard (`frontend/index.html`)

### Run locally
```bash
cd backend
pip install -r requirements.txt
export NAVIXY_API_URL="https://api.eu.navixy.com/v2"
export NAVIXY_API_KEY="your_api_key_here"
uvicorn main:app --reload --host 0.0.0.0 --port 8080
```

Visit [http://localhost:8080](http://localhost:8080) to view.

---

## 🌐 Deployment on Koyeb
### 1. Repo → Koyeb CI/CD
- GitHub Actions workflow `.github/workflows/deploy-direct.yml` deploys automatically to Koyeb.

### 2. Secrets
In your GitHub repo → Settings → Secrets → Actions → add:
- `KOYEB_API_KEY` (from your [Koyeb dashboard](https://app.koyeb.com/account/api))

### 3. Trigger Deployment
```bash
git add .
git commit -m "Deploy backend to Koyeb"
git push origin main
```

The app will redeploy automatically on **https://tracking.k5it.co.za**.

---

## 🌍 Frontend
- `frontend/index.html` is served by FastAPI at `/`
- Fetches cached JSON from `/tracking`
- Map + cards render instantly (<200ms response)

---

## ✅ Benefits
- No slow 30s Navixy calls on frontend
- Backend caching layer keeps data fresh
- Secure + auto-scaled deployment on Koyeb
