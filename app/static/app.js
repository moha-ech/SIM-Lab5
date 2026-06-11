/* ============================================================
   BUS·BUNCHING — Digital Shadow (dashboard)
   Controla el Digital Master (SimPy) via HTTP/REST i anima la línia.
   ============================================================ */
"use strict";

const COLORS = {
  amber: "#ffb000", cyan: "#2fe3c4", danger: "#ff5252",
  blue: "#5aa9ff", ink: "#e9eef3", muted: "#7e8c99", line: "#27313c",
};

const state = {
  data: null,        // últim payload de /simulate
  scenarios: [],
  webappUrl: "",
  // animació
  frameIdx: 0,
  playing: false,
  speed: 4,
  lastTs: 0,
};

// ---------- arrencada ----------
window.addEventListener("DOMContentLoaded", init);

async function init() {
  wireControls();
  try {
    const [cfg, scn] = await Promise.all([
      fetch("config").then(r => r.json()),
      fetch("scenarios").then(r => r.json()),
    ]);
    state.webappUrl = cfg.gsheet_webapp_url || "";
    state.scenarios = scn.scenarios || [];
    buildScenarioButtons();
  } catch (e) {
    setStatus("No s'ha pogut contactar amb el sim-service.", "err");
  }
  resizeCanvas();
  window.addEventListener("resize", () => { resizeCanvas(); if (state.data) drawFrame(state.frameIdx); });
  // primera execució automàtica per omplir la pantalla
  runSimulation();
}

// ---------- controls ----------
const SLIDERS = ["num_buses", "num_stops", "capacity", "sim_time"];

function wireControls() {
  SLIDERS.forEach(id => {
    const el = document.getElementById(id);
    const out = document.getElementById("out-" + id);
    el.addEventListener("input", () => { out.textContent = el.value; clearActiveScenario(); });
  });

  document.getElementById("cap_inf").addEventListener("change", e => {
    document.getElementById("capacity").disabled = e.target.checked;
    document.getElementById("out-capacity").textContent = e.target.checked ? "∞" : document.getElementById("capacity").value;
    clearActiveScenario();
  });
  document.getElementById("variable_demand").addEventListener("change", clearActiveScenario);
  document.getElementById("seed").addEventListener("input", clearActiveScenario);

  document.getElementById("run-btn").addEventListener("click", runSimulation);
  document.getElementById("save-btn").addEventListener("click", saveToSheets);

  document.getElementById("play-btn").addEventListener("click", togglePlay);
  document.getElementById("speed").addEventListener("change", e => state.speed = +e.target.value);
  document.getElementById("scrub").addEventListener("input", e => {
    pause();
    state.frameIdx = Math.round((e.target.value / 100) * (state.data ? state.data.frames.length - 1 : 0));
    drawFrame(state.frameIdx);
  });
}

function buildScenarioButtons() {
  const box = document.getElementById("scenario-buttons");
  box.innerHTML = "";
  state.scenarios.forEach(sc => {
    const b = document.createElement("button");
    b.textContent = sc.name;
    b.dataset.id = sc.id;
    b.addEventListener("click", () => applyScenario(sc, b));
    box.appendChild(b);
  });
}

function applyScenario(sc, btn) {
  const p = sc.params;
  if (p.num_buses != null) setSlider("num_buses", p.num_buses);
  if (p.num_stops != null) setSlider("num_stops", p.num_stops);
  if (p.sim_time != null) setSlider("sim_time", p.sim_time);

  const capInf = document.getElementById("cap_inf");
  capInf.checked = p.capacity >= 100000;
  capInf.dispatchEvent(new Event("change"));
  if (!capInf.checked && p.capacity != null) setSlider("capacity", p.capacity);

  document.getElementById("variable_demand").checked = !!p.variable_demand;
  if (p.seed != null) document.getElementById("seed").value = p.seed;

  document.querySelectorAll("#scenario-buttons button").forEach(x => x.classList.remove("active"));
  btn.classList.add("active");
  document.getElementById("assumption").textContent = sc.assumption;
  runSimulation();
}

function setSlider(id, val) {
  document.getElementById(id).value = val;
  document.getElementById("out-" + id).textContent = val;
}
function clearActiveScenario() {
  document.querySelectorAll("#scenario-buttons button").forEach(x => x.classList.remove("active"));
}

function readParams() {
  const capInf = document.getElementById("cap_inf").checked;
  return {
    num_buses: +document.getElementById("num_buses").value,
    num_stops: +document.getElementById("num_stops").value,
    capacity: capInf ? 100000 : +document.getElementById("capacity").value,
    sim_time: +document.getElementById("sim_time").value,
    variable_demand: document.getElementById("variable_demand").checked,
    seed: +document.getElementById("seed").value,
  };
}

// ---------- simulació (REST) ----------
async function runSimulation() {
  const btn = document.getElementById("run-btn");
  btn.disabled = true; btn.textContent = "SIMULANT…";
  setStatus("POST /simulate …");
  try {
    const params = readParams();
    const r = await fetch("simulate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    if (!r.ok) throw new Error("HTTP " + r.status);
    state.data = await r.json();
    state.frameIdx = 0;
    renderMetrics(state.data.metrics);
    renderCharts(state.data);
    drawFrame(0);
    play();
    document.getElementById("save-btn").disabled = false;
    setStatus(`OK · ${state.data.frames.length} frames · CV=${state.data.metrics.headway_cv}`, "ok");
  } catch (e) {
    setStatus("Error de simulació: " + e.message, "err");
  } finally {
    btn.disabled = false; btn.textContent = "EXECUTAR SIMULACIÓ ▸";
  }
}

// ---------- mètriques ----------
function renderMetrics(m) {
  document.getElementById("m-cv").textContent = m.headway_cv.toFixed(2);
  document.getElementById("m-wait").textContent = m.mean_wait.toFixed(1);
  document.getElementById("m-headway").textContent = m.mean_headway.toFixed(1);
  document.getElementById("m-rejected").textContent = m.total_rejected;
  document.getElementById("m-maxq").textContent = m.max_queue;
  document.getElementById("m-occ").textContent = m.mean_occupancy.toFixed(1);
  // gauge: CV 0..1.2 -> 0..100%
  const pct = Math.min(100, (m.headway_cv / 1.2) * 100);
  document.getElementById("cv-gauge").style.width = pct + "%";
}

// ---------- gràfics Plotly ----------
const PLOT_LAYOUT = {
  paper_bgcolor: "transparent", plot_bgcolor: "transparent",
  font: { family: "JetBrains Mono, monospace", size: 9, color: COLORS.muted },
  margin: { l: 38, r: 10, t: 24, b: 26 },
  xaxis: { gridcolor: COLORS.line, zeroline: false, title: { text: "min", font: { size: 8 } } },
  yaxis: { gridcolor: COLORS.line, zeroline: false },
  showlegend: true,
  legend: { orientation: "h", y: 1.18, font: { size: 8 } },
};
const PLOT_CFG = { displayModeBar: false, responsive: true };
const SERIES_COLORS = [COLORS.cyan, COLORS.amber, COLORS.blue, COLORS.danger, "#b07cff", "#7CFC9A"];

function renderCharts(data) {
  // (a) headway per parada en el temps — es veu divergir l'interval (bunching)
  const hw = [];
  Object.keys(data.headway_series).forEach((s, i) => {
    const pts = data.headway_series[s];
    hw.push({
      x: pts.map(p => p[0]), y: pts.map(p => p[1]),
      mode: "lines+markers", name: "parada " + s, type: "scatter",
      line: { color: SERIES_COLORS[i % SERIES_COLORS.length], width: 1.3 },
      marker: { size: 3 },
    });
  });
  Plotly.react("chart-headway",
    hw,
    { ...PLOT_LAYOUT, title: { text: "Headway entre busos (min)", font: { size: 10, color: COLORS.amber } } },
    PLOT_CFG);

  // (b) cues per parada en el temps (des dels frames)
  const n = data.num_stops;
  const qx = data.frames.map(f => f.t);
  const qTraces = [];
  for (let s = 0; s < n; s++) {
    qTraces.push({
      x: qx, y: data.frames.map(f => f.queues[s]),
      mode: "lines", name: "parada " + s, type: "scatter",
      line: { color: SERIES_COLORS[s % SERIES_COLORS.length], width: 1.2 },
    });
  }
  Plotly.react("chart-queues",
    qTraces,
    { ...PLOT_LAYOUT, title: { text: "Cua de passatgers per parada", font: { size: 10, color: COLORS.cyan } } },
    PLOT_CFG);
}

// ---------- animació de la línia (canvas) ----------
const canvas = document.getElementById("line-canvas");
const ctx = canvas.getContext("2d");
let DPR = 1, CW = 0, CH = 0;

function resizeCanvas() {
  DPR = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  CW = rect.width; CH = rect.height;
  canvas.width = CW * DPR; canvas.height = CH * DPR;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
}

function occColor(occ, cap) {
  const f = Math.max(0, Math.min(1, occ / Math.min(cap, 60)));
  // cian (buit) -> ambre -> vermell (ple)
  const c1 = [47, 227, 196], c2 = [255, 176, 0], c3 = [255, 82, 82];
  let a, b, t;
  if (f < 0.5) { a = c1; b = c2; t = f / 0.5; } else { a = c2; b = c3; t = (f - 0.5) / 0.5; }
  const m = i => Math.round(a[i] + (b[i] - a[i]) * t);
  return `rgb(${m(0)},${m(1)},${m(2)})`;
}

function drawFrame(idx) {
  if (!state.data) return;
  const d = state.data;
  const fr = d.frames[idx];
  const n = d.num_stops;
  const cap = d.params.capacity;

  ctx.clearRect(0, 0, CW, CH);
  const cx = CW / 2, cy = CH / 2;
  const R = Math.min(CW, CH) * 0.36;

  const angleFor = c => (2 * Math.PI * c / n) - Math.PI / 2;

  // anell de la línia
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, 2 * Math.PI);
  ctx.strokeStyle = COLORS.line; ctx.lineWidth = 10; ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, 2 * Math.PI);
  ctx.strokeStyle = "rgba(47,227,196,.18)"; ctx.lineWidth = 1.5; ctx.stroke();

  // parades + cues
  for (let s = 0; s < n; s++) {
    const a = angleFor(s);
    const sx = cx + R * Math.cos(a), sy = cy + R * Math.sin(a);
    const q = fr.queues[s];

    // node parada
    ctx.beginPath(); ctx.arc(sx, sy, 7, 0, 2 * Math.PI);
    ctx.fillStyle = "#0e1318"; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = COLORS.muted; ctx.stroke();

    // etiqueta + barra de cua cap a fora
    const ox = cx + (R + 26) * Math.cos(a), oy = cy + (R + 26) * Math.sin(a);
    ctx.fillStyle = COLORS.muted; ctx.font = "10px 'JetBrains Mono', monospace";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("P" + s, ox, oy);

    // barra de cua (longitud proporcional, color senyala saturació)
    const qLen = Math.min(48, q * 0.9);
    const bx = cx + (R + 12) * Math.cos(a), by = cy + (R + 12) * Math.sin(a);
    const ex = cx + (R + 12 + qLen) * Math.cos(a), ey = cy + (R + 12 + qLen) * Math.sin(a);
    ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(ex, ey);
    ctx.strokeStyle = q > 30 ? COLORS.danger : (q > 12 ? COLORS.amber : COLORS.cyan);
    ctx.lineWidth = 4; ctx.lineCap = "round"; ctx.stroke();
    if (q > 0) {
      ctx.fillStyle = COLORS.ink; ctx.font = "9px 'JetBrains Mono', monospace";
      ctx.fillText(q, cx + (R + 12 + qLen + 12) * Math.cos(a), cy + (R + 12 + qLen + 12) * Math.sin(a));
    }
  }

  // busos
  const positions = [];
  fr.buses.forEach((pos, b) => {
    const a = angleFor(pos);
    const bx = cx + R * Math.cos(a), by = cy + R * Math.sin(a);
    positions.push([bx, by]);
    const occ = fr.occ[b];
    const rad = 8 + Math.min(14, occ / Math.min(cap, 60) * 14);
    const col = occColor(occ, cap);

    ctx.beginPath(); ctx.arc(bx, by, rad + 5, 0, 2 * Math.PI);
    ctx.fillStyle = col.replace("rgb", "rgba").replace(")", ",0.18)"); ctx.fill();
    ctx.beginPath(); ctx.arc(bx, by, rad, 0, 2 * Math.PI);
    ctx.fillStyle = col; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = "#0a0d10"; ctx.stroke();

    ctx.fillStyle = "#0a0d10"; ctx.font = "bold 9px 'JetBrains Mono', monospace";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(occ, bx, by);
  });

  // detecció visual de bunching: dos busos molt a prop
  let bunched = false;
  for (let i = 0; i < positions.length; i++)
    for (let j = i + 1; j < positions.length; j++) {
      const dx = positions[i][0] - positions[j][0], dy = positions[i][1] - positions[j][1];
      if (Math.hypot(dx, dy) < R * 0.28) bunched = true;
    }
  document.getElementById("bunching-badge").hidden = !bunched;

  // rellotge + barra de scrub
  document.getElementById("clock").textContent = fr.t.toFixed(1).padStart(5, "0");
  document.getElementById("scrub").value = (idx / (d.frames.length - 1)) * 100;
}

// ---------- bucle de reproducció ----------
function play() {
  if (!state.data) return;
  state.playing = true;
  document.getElementById("play-btn").textContent = "❚❚";
  state.lastTs = 0;
  requestAnimationFrame(tick);
}
function pause() {
  state.playing = false;
  document.getElementById("play-btn").textContent = "▶";
}
function togglePlay() { state.playing ? pause() : play(); }

function tick(ts) {
  if (!state.playing || !state.data) return;
  if (!state.lastTs) state.lastTs = ts;
  const dt = (ts - state.lastTs) / 1000; // s reals
  state.lastTs = ts;
  // reproducció: 'speed' frames de simulació per ~33ms -> escalat
  const framesPerSec = state.speed * 30;
  state.frameIdx += framesPerSec * dt;
  if (state.frameIdx >= state.data.frames.length - 1) {
    state.frameIdx = 0; // bucle
  }
  drawFrame(Math.floor(state.frameIdx));
  requestAnimationFrame(tick);
}

// ---------- desar a Google Sheets ----------
async function saveToSheets() {
  if (!state.data) return;
  if (!state.webappUrl) {
    setStatus("Configura GSHEET_WEBAPP_URL al servidor per desar.", "err");
    return;
  }
  const m = state.data.metrics, p = state.data.params;
  const params = new URLSearchParams({
    op: "append",
    num_buses: p.num_buses, num_stops: p.num_stops, capacity: p.capacity,
    sim_time: p.sim_time, variable_demand: p.variable_demand, seed: p.seed,
    mean_wait: m.mean_wait, mean_headway: m.mean_headway, headway_cv: m.headway_cv,
    total_rejected: m.total_rejected, max_queue: m.max_queue, mean_occupancy: m.mean_occupancy,
  });
  try {
    setStatus("Desant a Google Sheets…");
    // no-cors: Apps Script respon però el navegador amaga el cos; assumim OK si no hi ha error de xarxa
    await fetch(state.webappUrl + "?" + params.toString(), { method: "GET", mode: "no-cors" });
    setStatus("Fila enviada a Google Sheets ✓", "ok");
  } catch (e) {
    setStatus("No s'ha pogut desar: " + e.message, "err");
  }
}

// ---------- util ----------
function setStatus(msg, cls) {
  const el = document.getElementById("status");
  el.textContent = msg;
  el.className = "status" + (cls ? " " + cls : "");
}
