// ============================== CONFIG / GLOBALS ================================
const API = {
  eu: "https://api.eu.navixy.com/v2",
  us: "https://api.us.navixy.com/v2"
};

const API_KEY_FALLBACK = "39736582e2058803e90919b91fd5e5f9";
const TRACKER_GROUP_NAME = "Onelogix Linehaul Trucks";

const qs = new URLSearchParams(location.search);
const SESSION_KEY = qs.get("session_key") || qs.get("sid") || null;
const HASH_KEY = qs.get("hash") || null;
const AUTH_MODE = SESSION_KEY ? "session_key" : (HASH_KEY ? "hash" : "api_key_fallback");

// ============================== SAFE DOM HELPERS ================================
function byId(id) {
  const el = document.getElementById(id);
  if (el) return el;
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
  const timestamp = new Date().toISOString().split("T")[1].split(".")[0];
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
async function apiPOST(path, body) {
  dbg("➡️ POST " + path);
  return { success: true, dummy: true }; // stub to keep safe
}
async function apiGET(path, query) {
  dbg("➡️ GET " + path);
  return { success: true, dummy: true };
}

// ============================== runOnce (SAFE) ================================
let REFRESH_MS = 180000;
let timer = null;
let BUSY = false;

async function runOnce() {
  if (BUSY) return;
  BUSY = true;
  try {
    dbg("▶️ runOnce start");

    // Dummy probe
    const res = await apiPOST("/tracker/list", {});
    if (res && res.success) {
      dbg("✅ Probe ok");
    } else {
      dbg("❌ Probe failed");
    }

    setBadge("updated", "Updated at " + new Date().toLocaleTimeString());
    setBadge("counts", "Cards: 0 • Markers: 0");

    dbg("✅ runOnce finished");
  } catch (err) {
    dbg("❌ runOnce crash: " + (err.message || err));
  } finally {
    BUSY = false;
  }
}

function resetTimer() {
  if (timer) clearInterval(timer);
  timer = setInterval(runOnce, REFRESH_MS);
  dbg("⏱️ Timer reset to " + REFRESH_MS/1000 + "s");
}

// ============================== BOOTSTRAP SAFE ===============================
document.addEventListener("DOMContentLoaded", async () => {
  try {
    dbg("🚀 Boot sequence start");
    dbg("🔑 Auth mode: " + AUTH_MODE);
    dbg("🌐 Cluster: " + apiBase());

    await runOnce();
    resetTimer();

    dbg("✅ Boot sequence finished");
  } catch (err) {
    dbg("❌ Boot crash: " + (err && err.message ? err.message : err));
  }
});
