/* ============================== CONFIG / GLOBALS ================================ */
const API = {
  eu: "https://api.eu.navixy.com/v2",
  us: "https://api.us.navixy.com/v2"
};
const API_KEY_FALLBACK = "39736582e2058803e90919b91fd5e5f9"; // demo key
const TRACKER_GROUP_NAME = "Onelogix Linehaul Trucks";
const LOOKBACK_HOURS = 240;
const DWELL_THRESHOLD_MIN = 30;
const IDLE_THRESHOLD_MIN = 10;

const qs = new URLSearchParams(location.search);
const SESSION_KEY = qs.get("session_key") || qs.get("sid") || null;
const HASH_KEY = qs.get("hash") || null;
const AUTH_MODE = SESSION_KEY ? "session_key" : (HASH_KEY ? "hash" : "api_key_fallback");

document.addEventListener("DOMContentLoaded", () => {
  const dbg = (m) => {
    const el = document.getElementById("dbg-log");
    if (el) {
      el.textContent = (el.textContent ? el.textContent + "\n" : "") + `[${new Date().toLocaleTimeString()}] ${m}`;
    }
    console.log(m);
  };

  dbg("🚀 Boot sequence start");
  dbg(`🔑 Auth mode: ${AUTH_MODE}`);

  // === Helpers ===
  const setBadge = (id, txt) => {
    const el = document.getElementById(id);
    if (el) el.textContent = txt;
  };
  const authParams = () =>
    SESSION_KEY
      ? { session_key: SESSION_KEY }
      : HASH_KEY
      ? { hash: HASH_KEY }
      : { hash: API_KEY_FALLBACK };
  const apiBase = () => API[document.getElementById("cluster").value || "eu"];

  // === HTTP helpers ===
  async function apiPOST(path, body) {
    const url = apiBase() + path;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...authParams(), ...(body || {}) })
    });
    return res.json();
  }

  async function apiGET(path, query) {
    const url = new URL(apiBase() + path);
    Object.entries({ ...authParams(), ...(query || {}) }).forEach(([k, v]) =>
      url.searchParams.set(k, v)
    );
    const res = await fetch(url);
    return res.json();
  }

  // === State ===
  let REFRESH_MS = Number(localStorage.getItem("navixyRefreshMs") || 180000);
  let map, markersCluster, heatLayer;
  let statesCache = {}, trackersCache = [];
  let timer = null;

  // === Core logic ===
  async function runOnce() {
    try {
      dbg("🌐 Fetching trackers…");
      const trackersRes = await apiPOST("/tracker/list", {});
      const trackers = trackersRes.list || [];
      trackersCache = trackers;

      dbg("🌐 Fetching states…");
      const statesRes = await apiPOST("/tracker/get_states", {
        trackers: trackers.map((t) => t.id)
      });
      const states = statesRes.states || {};
      statesCache = states;

      renderStateTable(states, trackers);
      renderMap(states, trackers);

      const upd = new Date().toLocaleTimeString();
      setBadge("updated", `Updated at ${upd} • every ${Math.round(REFRESH_MS / 1000)}s`);
      setBadge("counts", `Trackers: ${Object.keys(states).length}`);
    } catch (err) {
      dbg(`❌ runOnce failed: ${err.message}`);
      setBadge("updated", "Update failed – see diagnostics");
    }
  }

  // === Render ===
  function renderMap(states, trackers) {
    if (!map) {
      map = L.map("map").setView([-29.95, 30.95], 6);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19
      }).addTo(map);
    }

    if (markersCluster) markersCluster.clearLayers();
    else markersCluster = L.markerClusterGroup();

    if (heatLayer) map.removeLayer(heatLayer);

    const heatPoints = [];

    Object.entries(states).forEach(([tid, st]) => {
      const loc = st?.gps?.location;
      if (!loc || !Number.isFinite(loc.lat) || !Number.isFinite(loc.lng)) return;

      const meta = trackers.find((t) => String(t.id) === String(tid));
      const label = meta?.label || meta?.name || `#${tid}`;
      const mins = Math.floor((Date.now() - new Date(st.updated)) / 60000);
      const speed = st.gps.speed || 0;

      let color = "#1a7f37"; // ok
      if (mins > DWELL_THRESHOLD_MIN) color = "#d92d20"; // warn
      else if (speed === 0 && mins > IDLE_THRESHOLD_MIN) color = "#f59e0b"; // idle

      const icon = L.divIcon({
        className: "",
        html: `<div style="background:${color};width:14px;height:14px;border-radius:50%;border:2px solid #fff;box-shadow:0 0 4px rgba(0,0,0,.3)"></div>`
      });

      const marker = L.marker([loc.lat, loc.lng], { icon }).bindPopup(
        `<b>${label}</b><br>Speed: ${speed} km/h<br>Dwell: ${mins}m`
      );
      markersCluster.addLayer(marker);

      // Heatmap point
      heatPoints.push([loc.lat, loc.lng, 0.5]);
    });

    map.addLayer(markersCluster);

    if (document.getElementById("toggleHeat").checked) {
      heatLayer = L.heatLayer(heatPoints, { radius: 25 });
      map.addLayer(heatLayer);
    }
  }

  function renderStateTable(states, trackers) {
    const tb = document.querySelector("#stateTable tbody");
    if (!tb) return;
    tb.innerHTML = "";

    const rows = Object.entries(states).slice(0, 40).map(([tid, st]) => {
      const meta = trackers.find((t) => String(t.id) === String(tid));
      const loc = st?.gps?.location || {};
      const sp = st?.gps?.speed || "";
      const upd = st?.gps?.updated || st?.updated || "";
      return `<tr>
        <td>${tid}</td>
        <td>${meta?.label || meta?.name || ""}</td>
        <td class="small">${(st?.gps?.zone_ids || []).join(", ")}</td>
        <td class="small">${(st?.gps?.zone_labels || []).join(", ")}</td>
        <td>${Number.isFinite(loc.lat) ? loc.lat.toFixed(5) : ""}</td>
        <td>${Number.isFinite(loc.lng) ? loc.lng.toFixed(5) : ""}</td>
        <td>${sp}</td>
        <td class="small">${upd}</td>
      </tr>`;
    });
    tb.innerHTML = rows.join("") || `<tr><td colspan="8">No tracker state</td></tr>`;
  }

  // === CSV Export ===
  function exportCSV() {
    const rows = [["ID", "Label", "Lat", "Lon", "Speed", "Updated"]];
    Object.entries(statesCache).forEach(([tid, st]) => {
      const meta = trackersCache.find((t) => String(t.id) === String(tid));
      const loc = st?.gps?.location || {};
      rows.push([
        tid,
        meta?.label || meta?.name || "",
        loc.lat || "",
        loc.lng || "",
        st?.gps?.speed || "",
        st?.gps?.updated || st?.updated || ""
      ]);
    });
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "trackers.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  // === Controls ===
  document.getElementById("refreshSelect").addEventListener("change", (e) => {
    REFRESH_MS = Number(e.target.value);
    localStorage.setItem("navixyRefreshMs", REFRESH_MS);
    if (timer) clearInterval(timer);
    timer = setInterval(runOnce, REFRESH_MS);
  });
  document.getElementById("testBtn").addEventListener("click", runOnce);
  document.getElementById("exportBtn").addEventListener("click", exportCSV);
  document.getElementById("toggleHeat").addEventListener("change", runOnce);
  document.getElementById("toggleDark").addEventListener("change", () => {
    document.body.classList.toggle("dark");
  });

  // Boot
  runOnce();
  timer = setInterval(runOnce, REFRESH_MS);
});
