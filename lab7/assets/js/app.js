const API_BASE = "/lab7/api";
const userId = (() => {
  const key = "lab7-user-id";
  const stored = localStorage.getItem(key);
  if (stored) return stored;
  const id = crypto.randomUUID();
  localStorage.setItem(key, id);
  return id;
})();
const param = `?user=${encodeURIComponent(userId)}`;
const STREAM_URL = `${API_BASE}/stream${param}`;
const BULK_URL = `${API_BASE}/bulk${param}`;
const LIST_URL = `${API_BASE}/list${param}`;
const RESET_URL = `${API_BASE}/reset${param}`;
const TIME_URL = `${API_BASE}/time${param}`;

const playBtn = document.getElementById("play");
const work = document.getElementById("work");
const messagesEl = document.getElementById("messages");
const startBtn = document.getElementById("start");
const stopBtn = document.getElementById("stop");
const reloadBtn = document.getElementById("reload");
const closeBtn = document.getElementById("close");
const field = document.getElementById("field");
const ball = document.getElementById("ball");
const results = document.getElementById("results");
const summary = document.getElementById("summary");
const resetLogsBtn = document.getElementById("resetLogs");
const resultsBody = document.getElementById("results-body");
const streamStartEl = document.getElementById("stream-start");
const streamEndEl = document.getElementById("stream-end");
const streamSpanEl = document.getElementById("stream-span");
const bulkStartEl = document.getElementById("bulk-start");
const bulkEndEl = document.getElementById("bulk-end");
const bulkSpanEl = document.getElementById("bulk-span");
const offsetEl = document.getElementById("offset");
const deltaElId = "delta-line";

let seq = 0;
let timer = null;
let exited = false;
let vx = 0;
let vy = 0;
let offsetMs = 0;
const bulkKey = "lab7-bulk-events";

const nowIso = () => new Date().toISOString();
const readBulk = () => JSON.parse(localStorage.getItem(bulkKey) || "[]");
const writeBulk = (arr) => localStorage.setItem(bulkKey, JSON.stringify(arr));
const msOrNull = (val) => {
  const t = Date.parse(val);
  return Number.isNaN(t) ? null : t;
};
const fmtTime = (ms) => {
  if (ms == null) return "-";
  const d = new Date(ms);
  const base = d.toLocaleTimeString("uk-UA", { hour12: false });
  const msPart = String(d.getMilliseconds()).padStart(3, "0");
  return `${base}.${msPart}`;
};
const fmtSpan = (ms) => {
  if (ms == null) return "-";
  return `${Math.round(ms)}ms`;
};
const fmtOffset = (ms) => `${ms >= 0 ? "+" : "-"}${Math.abs(Math.round(ms))}ms`;

const pushBulk = (ev) => {
  const arr = readBulk();
  arr.push(ev);
  writeBulk(arr);
};

const sendStream = async (ev) => {
  try {
    await fetch(STREAM_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(ev),
    });
  } catch (e) {}
};

const log = (type, message) => {
  const ev = { seq: ++seq, type, message, clientTime: nowIso(), user: userId };
  const p = document.createElement("div");
  p.textContent = `${ev.seq}: ${message}`;
  messagesEl.prepend(p);
  pushBulk(ev);
  sendStream(ev);
};

const resetBall = () => {
  exited = false;
  ball.style.left = "0px";
  ball.style.top = "0px";
};

const showStart = () => {
  startBtn.style.display = "inline-block";
  stopBtn.style.display = "none";
  reloadBtn.style.display = "none";
};

const showStop = () => {
  startBtn.style.display = "none";
  stopBtn.style.display = "inline-block";
  reloadBtn.style.display = "none";
};

const showReload = () => {
  startBtn.style.display = "none";
  stopBtn.style.display = "none";
  reloadBtn.style.display = "inline-block";
};

const pickVelocity = () => {
  const angle = (20 + Math.random() * 50) * (Math.PI / 180);
  const speed = 3.5;
  vx = Math.cos(angle) * speed;
  vy = Math.sin(angle) * speed;
};

const resetSession = () => {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  seq = 0;
  exited = false;
  messagesEl.innerHTML = "";
  resetBall();
  showStart();
  results.style.display = "none";
  summary.style.display = "none";
};

const resetServer = async () => {
  try {
    await fetch(RESET_URL, { method: "POST" });
  } catch (e) {}
};

const run = () => {
  const fw = field.clientWidth;
  const fh = field.clientHeight;
  if (!fw || !fh) return;
  pickVelocity();
  timer = setInterval(() => {
    const x = ball.offsetLeft;
    const y = ball.offsetTop;
    const d = 20;
    let nx = x + vx;
    let ny = y + vy;
    if (ny <= 0) {
      ny = 0;
      vy = Math.abs(vy);
      log("hit", "top");
    }
    if (ny >= fh - d) {
      ny = fh - d;
      vy = -Math.abs(vy);
      log("hit", "bottom");
    }
    if (nx >= fw - d) {
      exited = true;
      clearInterval(timer);
      timer = null;
      ball.style.left = `${fw + 5}px`;
      log("exit", "right wall pass");
      showReload();
      return;
    }
    ball.style.left = `${nx}px`;
    ball.style.top = `${ny}px`;
    log("step", `x=${nx.toFixed(1)}, y=${ny.toFixed(1)}`);
  }, 20);
};

const flushBulk = async (events) => {
  if (!events || !events.length) {
    localStorage.removeItem(bulkKey);
    return null;
  }
  try {
    const res = await fetch(BULK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ events }),
    });
    if (!res.ok) {
      const text = await res.text();
      return text || `Помилка ${res.status}`;
    }
  } catch (e) {
    return "Не вдалося зберегти bulk";
  }
  localStorage.removeItem(bulkKey);
  return null;
};

const loadOffset = async () => {
  try {
    const res = await fetch(TIME_URL);
    if (!res.ok) throw new Error("status");
    const data = await res.json();
    const serverTs = msOrNull(data.serverTime);
    if (serverTs != null) {
      offsetMs = serverTs - Date.now();
      offsetEl.textContent = `Зсув часу сервера: ${fmtOffset(offsetMs)}`;
    }
  } catch (e) {
    offsetEl.textContent = "Не вдалося отримати час сервера";
  }
};

const renderResults = async (localEvents) => {
  try {
    const res = await fetch(LIST_URL);
    if (!res.ok) throw new Error(`status ${res.status}`);
    const data = await res.json();
    const streamItems = data.stream || [];
    const serverBulk = data.bulk && Array.isArray(data.bulk.events) ? data.bulk.events : [];
    const bulkItems = localEvents && localEvents.length ? localEvents : serverBulk;
    const maxRows = Math.max(streamItems.length, bulkItems.length);
    resultsBody.innerHTML = "";
    for (let i = 0; i < maxRows; i++) {
      const tr = document.createElement("tr");
      const s = streamItems[i];
      const b = bulkItems[i];
      const tdS = document.createElement("td");
      if (s) {
        const tServer = msOrNull(s.serverTime);
        const tClient = msOrNull(s.clientTime);
        tdS.textContent = `#${s.seq} ${s.type} ${s.message} | server ${fmtTime(tServer)} | client ${fmtTime(tClient)}`;
      } else {
        tdS.textContent = "";
      }
      const tdB = document.createElement("td");
      if (b) {
        const t = msOrNull(b.clientTime);
        tdB.textContent = `#${b.seq} ${b.type} ${b.message} | local ${fmtTime(t)}`;
      } else {
        tdB.textContent = "";
      }
      tr.appendChild(tdS);
      tr.appendChild(tdB);
      resultsBody.appendChild(tr);
    }
    const sTimes = streamItems.map((e) => msOrNull(e.serverTime)).filter((v) => v != null);
    const bTimes = bulkItems.map((e) => msOrNull(e.clientTime)).filter((v) => v != null);
    const sSpan = sTimes.length ? Math.max(...sTimes) - Math.min(...sTimes) : null;
    const bSpan = bTimes.length ? Math.max(...bTimes) - Math.min(...bTimes) : null;
    streamStartEl.textContent = fmtTime(sTimes.length ? Math.min(...sTimes) : null);
    streamEndEl.textContent = fmtTime(sTimes.length ? Math.max(...sTimes) : null);
    streamSpanEl.textContent = fmtSpan(sSpan);
    bulkStartEl.textContent = fmtTime(bTimes.length ? Math.min(...bTimes) : null);
    bulkEndEl.textContent = fmtTime(bTimes.length ? Math.max(...bTimes) : null);
    bulkSpanEl.textContent = fmtSpan(bSpan);
    results.style.display = maxRows ? "block" : "none";
    summary.style.display = "block";
    if (!maxRows) {
      summary.textContent = "Дані відсутні";
      return;
    }
    const sDeltas = [];
    for (let i = 1; i < sTimes.length; i++) sDeltas.push(sTimes[i] - sTimes[i - 1]);
    const bDeltas = [];
    for (let i = 1; i < bTimes.length; i++) bDeltas.push(bTimes[i] - bTimes[i - 1]);
    const minS = sDeltas.length ? Math.min(...sDeltas) : null;
    const maxS = sDeltas.length ? Math.max(...sDeltas) : null;
    const minB = bDeltas.length ? Math.min(...bDeltas) : null;
    const maxB = bDeltas.length ? Math.max(...bDeltas) : null;
    let deltaRange = "";
    const bulkBySeq = new Map();
    bulkItems.forEach((e) => bulkBySeq.set(e.seq, e));
    const deltas = [];
    streamItems.forEach((e) => {
      const pair = bulkBySeq.get(e.seq);
      if (!pair) return;
      const tS = msOrNull(e.serverTime);
      const tB = msOrNull(pair.clientTime);
      if (tS == null || tB == null) return;
      deltas.push(tS - (tB + offsetMs));
    });
    if (deltas.length) {
      const minD = Math.min(...deltas);
      const maxD = Math.max(...deltas);
      deltaRange = `; Δ(server vs bulk+offset) ${fmtSpan(minD)}..${fmtSpan(maxD)}`;
    }
    summary.textContent = `Записів stream=${streamItems.length}, bulk=${bulkItems.length}. Інтервали stream ${fmtSpan(minS)}..${fmtSpan(maxS)}, bulk ${fmtSpan(minB)}..${fmtSpan(maxB)}. ${offsetEl.textContent}${deltaRange}`;
  } catch (e) {
    results.style.display = "none";
    summary.style.display = "block";
    summary.textContent = `Не вдалося отримати дані (${e.message})`;
  }
};

playBtn.addEventListener("click", async () => {
  resetSession();
  work.classList.add("visible");
  work.setAttribute("aria-hidden", "false");
  results.style.display = "none";
  summary.style.display = "none";
  log("ui", "open work");
});

closeBtn.addEventListener("click", async () => {
  work.classList.remove("visible");
  work.setAttribute("aria-hidden", "true");
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  showStart();
  log("btn", "close");
  const localEvents = readBulk();
  const bulkError = await flushBulk(localEvents);
  await loadOffset();
  await renderResults(localEvents);
  if (bulkError) {
    summary.style.display = "block";
    summary.textContent = `${summary.textContent} | ${bulkError}`;
  }
});

startBtn.addEventListener("click", () => {
  if (timer) return;
  if (exited) resetBall();
  log("btn", "start");
  run();
  showStop();
});

stopBtn.addEventListener("click", () => {
  if (timer) {
    clearInterval(timer);
    timer = null;
    log("btn", "stop");
    showStart();
  }
});

reloadBtn.addEventListener("click", () => {
  resetBall();
  exited = false;
  log("btn", "reload");
  showStart();
});

resetBall();
showStart();
messagesEl.textContent = "";
loadOffset();
renderResults([]);

resetLogsBtn.addEventListener("click", async () => {
  try {
    const res = await fetch(RESET_URL, { method: "POST" });
    if (!res.ok) throw new Error("reset failed");
    localStorage.removeItem(bulkKey);
    messagesEl.innerHTML = "";
    results.style.display = "none";
    summary.style.display = "block";
    summary.textContent = "Логи очищені";
    await loadOffset();
    await renderResults([]);
  } catch (e) {
    summary.style.display = "block";
    summary.textContent = "Не вдалося очистити логи";
  }
});
