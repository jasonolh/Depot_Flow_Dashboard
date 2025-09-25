document.addEventListener("DOMContentLoaded", () => {
  /* ============================== CONFIG / GLOBALS ================================ */
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
    "3068175","860454","3068293","3034656",
    "3068295","3068294","3034655","860452",
    "860451","860453","832433","860381"
  ]);

  const qs = new URLSearchParams(location.search);
  const SESSION_KEY = qs.get("session_key") || qs.get("sid") || null;
  const HASH_KEY = qs.get("hash") || null;
  const AUTH_MODE = SESSION_KEY ? "session_key" : (HASH_KEY ? "hash" : "api_key_fallback");

  // ✅ no more null error, because DOM exists now
  document.getElementById("authb").textContent = "Auth: " + AUTH_MODE;

  const LS_KEY="navixyAllowedZoneIds",
        LS_CLUSTER="navixyCluster",
        LS_SWAPMAP="navixySwapMap",
        LS_REFRESH="navixyRefreshMs";

  document.getElementById("cluster").value = localStorage.getItem(LS_CLUSTER) || "eu";
  document.getElementById("toggleSwapMap").checked = localStorage.getItem(LS_SWAPMAP)==="1";
  document.getElementById("refreshSelect").value = localStorage.getItem(LS_REFRESH) || "180000";

  let REFRESH_MS = Number(document.getElementById("refreshSelect").value);

  const dbg = (m)=>{
    const el=document.getElementById("dbg-log");
    el.textContent=(el.textContent?el.textContent+"\n":"")+m;
    console.log(m);
  };

  const apiBase = () => API[document.getElementById("cluster").value || "eu"];

  /* ------------------------------------------------------------------
   *  KEEP THE REST OF YOUR APP.JS CODE UNCHANGED BELOW THIS LINE
   * ------------------------------------------------------------------ */
  
  // ... all your existing functions, fetch logic, render functions, etc. ...
  
  /* boot */
(async () => {
  try {
    dbg("🚀 Boot sequence start");
    await runOnce();
    resetTimer();
    dbg("✅ Boot sequence finished");
  } catch (err) {
    dbg("❌ Boot crash: " + (err.message || err));
    console.error(err);
  }
})();
