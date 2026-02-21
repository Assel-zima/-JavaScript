const STORAGE_KEY = "ssp.tasks.v1";
const THEME_KEY = "ssp.theme";
const STREAK_KEY = "ssp.streak.v1";

const els = {
  taskId: document.getElementById("taskId"),
  modal: document.getElementById("modal"),
  modalBackdrop: document.getElementById("modalBackdrop"),
  btnOpenModal: document.getElementById("btnOpenModal"),
  btnCloseModal: document.getElementById("btnCloseModal"),
  btnCancel: document.getElementById("btnCancel"),
  form: document.getElementById("taskForm"),
  list: document.getElementById("taskList"),
  btnClearDone: document.getElementById("btnClearDone"),
  btnResetAll: document.getElementById("btnResetAll"),
  search: document.getElementById("search"),
  filter: document.getElementById("filter"),
  sort: document.getElementById("sort"),
  btnTheme: document.getElementById("btnTheme"),
  toast: document.getElementById("toast"),
  statTotal: document.getElementById("statTotal"),
  statDone: document.getElementById("statDone"),
  statOverdue: document.getElementById("statOverdue"),
  statStreak: document.getElementById("statStreak"),
  title: document.getElementById("title"),
  deadline: document.getElementById("deadline"),
  priority: document.getElementById("priority"),
  email: document.getElementById("email"),
  notes: document.getElementById("notes")
};

let tasks = loadTasks();
let editingId = null;
applySavedTheme();
render();

els.btnOpenModal.addEventListener("click", () => openModal());

els.btnCloseModal.addEventListener("click", closeModal);
els.btnCancel.addEventListener("click", closeModal);
els.modalBackdrop.addEventListener("click", closeModal);

document.addEventListener("keydown", e => {
  if (e.key === "Escape" && isModalOpen()) closeModal();
});

els.form.addEventListener("submit", e => {
  e.preventDefault();

  const data = getFormData();
  const errors = validateForm(data);
  showErrors(errors);

  if (Object.keys(errors).length > 0) {
    toast("Проверь поля — есть ошибки", "err");
    return;
  }

  if (editingId) {
    updateTask(editingId, data);
    toast("Задача обновлена ✏️", "ok");
  } else {
    addTask(data);
    toast("Задача добавлена ✅", "ok");
  }

  closeModal();
  els.form.reset();
  els.taskId.value = "";
  editingId = null;
  clearErrors();
});

["input", "change"].forEach(evt => {
  els.title.addEventListener(evt, () => liveValidate());
  els.deadline.addEventListener(evt, () => liveValidate());
  els.email.addEventListener(evt, () => liveValidate());
});

els.search.addEventListener("input", render);
els.filter.addEventListener("change", render);
els.sort.addEventListener("change", render);

els.btnClearDone.addEventListener("click", () => {
  const before = tasks.length;
  tasks = tasks.filter(t => !t.done);
  saveTasks();
  render();
  toast(`Удалено выполненных: ${before - tasks.length}`, "ok");
});

els.btnResetAll.addEventListener("click", () => {
  if (!confirm("Точно сбросить все задачи?")) return;
  tasks = [];
  saveTasks();
  resetStreak();
  render();
  toast("Все задачи сброшены", "ok");
});

els.btnTheme.addEventListener("click", () => {
  const root = document.documentElement;
  const isLight = root.getAttribute("data-theme") === "light";
  root.setAttribute("data-theme", isLight ? "dark" : "light");
  localStorage.setItem(THEME_KEY, isLight ? "dark" : "light");
  toast(`Тема: ${isLight ? "тёмная" : "светлая"}`, "ok");
});

els.list.addEventListener("click", e => {
  const btn = e.target.closest("button");
  const row = e.target.closest("[data-id]");
  if (!row || !btn) return;

  const id = row.dataset.id;
  const action = btn.dataset.action;

  if (action === "delete") {
    tasks = tasks.filter(t => t.id !== id);
    saveTasks();
    render();
    toast("Удалено 🗑️", "ok");
  }

  if (action === "toggle") {
    toggleDone(id);
    saveTasks();
    render();
  }
  if (action === "edit") {
    openEdit(id);
  }
  function openEdit(id) {
    const t = tasks.find(x => x.id === id);
    if (!t) return;

    editingId = id;
    openModal();

    els.taskId.value = id;
    els.title.value = t.title;
    els.deadline.value = t.deadline;
    els.priority.value = String(t.priority);
    els.email.value = t.email;
    els.notes.value = t.notes || "";

    const titleEl = document.getElementById("modalTitle");
    if (titleEl) titleEl.textContent = "Редактировать задачу";
  }
});

els.list.addEventListener("change", e => {
  const cb = e.target.closest('input[type="checkbox"][data-action="toggle"]');
  const row = e.target.closest("[data-id]");
  if (!cb || !row) return;

  toggleDone(row.dataset.id);
  saveTasks();
  render();
});

function getFormData() {
  return {
    taskId: els.taskId.value,
    title: els.title.value.trim(),
    deadline: els.deadline.value,
    priority: Number(els.priority.value),
    email: els.email.value.trim(),
    notes: els.notes.value.trim()
  };
}

function validateForm(data) {
  const errors = {};

  if (!data.title) errors.title = "Название обязательно.";
  else if (data.title.length < 3) errors.title = "Минимум 3 символа.";

  if (!data.deadline) errors.deadline = "Выбери дату дедлайна.";

  if (!data.email) errors.email = "Email обязателен.";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email))
    errors.email = "Некорректный email.";

  if (data.deadline) {
    const today = startOfDay(new Date());
    const dl = startOfDay(new Date(data.deadline));
    if (dl < today) errors.deadline = "Дедлайн не может быть в прошлом.";
  }

  return errors;
}

function liveValidate() {
  const data = getFormData();
  const errors = validateForm(data);
  showErrors(errors, { silentOk: true });
}

function showErrors(errors, opts = {}) {
  const map = ["title", "deadline", "email"];

  map.forEach(name => {
    const input = els[name];
    const errEl = document.querySelector(`[data-error-for="${name}"]`);
    const message = errors[name] || "";

    errEl.textContent = message;

    if (message) input.classList.add("is-invalid");
    else {
      input.classList.remove("is-invalid");
      if (!opts.silentOk) errEl.textContent = "";
    }
  });
}

function clearErrors() {
  showErrors({});
}

function addTask(data) {
  const task = {
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    title: data.title,
    deadline: data.deadline,
    priority: data.priority,
    email: data.email,
    notes: data.notes,
    done: false,
    createdAt: Date.now(),
    doneAt: null
  };
  tasks.unshift(task);
  saveTasks();
  render();
}

function updateTask(id, data) {
  const t = tasks.find(x => x.id === id);
  if (!t) return;

  t.title = data.title;
  t.deadline = data.deadline;
  t.priority = data.priority;
  t.email = data.email;
  t.notes = data.notes;

  saveTasks();
  render();
}

function toggleDone(id) {
  const t = tasks.find(x => x.id === id);
  if (!t) return;

  t.done = !t.done;
  t.doneAt = t.done ? Date.now() : null;
  if (t.done) beep();

  if (t.done) bumpStreakIfNewDay();

  toast(t.done ? "Выполнено ✅" : "Снято выполнение ↩️", "ok");
}

function render() {
  const view = getVisibleTasks(tasks);
  els.list.innerHTML = view.length
    ? view.map(renderTask).join("")
    : renderEmpty();

  const total = tasks.length;
  const done = tasks.filter(t => t.done).length;
  const overdue = tasks.filter(t => !t.done && isOverdue(t.deadline)).length;

  animateNumber(els.statTotal, total);
  animateNumber(els.statDone, done);
  animateNumber(els.statOverdue, overdue);
  animateNumber(els.statStreak, getStreak().count);
}

function getVisibleTasks(all) {
  const q = els.search.value.trim().toLowerCase();
  const filter = els.filter.value;
  const sort = els.sort.value;

  let arr = [...all];

  if (q) {
    arr = arr.filter(
      t =>
        t.title.toLowerCase().includes(q) ||
        (t.notes && t.notes.toLowerCase().includes(q))
    );
  }

  if (filter === "active") arr = arr.filter(t => !t.done);
  if (filter === "done") arr = arr.filter(t => t.done);
  if (filter === "overdue")
    arr = arr.filter(t => !t.done && isOverdue(t.deadline));

  const pr = t => t.priority;
  const dl = t => new Date(t.deadline).getTime();

  if (sort === "dateAsc") arr.sort((a, b) => dl(a) - dl(b));
  if (sort === "dateDesc") arr.sort((a, b) => dl(b) - dl(a));
  if (sort === "prioDesc") arr.sort((a, b) => pr(b) - pr(a));
  if (sort === "prioAsc") arr.sort((a, b) => pr(a) - pr(b));

  return arr;
}

function renderTask(t) {
  const overdue = !t.done && isOverdue(t.deadline);
  const prioBadge =
    t.priority === 3
      ? `<span class="badge badge--prio3">Высокий</span>`
      : t.priority === 2
      ? `<span class="badge">Средний</span>`
      : `<span class="badge">Низкий</span>`;

  const statusBadge = t.done
    ? `<span class="badge badge--done">Выполнено</span>`
    : overdue
    ? `<span class="badge badge--overdue">Просрочено</span>`
    : "";

  const notes = t.notes
    ? `<div class="task__meta"><span class="badge">📝 ${escapeHtml(
        t.notes
      )}</span></div>`
    : "";

  return `
    <div class="task ${t.done ? "is-done" : ""}" data-id="${t.id}">
      <input class="checkbox" type="checkbox" data-action="toggle" ${
        t.done ? "checked" : ""
      } aria-label="Отметить выполнено"/>
      <div class="task__main">
        <div class="task__title">
          <span>${escapeHtml(t.title)}</span>
        </div>
        <div class="task__meta">
          <span class="badge">📅 ${formatDate(t.deadline)}</span>
          ${prioBadge}
          ${statusBadge}
          <span class="badge">✉️ ${escapeHtml(t.email)}</span>
        </div>
        ${notes}
      </div>
      <div class="task__actions">
  <button class="smallbtn" data-action="toggle" type="button">${
    t.done ? "↩️" : "✅"
  }</button>
  <button class="smallbtn" data-action="edit" type="button">✏️</button>
  <button class="smallbtn" data-action="delete" type="button">🗑️</button>
</div>
    </div>
  `;
}

function renderEmpty() {
  return `
    <div class="task" style="grid-template-columns: 1fr;">
      <div class="task__main">
        <div class="task__title">Пока пусто.</div>
        <div class="task__meta">
          Нажми <b>“+ Добавить”</b>, чтобы создать первую задачу.
        </div>
      </div>
    </div>
  `;
}

function openModal() {
  els.modal.classList.add("is-open");
  els.modal.setAttribute("aria-hidden", "false");

  els.deadline.min = toISODate(startOfDay(new Date()));

  setTimeout(() => els.title.focus(), 0);
  const titleEl = document.getElementById("modalTitle");
  if (titleEl)
    titleEl.textContent = editingId
      ? "Редактировать задачу"
      : "Добавить задачу";
}

function closeModal() {
  els.modal.classList.remove("is-open");
  els.modal.setAttribute("aria-hidden", "true");
  clearErrors();
}

function isModalOpen() {
  return els.modal.classList.contains("is-open");
}

function loadTasks() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveTasks() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

function applySavedTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  const root = document.documentElement;
  if (saved === "light" || saved === "dark") {
    root.setAttribute("data-theme", saved);
  } else {
    root.setAttribute("data-theme", "dark");
  }
}

function toast(message, type = "ok") {
  const item = document.createElement("div");
  item.className = `toast__item ${
    type === "err" ? "toast__item--err" : "toast__item--ok"
  }`;
  item.innerHTML = `<b>${escapeHtml(
    message
  )}</b><small>${new Date().toLocaleString("ru-RU")}</small>`;
  els.toast.appendChild(item);

  setTimeout(() => {
    item.style.opacity = "0";
    item.style.transform = "translateY(6px)";
    item.style.transition = "all .25s ease";
  }, 2400);

  setTimeout(() => item.remove(), 2800);
}

function getStreak() {
  try {
    const raw = localStorage.getItem(STREAK_KEY);
    return raw ? JSON.parse(raw) : { count: 0, lastDay: null };
  } catch {
    return { count: 0, lastDay: null };
  }
}

function setStreak(obj) {
  localStorage.setItem(STREAK_KEY, JSON.stringify(obj));
}

function resetStreak() {
  setStreak({ count: 0, lastDay: null });
}

function bumpStreakIfNewDay() {
  const s = getStreak();
  const todayIso = toISODate(startOfDay(new Date()));

  if (s.lastDay === todayIso) return;

  const yesterdayIso = toISODate(addDays(startOfDay(new Date()), -1));
  const nextCount = s.lastDay === yesterdayIso ? s.count + 1 : 1;

  setStreak({ count: nextCount, lastDay: todayIso });
}

function isOverdue(deadlineISO) {
  const today = startOfDay(new Date());
  const dl = startOfDay(new Date(deadlineISO));
  return dl < today;
}

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
}

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(d, days) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

function toISODate(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
function animateNumber(el, to) {
  const from = Number(el.textContent || "0");
  const start = performance.now();
  const dur = 320;

  function tick(now) {
    const p = Math.min(1, (now - start) / dur);
    const val = Math.round(from + (to - from) * p);
    el.textContent = String(val);
    if (p < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.value = 880;
    g.gain.value = 0.03;
    o.connect(g);
    g.connect(ctx.destination);
    o.start();
    setTimeout(() => {
      o.stop();
      ctx.close();
    }, 90);
  } catch {}
}

(function initSlider() {
  const slider = document.getElementById("slider");
  if (!slider) return;

  const track = document.getElementById("sliderTrack");
  const btnPrev = document.getElementById("sliderPrev");
  const btnNext = document.getElementById("sliderNext");
  const dotsWrap = document.getElementById("sliderDots");

  const slides = Array.from(track.querySelectorAll(".slide"));
  const total = slides.length;

  let index = 0;
  let timer = null;

  const dots = slides.map((_, i) => {
    const d = document.createElement("button");
    d.type = "button";
    d.className = "dot";
    d.setAttribute("aria-label", `Слайд ${i + 1}`);
    d.addEventListener("click", () => goTo(i));
    dotsWrap.appendChild(d);
    return d;
  });

  function paint() {
    track.style.transform = `translateX(-${index * 100}%)`;
    dots.forEach((d, i) => d.classList.toggle("is-active", i === index));
  }

  function goTo(i) {
    index = (i + total) % total;
    paint();
  }

  function next() {
    goTo(index + 1);
  }
  function prev() {
    goTo(index - 1);
  }

  btnNext.addEventListener("click", next);
  btnPrev.addEventListener("click", prev);

  function startAuto() {
    stopAuto();
    timer = setInterval(next, 4000);
  }
  function stopAuto() {
    if (timer) clearInterval(timer);
    timer = null;
  }

  slider.addEventListener("mouseenter", stopAuto);
  slider.addEventListener("mouseleave", startAuto);

  let startX = null;
  slider.addEventListener(
    "touchstart",
    e => {
      startX = e.touches[0].clientX;
    },
    { passive: true }
  );
  slider.addEventListener(
    "touchend",
    e => {
      if (startX === null) return;
      const endX = e.changedTouches[0].clientX;
      const dx = endX - startX;
      if (Math.abs(dx) > 40) dx < 0 ? next() : prev();
      startX = null;
    },
    { passive: true }
  );

  paint();
  startAuto();
})();
