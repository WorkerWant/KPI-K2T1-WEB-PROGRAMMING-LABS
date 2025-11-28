document.addEventListener("DOMContentLoaded", () => {
  const tagX = document.querySelector(".tag-x");
  const tagY = document.querySelector(".tag-y");
  if (tagX && tagY) {
    const temp = tagX.innerHTML;
    tagX.innerHTML = tagY.innerHTML;
    tagY.innerHTML = temp;
  }

  const radius = 8;
  const area = Math.PI * radius * radius;
  const areaTarget = document.querySelector("[data-area-result]");
  if (areaTarget) {
    areaTarget.textContent = `Площа кола з радіусом ${radius}: ${area.toFixed(2)}`;
  }

  const block2 = document.querySelector(".block-2");
  const colorInput = document.getElementById("colorInput");
  const storedColor = localStorage.getItem("block2Color");
  if (block2 && storedColor) {
    block2.style.backgroundColor = storedColor;
    if (colorInput) colorInput.value = storedColor;
  }
  if (colorInput && block2) {
    colorInput.addEventListener("blur", () => {
      const value = colorInput.value || "#f8e5d5";
      block2.style.backgroundColor = value;
      localStorage.setItem("block2Color", value);
    });
  }

  const maxSection = document.getElementById("maxSection");
  const maxForm = document.getElementById("maxForm");
  const maxInputs = maxForm ? Array.from(maxForm.querySelectorAll(".max-input")) : [];

  const setCookie = (name, value, days = 7) => {
    const date = new Date();
    date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
    document.cookie = `${name}=${encodeURIComponent(value)}; expires=${date.toUTCString()}; path=/`;
  };

  const getCookie = (name) => {
    const parts = document.cookie.split(";").map((part) => part.trim());
    for (const part of parts) {
      if (part.startsWith(`${name}=`)) {
        return decodeURIComponent(part.substring(name.length + 1));
      }
    }
    return "";
  };

  const deleteCookie = (name) => {
    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:01 GMT; path=/`;
  };

  const cookieValue = getCookie("maxResult");
  if (cookieValue) {
    if (maxSection) maxSection.style.display = "none";
    const askDelete = confirm(`Дані з cookies: ${cookieValue}. Видалити дані?`);
    if (askDelete) {
      deleteCookie("maxResult");
      location.reload();
    } else {
      alert("Cookies збережені. Перезавантажте сторінку для повернення форми.");
    }
  }

  if (maxForm) {
    maxForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const values = maxInputs
        .map((input) => input.value.trim())
        .filter((value) => value !== "")
        .map((value) => Number(value))
        .filter((n) => !Number.isNaN(n));
      if (values.length === 0) {
        alert("Введіть хоча б одне число");
        return;
      }
      const max = Math.max(...values);
      const count = values.filter((n) => n === max).length;
      const payload = `максимум ${max}, кількість ${count}`;
      alert(`Результат: ${payload}`);
      setCookie("maxResult", payload);
    });
  }

  const randomColor = () => {
    const r = Math.floor(Math.random() * 156) + 80;
    const g = Math.floor(Math.random() * 156) + 80;
    const b = Math.floor(Math.random() * 156) + 80;
    return `rgb(${r}, ${g}, ${b})`;
  };

  const originals = {};

  const applyStoredContent = (block, body, id) => {
    const saved = localStorage.getItem(`blockContent-${id}`);
    if (saved) {
      body.innerHTML = saved;
      addResetButton(block, body, id);
    }
  };

  const addResetButton = (block, body, id) => {
    const existing = block.querySelector(`.reset-btn[data-block="${id}"]`);
    if (existing) return;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "reset-btn";
    btn.dataset.block = id;
    btn.textContent = "Скинути вміст";
    btn.addEventListener("click", () => {
      localStorage.removeItem(`blockContent-${id}`);
      body.innerHTML = originals[id];
      block.style.backgroundColor = "";
      btn.remove();
    });
    const actions = block.querySelector(".edit-actions");
    if (actions) {
      block.insertBefore(btn, actions);
    } else {
      body.insertAdjacentElement("afterend", btn);
    }
  };

  const createEditor = (block, body, id, link) => {
    if (block.querySelector(".editor")) return;
    const wrapper = document.createElement("div");
    wrapper.className = "editor";
    const textarea = document.createElement("textarea");
    textarea.value = body.innerHTML;
    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.className = "save-btn";
    saveBtn.textContent = "Зберегти";
    wrapper.appendChild(textarea);
    wrapper.appendChild(saveBtn);
    const actions = link.parentElement;
    actions.appendChild(wrapper);

    saveBtn.addEventListener("click", () => {
      const newContent = textarea.value;
      body.innerHTML = newContent;
      localStorage.setItem(`blockContent-${id}`, newContent);
      block.style.backgroundColor = randomColor();
      addResetButton(block, body, id);
      wrapper.remove();
    });
  };

  document.querySelectorAll(".editable").forEach((block) => {
    const id = block.dataset.block;
    const body = block.querySelector(".editable-body");
    if (!id || !body) return;
    originals[id] = body.innerHTML;
    applyStoredContent(block, body, id);
  });

  document.querySelectorAll(".edit-link").forEach((link) => {
    link.addEventListener("click", (event) => event.preventDefault());
    link.addEventListener("dblclick", (event) => {
      event.preventDefault();
      const block = link.closest(".editable");
      if (!block) return;
      const id = block.dataset.block;
      const body = block.querySelector(".editable-body");
      if (!id || !body) return;
      createEditor(block, body, id, link);
    });
  });
});
