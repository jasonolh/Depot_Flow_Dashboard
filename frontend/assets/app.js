// ============================== CONFIG / GLOBALS ================================
const API = {
  eu: "https://api.eu.navixy.com/v2",
  us: "https://api.us.navixy.com/v2"
};

const API_KEY_FALLBACK = "39736582e2058803e90919b91fd5e5f9"; // test fallback
const TRACKER_GROUP_NAME = "Onelogix Linehaul Trucks";
const LOOKBACK_HOURS = 240;
const HISTORY_PAGE_SIZE = 400, HISTORY_MAX_PAGES = 20;
const SERVER_ZONE_CHECK_MAX = 250;
const DWELL_THRESHOLD_MIN = 30;

const PINNED_ZONE_IDS = new Set([
  "3068175", "860454", "3068293", "3034656",
  "3068295", "3068294", "3034655",
  "860452", "860451", "860453",
  "832433", "860381"
]);

const qs = new URLSearchParams(location.search);
const SESSION_KEY = qs.get("session_key") || qs.get("sid") || null;
const HASH_KEY = qs.get("hash") || null;
const AUTH_MODE = SESSION_KEY ? "session_key" : (HASH_KEY ? "hash" : "api_key_fallback");

// ============================== SAFE DOM HELPERS ================================
function byId(id) {
  const el = document.getElementById(id);
  if (el) return el;
  // Return safe dummy element
  return {
    value: "",
    checked: false,
    textContent: "",
    style: {},
    appendChild: () => {},
    addEventListener: () => {},
    setAttribute: () => {},
    removeAttribute: () => {}
  };
}
function setBadge(id, txt) {
  byId(id).textContent = txt;
}

// ============================== DEBUG LOGGER ================================
function dbg(msg) {
  const el = byId("dbg-log");
  const timestamp = new Date().toISOString().split("T")[1].split(".")[0]; // HH:MM:SS
  const line = `[${timestamp}] ${msg}`;
  el.textContent = (el.textContent ? el.textContent + "\n" : "") + line;
  console.log(line);
}

// ============================== HELPERS ======================================
function apiBase() {
  return API[byId("cluster").value || "eu"];
}
function authParams() {
  return SESSION_KEY ? { session_key: SESSION_KEY } :
         (HASH_KEY ? { hash: HASH_KEY } : { hash: API_KEY_FALLBACK });
}

// ============================== HTTP WRAPPERS ================================
async function postWithParams(path, body, signal) {
  const url = apiBase() + path;
  dbg("➡️ POST (params) " + url);
  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(Object.assign({}, authParams(), body || {})),
    signal
  }).then(r => r.json());
}

async function getWithParams(path, query, signal) {
  const url = new URL(apiBase() + path);
  Object.entries(Object.assign({}, authParams(), query || {}))
    .forEach(([k, v]) => url.searchParams.set(k, String(v)));
  dbg("➡️ GET (params) " + url.toString());
  return fetch(url.toString(), { method: "GET", signal }).then(r => r.json());
}

async function postWithHeader(path, body, signal) {
  const url = apiBase() + path;
  dbg("➡️ POST (header) " + url);
  return fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "NVX " + API_KEY_FALLBACK
    },
    body: JSON.stringify(body || {}),
    signal
  }).then(r => r.json());
}

async function getWithHeader(path, query, signal) {
  const url = new URL(apiBase() + path);
  Object.entries(query || {})
    .forEach(([k, v]) => url.searchParams.set(k, String(v)));
  dbg("➡️ GET (header) " + url.toString());
  return fetch(url.toString(), {
    method: "GET",
    headers: { "Authorization": "NVX " + API_KEY_FALLBACK },
    signal
  }).then(r => r.json());
}

async function apiPOST(path, body) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 15000);
  try {
    let json = await postWithParams(path, body, ctrl.signal);
    if (json && json.success !== false) {
      dbg("✅ " + path + " ok (params)");
      return json;
    }
    dbg("↻ " + path + " retry with header auth");
    json = await postWithHeader(path, body, ctrl.signal);
    if (json && json.success !== false) {
      dbg("✅ " + path + " ok (header)");
      return json;
    }
    throw new Error(JSON.stringify(json));
  } catch (e) {
    dbg("❌ " + path + " failed: " + (e.message || e));
    throw e;
  } finally {
    clearTimeout(t);
  }
}

async function apiGET(path, query) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 15000);
  try {
    let json = await getWithParams(path, query, ctrl.signal);
    if (json && json.success !== false) {
      dbg("✅ GET " + path + " ok (params)");
      return json;
    }
    dbg("↻ GET " + path + " retry with header auth");
    json = await getWithHeader(path, query, ctrl.signal);
    if (json && json.success !== false) {
      dbg("✅ GET " + path + " ok (header)");
      return json;
    }
    throw new Error(JSON.stringify(json));
  } catch (e) {
    dbg("❌ GET " + path + " failed: " + (e.message || e));
    throw e;
  } finally {
    clearTimeout(t);
  }
}

// ============================== PLACEHOLDERS ================================
// Keep your existing implementations of:
// - fetchTrackersInGroup()
// - fetchStates()
// - fetchZonesRaw()
// - fetchZoneShapeById()
// - zonesAtPoint()
// - normalizeZones()
// - buildIdToLabel()
// - fetchHistory()
// - buildLastEnterMap()
// - membershipNow()
// - membershipFromServer()
// - buildZonesMapFromNow()
// - renderCards()
// - renderMap()
// - centerOnTracker()
// - renderStateTable()
// - openZonePicker()
// - connectivityProbe()
// - runOnce()
// - resetTimer()

// ============================== BOOTSTRAP SAFE ===============================
document.addEventListener("DOMContentLoaded", async () => {
  try {
    dbg("🚀 Boot sequence start");

    dbg("🔑 Auth mode: " + AUTH_MODE);
    dbg("🌐 Cluster: " + apiBase());

    // First run
    await runOnce();
    dbg("✅ Initial runOnce() finished");

    // Start refresh timer
    resetTimer();
    dbg("⏱️ Auto-refresh enabled (" + Math.round(REFRESH_MS/1000) + "s)");

    dbg("✅ Boot sequence finished");
  } catch (err) {
    dbg("❌ Boot crash: " + (err && err.message ? err.message : err));
    console.error("Boot crash:", err);
  }
});
