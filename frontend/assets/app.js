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
  "3068175","860454","3068293","3034656","3068295",
  "3068294","3034655","860452","860451","860453","832433","860381"
]);

// localStorage keys
const LS_KEY="navixyAllowedZoneIds",
      LS_CLUSTER="navixyCluster",
      LS_SWAPMAP="navixySwapMap",
      LS_REFRESH="navixyRefreshMs";

// auth mode detection
const qs = new URLSearchParams(location.search);
const SESSION_KEY = qs.get("session_key") || qs.get("sid") || null;
const HASH_KEY = qs.get("hash") || null;
const AUTH_MODE = SESSION_KEY ? "session_key" : (HASH_KEY ? "hash" : "api_key_fallback");

// debug logger
function dbg(m){
  const el=document.getElementById("dbg-log");
  const msg = `[${new Date().toLocaleTimeString()}] ${m}`;
  if(el){ el.textContent += (el.textContent? "\n":"") + msg; }
  console.log(msg);
}

// safe badge setter
function setBadge(id, txt){
  const el=document.getElementById(id);
  if(el) el.textContent = txt;
}

// cluster & refresh defaults
let REFRESH_MS = 180000;
window.addEventListener("DOMContentLoaded", ()=>{
  try {
    document.getElementById("authb").textContent = `Auth: ${AUTH_MODE}`;
    const clusterSel=document.getElementById("cluster");
    if(clusterSel) clusterSel.value = localStorage.getItem(LS_CLUSTER) || "eu";
    const swap=document.getElementById("toggleSwapMap");
    if(swap) swap.checked = localStorage.getItem(LS_SWAPMAP)==="1";
    const ref=document.getElementById("refreshSelect");
    if(ref){
      ref.value = localStorage.getItem(LS_REFRESH) || "180000";
      REFRESH_MS = Number(ref.value);
    }
  } catch(e){ dbg("⚠️ init error: "+e.message); }
});

// ----------------------------- HELPERS -----------------------------
const apiBase = () => API[document.getElementById("cluster")?.value || "eu"];
const authParams = ()=> SESSION_KEY ? {session_key:SESSION_KEY} :
                       (HASH_KEY ? {hash:HASH_KEY} : {hash:API_KEY_FALLBACK});

function normLatLng(v){
  if(!v) return null;
  const lat=v.lat??v.latitude??v.y??(Array.isArray(v)?v[1]:undefined);
  const lng=v.lng??v.lon??v.longitude??v.x??(Array.isArray(v)?v[0]:undefined);
  if(!Number.isFinite(lat)||!Number.isFinite(lng)) return null;
  return {lat,lng};
}
function getStateLocation(st){
  const loc=(st && st.gps && st.gps.location)||{};
  return normLatLng(loc);
}
function hhmm(mins){ const h=Math.floor(mins/60), m=mins%60; return h?`${h}h ${m}m`:`${m}m`; }

// ----------------------------- HTTP -----------------------------
async function apiPOST(path, body){
  const ctrl=new AbortController(); const t=setTimeout(()=>ctrl.abort(),15000);
  try{
    let json=await fetch(`${apiBase()}${path}`,{
      method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify(Object.assign({},authParams(),body||{})),signal:ctrl.signal
    }).then(r=>r.json());
    if(json && json.success!==false){ dbg(`✅ ${path}`); return json; }
    dbg(`↻ retry ${path} with header`);
    json=await fetch(`${apiBase()}${path}`,{
      method:"POST",headers:{"Content-Type":"application/json","Authorization":`NVX ${API_KEY_FALLBACK}`},
      body:JSON.stringify(body||{}),signal:ctrl.signal
    }).then(r=>r.json());
    if(json && json.success!==false) return json;
    throw new Error(JSON.stringify(json));
  } catch(e){ throw new Error(`${path} failed: ${e.message}`); }
  finally{ clearTimeout(t); }
}
async function apiGET(path, query){
  const ctrl=new AbortController(); const t=setTimeout(()=>ctrl.abort(),15000);
  try{
    let url=new URL(`${apiBase()}${path}`);
    Object.entries(Object.assign({},authParams(),query||{}))
      .forEach(([k,v])=>url.searchParams.set(k,String(v)));
    let json=await fetch(url.toString(),{signal:ctrl.signal}).then(r=>r.json());
    if(json && json.success!==false){ dbg(`✅ GET ${path}`); return json; }
    throw new Error(JSON.stringify(json));
  } catch(e){ throw new Error(`GET ${path} failed: ${e.message}`); }
  finally{ clearTimeout(t); }
}

// ----------------------------- API LOGIC -----------------------------
async function fetchTrackersInGroup(name){
  const all=(await apiPOST("/tracker/list",{})).list||[];
  return all;
}
async function fetchStates(ids){
  if(!ids.length) return {};
  const res=await apiPOST("/tracker/get_states",{trackers:ids});
  return res.states||{};
}
async function fetchZonesRaw(){
  const res=await apiGET("/zone/list",{with_points:true,limit:16000});
  return res.list||[];
}

// ----------------------------- RENDER -----------------------------
function renderStateTable(states, trackers){
  const tb=document.querySelector("#stateTable tbody");
  if(!tb) return;
  tb.innerHTML="";
  Object.entries(states).slice(0,40).forEach(([tid,st])=>{
    const meta=trackers.find(t=>String(t.id)===String(tid));
    const loc=getStateLocation(st)||{};
    tb.innerHTML+=`<tr>
      <td>${tid}</td><td>${meta?.label||meta?.name||""}</td>
      <td>${st?.gps?.zone_ids?.join(",")||""}</td>
      <td>${st?.gps?.zone_labels?.join(",")||""}</td>
      <td>${loc.lat?.toFixed?loc.lat.toFixed(5):""}</td>
      <td>${loc.lng?.toFixed?loc.lng.toFixed(5):""}</td>
      <td>${st?.gps?.speed||""}</td>
      <td>${st?.gps?.updated||st?.updated||""}</td>
    </tr>`;
  });
}

// ----------------------------- MAIN LOOP -----------------------------
let BUSY=false,timer=null;
async function connectivityProbe(){
  try{
    dbg(`🔑 Auth mode: ${AUTH_MODE}`);
    dbg(`🌐 Cluster: ${apiBase()}`);
    await apiPOST("/tracker/list",{});
    dbg("✅ Probe ok");
    return true;
  }catch(e){
    dbg("❌ Probe failed: "+e.message);
    setBadge("updated","Connectivity problem");
    return false;
  }
}

async function runOnce(){
  if(BUSY) return; BUSY=true;
  dbg("▶️ runOnce start");
  try{
    if(!(await connectivityProbe())) return;
    const trackers=await fetchTrackersInGroup(TRACKER_GROUP_NAME);
    const states=await fetchStates(trackers.map(t=>t.id));
    renderStateTable(states,trackers);
    const upd=new Date().toLocaleTimeString();
    setBadge("updated",`Updated ${upd}`);
  }catch(e){ dbg("❌ runOnce error: "+e.message); }
  finally{ BUSY=false; dbg("✅ runOnce finished"); }
}

function resetTimer(){
  if(timer) clearInterval(timer);
  timer=setInterval(runOnce,REFRESH_MS);
  dbg(`⏱ Timer reset to ${Math.round(REFRESH_MS/1000)}s`);
}

// ----------------------------- BOOT -----------------------------
window.addEventListener("DOMContentLoaded",()=>{
  dbg("🚀 Boot sequence start");
  runOnce().then(()=>{
    resetTimer();
    dbg("🏁 Boot sequence finished");
  });
});
