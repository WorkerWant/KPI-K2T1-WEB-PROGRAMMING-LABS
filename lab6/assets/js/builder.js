const API_URL = "http://localhost:8090/accordion";

const listEl = document.getElementById("list");
const previewEl = document.getElementById("preview");
const statusEl = document.getElementById("status");
const addBtn = document.getElementById("add");
const clearBtn = document.getElementById("clear");
const saveBtn = document.getElementById("save");

function makeRow(title = "", content = "") {
  const row = document.createElement("div");
  row.className = "row";

  const titleInput = document.createElement("input");
  titleInput.placeholder = "Заголовок";
  titleInput.value = title;

  const textArea = document.createElement("textarea");
  textArea.placeholder = "Вміст";
  textArea.value = content;

  const del = document.createElement("button");
  del.className = "btn";
  del.textContent = "x";

  del.addEventListener("click", () => {
    row.remove();
    renderPreview();
  });

  [titleInput, textArea].forEach((input) => input.addEventListener("input", renderPreview));

  row.append(titleInput, textArea, del);
  return row;
}

function getItems() {
  return Array.from(listEl.querySelectorAll(".row"))
    .map((row) => {
      const title = row.children[0]?.value.trim() || "";
      const content = row.children[1]?.value.trim() || "";
      return { title, content };
    })
    .filter((item) => item.title || item.content);
}

function renderPreview() {
  const items = getItems();
  previewEl.innerHTML = "";
  items.forEach((it, idx) => {
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
    previewEl.appendChild(item);
  });
}

async function loadInitial() {
  try {
    statusEl.textContent = "Завантаження...";
    const res = await fetch(API_URL);
    if (!res.ok) throw new Error("bad response");
    const data = await res.json();
    const items = Array.isArray(data.items) ? data.items : [];
    listEl.innerHTML = "";
    items.forEach((it) => listEl.appendChild(makeRow(it.title || "", it.content || "")));
    if (listEl.childElementCount === 0) {
      addSample();
    }
    renderPreview();
    statusEl.textContent = data.updated ? `Оновлено: ${data.updated}` : "";
  } catch (err) {
    statusEl.textContent = "Не вдалося завантажити, використовуйте приклад";
    addSample();
    renderPreview();
  }
}

function addSample() {
  if (listEl.childElementCount > 0) return;
  listEl.appendChild(makeRow("Strategy", "Текст першого елемента"));
  listEl.appendChild(makeRow("Concept", "Текст другого елемента"));
}

async function saveData() {
  const items = getItems();
  try {
    statusEl.textContent = "Збереження...";
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
    });
    if (!res.ok) throw new Error("bad response");
    const data = await res.json();
    statusEl.textContent = data.updated ? `Збережено: ${data.updated}` : "Збережено";
  } catch (err) {
    statusEl.textContent = "Помилка збереження";
  }
}

addBtn?.addEventListener("click", () => {
  listEl.appendChild(makeRow());
  renderPreview();
});

clearBtn?.addEventListener("click", () => {
  listEl.innerHTML = "";
  previewEl.innerHTML = "";
});

saveBtn?.addEventListener("click", saveData);

loadInitial();
