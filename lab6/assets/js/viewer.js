const API_URL = "/lab6/api/accordion";

const viewEl = document.getElementById("view");
const stampEl = document.getElementById("stamp");
let last = "";

async function fetchData() {
  try {
    const res = await fetch(API_URL);
    if (!res.ok) throw new Error("bad response");
    const data = await res.json();
    const snapshot = JSON.stringify(data);
    if (snapshot !== last) {
      last = snapshot;
      render(data);
    }
    stampEl.textContent = `Оновлено: ${data.updated || "нема даних"}`;
  } catch (err) {
    stampEl.textContent = "Помилка завантаження";
  }
}

function render(data) {
  viewEl.innerHTML = "";
  (data.items || []).forEach((it, idx) => {
    const item = document.createElement("div");
    item.className = "acc-item";
    const btn = document.createElement("button");
    btn.className = "acc-btn";
    btn.textContent = it.title || `Елемент ${idx + 1}`;
    const panel = document.createElement("div");
    panel.className = "acc-panel";
    panel.innerHTML = it.content || "";
    btn.addEventListener("click", () => item.classList.toggle("active"));
    item.append(btn, panel);
    viewEl.appendChild(item);
  });
}

fetchData();
setInterval(fetchData, 10000);
