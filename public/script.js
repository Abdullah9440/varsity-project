// Load saved data
let tasks = JSON.parse(localStorage.getItem("tasks")) || [];
let currentFilter = "all"; // "all", "active" or "completed"
let editingId = null;      // id of the task being edited (null = adding a new task)

// Get elements from the page
const form = document.getElementById("task-form");
const titleInput = document.getElementById("task-title");
const dateInput = document.getElementById("task-date");
const startInput = document.getElementById("task-start");
const alarmInput = document.getElementById("task-alarm");
const categoryInput = document.getElementById("task-category");
const notesInput = document.getElementById("task-notes");
const submitBtn = document.getElementById("submit-btn");
const cancelBtn = document.getElementById("cancel-btn");
const searchInput = document.getElementById("search");
const sortSelect = document.getElementById("sort");
const taskList = document.getElementById("task-list");
const filterButtons = document.querySelectorAll(".filter-btn");
const clearBtn = document.getElementById("clear-btn");
const themeBtn = document.getElementById("theme-btn");

// Date picker that shows dd/mm/yyyy but stores YYYY-MM-DD
const datePicker = flatpickr(dateInput, {
  dateFormat: "Y-m-d",   // value saved in the task
  altInput: true,        // show a second, friendlier box
  altFormat: "d/m/Y",    // what the user sees
  altInputClass: "date-input",
  disableMobile: true    // keep the same format on phones
});

// Time pickers: show 12-hour time (e.g. 9:30 AM) but store 24-hour HH:MM
function makeTimePicker(input) {
  return flatpickr(input, {
    enableTime: true,
    noCalendar: true,
    dateFormat: "H:i",
    altInput: true,
    altFormat: "h:i K",
    altInputClass: "time-input",
    minuteIncrement: 5,
    disableMobile: true
  });
}
const startPicker = makeTimePicker(startInput);

// Categories that are scheduled events (shown in "Classes & meetings")
const scheduleCategories = ["Meeting", "Class", "Exam"];

// Convert HH:MM (24h) to h:MM AM/PM for display
function formatTime(timeString) {
  const parts = timeString.split(":");
  let hours = Number(parts[0]);
  const suffix = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  return hours + ":" + parts[1] + " " + suffix;
}

// Current time as HH:MM (24h)
function nowTimeString() {
  const d = new Date();
  return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
}

// Minutes between two HH:MM values (b - a)
function minutesBetween(a, b) {
  const pa = a.split(":"), pb = b.split(":");
  return (Number(pb[0]) * 60 + Number(pb[1])) - (Number(pa[0]) * 60 + Number(pa[1]));
}

// Convert YYYY-MM-DD to dd/mm/yyyy for display
function formatDate(dateString) {
  const parts = dateString.split("-");
  return parts[2] + "/" + parts[1] + "/" + parts[0];
}

// Save tasks to localStorage
function saveTasks() {
  localStorage.setItem("tasks", JSON.stringify(tasks));
  scheduleAlarmSync();
}

// Today's date as YYYY-MM-DD (same format that is saved in tasks)
function todayString() {
  const d = new Date();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return d.getFullYear() + "-" + month + "-" + day;
}

// Returns "overdue", "soon", "today" or "" for a task
function getDueStatus(task) {
  if (task.done || !task.date) {
    return "";
  }
  const today = todayString();
  if (task.date < today) {
    return "overdue";
  }
  if (task.date === today) {
    const now = nowTimeString();
    if (task.startTime && now > task.startTime) {
      return "overdue";
    }
    if (task.startTime) {
      const mins = minutesBetween(now, task.startTime);
      if (mins >= 0 && mins <= 60) {
        return "soon";
      }
    }
    return "today";
  }
  return "";
}

// Value used to sort by date and time (no date goes last)
function whenKey(task) {
  return (task.date || "9999-12-31") + " " + (task.startTime || "99:99");
}

// ---------- Add, edit, toggle, delete ----------

function addTask(title, date, startTime, alarm, category, notes) {
  tasks.push({
    id: Date.now(),
    title: title,
    date: date,
    startTime: startTime,
    alarm: alarm,
    alarmRang: false,
    category: category,
    notes: notes,
    done: false
  });
}

function updateTask(id, title, date, startTime, alarm, category, notes) {
  tasks = tasks.map(function (task) {
    if (task.id === id) {
      task.title = title;
      task.date = date;
      task.startTime = startTime;
      // Re-arm the alarm if it was changed or moved to a new time
      if (task.alarm !== alarm || task.date !== date || task.startTime !== startTime) {
        task.alarmRang = false;
        delete task.snoozeUntil;
      }
      task.alarm = alarm;
      delete task.endTime; // end time is no longer used
      task.category = category;
      task.notes = notes;
    }
    return task;
  });
}

function toggleTask(id) {
  if (ringingId === id) {
    closeAlarm();
  }
  tasks = tasks.map(function (task) {
    if (task.id === id) {
      task.done = !task.done;
    }
    return task;
  });
  saveTasks();
  renderTasks();
}

function deleteTask(id) {
  if (!confirm("Delete this task?")) {
    return;
  }
  tasks = tasks.filter(function (task) {
    return task.id !== id;
  });
  if (editingId === id) {
    resetForm();
  }
  saveTasks();
  renderTasks();
}

// Put a task into the form so it can be edited
function startEdit(task) {
  editingId = task.id;
  titleInput.value = task.title;
  datePicker.setDate(task.date || null);
  startPicker.setDate(task.startTime || null);
  alarmInput.checked = !!task.alarm;
  updateAlarmNote();
  categoryInput.value = task.category || "Office work";
  if (categoryInput.selectedIndex === -1) {
    // Old categories that no longer exist (e.g. "Deadline") fall back to Office work
    categoryInput.value = "Office work";
  }
  notesInput.value = task.notes || "";
  submitBtn.textContent = "Save changes";
  cancelBtn.classList.remove("hidden");
  titleInput.focus();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// Return the form to "add" mode
function resetForm() {
  editingId = null;
  form.reset();
  datePicker.clear();
  startPicker.clear();
  submitBtn.textContent = "Add task";
  cancelBtn.classList.add("hidden");
  updateAlarmNote();
}

// ---------- Filter, search and sort ----------

function sortTasks(list) {
  const sorted = list.slice();
  const mode = sortSelect.value;

  if (mode === "due") {
    // Tasks without a date go to the end
    sorted.sort(function (a, b) {
      return whenKey(a).localeCompare(whenKey(b));
    });
  } else if (mode === "oldest") {
    sorted.sort(function (a, b) {
      return a.id - b.id;
    });
  } else if (mode === "title") {
    sorted.sort(function (a, b) {
      return a.title.localeCompare(b.title, undefined, { sensitivity: "base" });
    });
  } else {
    sorted.sort(function (a, b) {
      return b.id - a.id;
    });
  }
  return sorted;
}

function getVisibleTasks() {
  const query = searchInput.value.trim().toLowerCase();

  let list = tasks.filter(function (task) {
    if (currentFilter === "active") {
      return !task.done;
    }
    if (currentFilter === "completed") {
      return task.done;
    }
    if (currentFilter === "today") {
      return task.date === todayString();
    }
    if (currentFilter === "schedule") {
      return scheduleCategories.includes(task.category);
    }
    return true;
  });

  list = list.filter(function (task) {
    return task.title.toLowerCase().includes(query) ||
      (task.notes || "").toLowerCase().includes(query);
  });

  return sortTasks(list);
}

// ---------- Drawing the page ----------

function updateStats() {
  const total = tasks.length;
  const done = tasks.filter(function (t) { return t.done; }).length;
  const overdue = tasks.filter(function (t) { return getDueStatus(t) === "overdue"; }).length;
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);

  document.getElementById("stat-total").textContent = total;
  document.getElementById("stat-done").textContent = done;
  document.getElementById("stat-pending").textContent = total - done;
  document.getElementById("stat-overdue").textContent = overdue;
  document.getElementById("stat-overdue").parentElement.classList.toggle("has-overdue", overdue > 0);
  document.getElementById("progress-bar").style.width = percent + "%";
  document.getElementById("progress-text").textContent = percent + "% completed";

  // Show a check mark beside Total once every task is done
  const allDone = total > 0 && done === total;
  document.getElementById("complete-check").classList.toggle("hidden", !allDone);
  document.getElementById("stat-total-box").classList.toggle("complete", allDone);
}

function createBadge(text, extraClass) {
  const badge = document.createElement("span");
  badge.className = "badge" + (extraClass ? " " + extraClass : "");
  badge.textContent = text;
  return badge;
}

function renderTasks() {
  taskList.innerHTML = "";
  const visibleTasks = getVisibleTasks();

  if (visibleTasks.length === 0) {
    const empty = document.createElement("li");
    empty.className = "empty-message";
    empty.textContent = "No tasks to show.";
    taskList.appendChild(empty);
  }

  visibleTasks.forEach(function (task) {
    const li = document.createElement("li");
    li.className = "task-item" + (task.done ? " done" : "");

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = task.done;
    checkbox.addEventListener("change", function () {
      toggleTask(task.id);
    });

    const info = document.createElement("div");
    info.className = "task-info";

    const title = document.createElement("div");
    title.className = "task-title";
    title.textContent = task.title;

    const meta = document.createElement("div");
    meta.className = "task-meta";
    const category = task.category || "Study";
    meta.appendChild(createBadge(category, "cat-" + category.toLowerCase().replace(/\s+/g, "-")));

    const status = getDueStatus(task);
    if (status === "overdue") {
      meta.appendChild(createBadge("Overdue", "overdue"));
    } else if (status === "soon") {
      meta.appendChild(createBadge("Starts in " + minutesBetween(nowTimeString(), task.startTime) + " min", "soon"));
    } else if (status === "today") {
      meta.appendChild(createBadge("Today", "today"));
    }

    let whenText = task.date ? formatDate(task.date) : "No date";
    if (task.startTime) {
      whenText += ", " + formatTime(task.startTime);
    }
    meta.appendChild(document.createTextNode(whenText));
    if (task.alarm && task.startTime) {
      meta.appendChild(createBadge("\u{1F514} " + formatTime(task.startTime), "alarm" + (task.alarmRang || task.done ? " off" : "")));
    }

    info.appendChild(title);
    info.appendChild(meta);

    if (task.notes) {
      const notes = document.createElement("p");
      notes.className = "task-notes";
      notes.textContent = task.notes;
      info.appendChild(notes);
    }

    const actions = document.createElement("div");
    actions.className = "actions";

    const editBtn = document.createElement("button");
    editBtn.className = "edit-btn";
    editBtn.textContent = "Edit";
    editBtn.addEventListener("click", function () {
      startEdit(task);
    });

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "delete-btn";
    deleteBtn.textContent = "Delete";
    deleteBtn.addEventListener("click", function () {
      deleteTask(task.id);
    });

    actions.appendChild(editBtn);
    actions.appendChild(deleteBtn);

    li.appendChild(checkbox);
    li.appendChild(info);
    li.appendChild(actions);
    taskList.appendChild(li);
  });

  updateStats();
}

// ---------- Events ----------

form.addEventListener("submit", function (event) {
  event.preventDefault();

  const title = titleInput.value.trim();
  if (title === "") {
    return;
  }

  const startTime = startInput.value;
  const alarm = alarmInput.checked;
  if (alarm && !startTime) {
    alert("Please pick a start time for the alarm.");
    startPicker.open();
    return;
  }
  if (!dateInput.value) {
    alert("Please pick a date for this task.");
    datePicker.open();
    return;
  }

  if (alarm) {
    unlockAudio();
    enableBackgroundAlarms();
  }

  if (editingId !== null) {
    updateTask(editingId, title, dateInput.value, startTime, alarm, categoryInput.value, notesInput.value.trim());
  } else {
    addTask(title, dateInput.value, startTime, alarm, categoryInput.value, notesInput.value.trim());
  }

  saveTasks();
  resetForm();
  renderTasks();
});

cancelBtn.addEventListener("click", resetForm);

searchInput.addEventListener("input", renderTasks);
// Remember the chosen sort order between visits
const savedSort = localStorage.getItem("sort");
if (savedSort && sortSelect.querySelector('option[value="' + savedSort + '"]')) {
  sortSelect.value = savedSort;
}
sortSelect.addEventListener("change", function () {
  localStorage.setItem("sort", sortSelect.value);
  renderTasks();
});

filterButtons.forEach(function (button) {
  button.addEventListener("click", function () {
    currentFilter = button.dataset.filter;
    filterButtons.forEach(function (btn) {
      btn.classList.remove("active");
    });
    button.classList.add("active");
    renderTasks();
  });
});

// Remove all completed tasks
clearBtn.addEventListener("click", function () {
  const hasDone = tasks.some(function (task) { return task.done; });
  if (!hasDone) {
    alert("There are no completed tasks to clear.");
    return;
  }
  if (confirm("Remove all completed tasks?")) {
    tasks = tasks.filter(function (task) { return !task.done; });
    saveTasks();
    renderTasks();
  }
});

// Dark mode (remembered between visits)
function applyTheme(theme) {
  document.body.classList.toggle("dark", theme === "dark");
  themeBtn.textContent = theme === "dark" ? "Light mode" : "Dark mode";
  localStorage.setItem("theme", theme);
}

themeBtn.addEventListener("click", function () {
  const isDark = document.body.classList.contains("dark");
  applyTheme(isDark ? "light" : "dark");
});

// ---------- Alarm ----------

const alarmModal = document.getElementById("alarm-modal");
const alarmTaskText = document.getElementById("alarm-task");
const alarmTimeText = document.getElementById("alarm-time");
let audioCtx = null;
let beepTimer = null;
let ringingId = null;
const alarmQueue = [];       // other alarms waiting while one is ringing
const MISSED_LIMIT_MS = 10 * 60 * 1000; // don't ring alarms more than 10 min late

// Browsers only allow sound after the user has interacted with the page
function unlockAudio() {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) {
    return;
  }
  if (!audioCtx) {
    audioCtx = new Ctx();
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
}
document.addEventListener("click", unlockAudio);
document.addEventListener("keydown", unlockAudio);


// Play one "beep-beep-beep" pattern
function beepPattern() {
  if (!audioCtx) {
    return;
  }
  const start = audioCtx.currentTime;
  for (let i = 0; i < 3; i++) {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "square";
    osc.frequency.value = 880;
    const t = start + i * 0.25;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(t);
    osc.stop(t + 0.2);
  }
}

function alarmTimeMs(task) {
  const d = task.date.split("-"), t = task.startTime.split(":");
  const base = new Date(Number(d[0]), Number(d[1]) - 1, Number(d[2]), Number(t[0]), Number(t[1])).getTime();
  return task.snoozeUntil || base;
}

function ringAlarm(task) {
  ringingId = task.id;
  alarmTaskText.textContent = task.title;
  alarmTimeText.textContent = formatDate(task.date) + ", " + formatTime(task.startTime);
  alarmModal.classList.remove("hidden");
  unlockAudio();
  beepPattern();
  clearInterval(beepTimer);
  beepTimer = setInterval(beepPattern, 1200);
  if (navigator.vibrate) {
    navigator.vibrate([400, 200, 400, 200, 400]);
  }
  if ("Notification" in window && Notification.permission === "granted") {
    const options = {
      body: "Starts now – " + formatTime(task.startTime),
      tag: "task-" + task.id,
      icon: "/icon.svg"
    };
    if (swRegistration) {
      swRegistration.showNotification("\u{1F514} " + task.title, options);
    } else {
      try {
        new Notification("\u{1F514} " + task.title, options);
      } catch (e) { /* some browsers only allow notifications from a service worker */ }
    }
  }
}

function closeAlarm() {
  clearInterval(beepTimer);
  beepTimer = null;
  ringingId = null;
  alarmModal.classList.add("hidden");
  if (alarmQueue.length) {
    const next = tasks.find(function (t) { return t.id === alarmQueue.shift(); });
    if (next) {
      ringAlarm(next);
    }
  }
}

// Look for alarms that are due
function checkAlarms() {
  const now = Date.now();
  let changed = false;
  tasks.forEach(function (task) {
    if (!task.alarm || task.alarmRang || task.done || !task.date || !task.startTime) {
      return;
    }
    const when = alarmTimeMs(task);
    if (now < when) {
      return;
    }
    task.alarmRang = true;
    delete task.snoozeUntil;
    changed = true;
    if (now - when > MISSED_LIMIT_MS) {
      return; // too late, the page was closed when it was due
    }
    if (ringingId === null) {
      ringAlarm(task);
    } else if (ringingId !== task.id && !alarmQueue.includes(task.id)) {
      alarmQueue.push(task.id);
    }
  });
  if (changed) {
    saveTasks();
    renderTasks();
  }
}

document.getElementById("alarm-stop").addEventListener("click", closeAlarm);
document.getElementById("alarm-snooze").addEventListener("click", function () {
  const task = tasks.find(function (t) { return t.id === ringingId; });
  if (task) {
    task.alarmRang = false;
    task.snoozeUntil = Date.now() + 5 * 60 * 1000;
    saveTasks();
    renderTasks();
  }
  closeAlarm();
});

// ---------- Background alarms (work even when the browser is closed) ----------
// The browser registers for push notifications and sends the upcoming alarms
// to the server. A scheduled server job sends a notification when each one is due.

const alarmNote = document.getElementById("alarm-note");
let swRegistration = null;
let syncTimer = null;

const pushSupported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const isStandalone = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;

function urlBase64ToUint8Array(base64) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, function (c) { return c.charCodeAt(0); });
}

// Short status message shown under the start time when the alarm is switched on
function updateAlarmNote() {
  if (!alarmInput.checked) {
    alarmNote.classList.add("hidden");
    return;
  }
  let text;
  let ok = false;
  if (!pushSupported) {
    text = isIOS && !isStandalone
      ? "On iPhone/iPad: tap Share → “Add to Home Screen” and open the app from there to get alarms when it’s closed."
      : "This browser can’t show alarms when closed. The alarm rings while this page is open.";
  } else if (Notification.permission === "denied") {
    text = "Notifications are blocked. Allow them in your browser settings to get alarms when the browser is closed.";
  } else if (Notification.permission === "granted") {
    text = "✓ You’ll get a notification at the start time, even if the browser is closed.";
    ok = true;
  } else {
    text = "When you save, allow notifications so the alarm works even with the browser closed.";
  }
  alarmNote.textContent = text;
  alarmNote.classList.toggle("ok", ok);
  alarmNote.classList.remove("hidden");
}
alarmInput.addEventListener("change", updateAlarmNote);

async function registerServiceWorker() {
  if (!pushSupported) {
    return null;
  }
  try {
    swRegistration = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;
  } catch (e) {
    console.warn("Service worker registration failed", e);
    swRegistration = null;
  }
  return swRegistration;
}

// Ask for permission (needs a click/tap) and subscribe this device to push
async function enableBackgroundAlarms() {
  if (!pushSupported) {
    updateAlarmNote();
    return;
  }
  try {
    // requestPermission must be called straight away inside the user's click
    const permission = Notification.permission === "default"
      ? await Notification.requestPermission()
      : Notification.permission;
    updateAlarmNote();
    if (permission !== "granted") {
      return;
    }
    const reg = swRegistration || await registerServiceWorker();
    if (!reg) {
      return;
    }
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      const res = await fetch("/api/push/key");
      const data = await res.json();
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(data.publicKey)
      });
    }
    await syncAlarms();
  } catch (e) {
    console.warn("Could not enable background alarms", e);
  }
}

function scheduleAlarmSync() {
  clearTimeout(syncTimer);
  syncTimer = setTimeout(syncAlarms, 400);
}

// Send this device's upcoming alarms to the server
async function syncAlarms() {
  if (!swRegistration || Notification.permission !== "granted") {
    return;
  }
  try {
    const sub = await swRegistration.pushManager.getSubscription();
    if (!sub) {
      return;
    }
    const now = Date.now();
    const upcoming = tasks
      .filter(function (t) {
        return t.alarm && !t.done && !t.alarmRang && t.date && t.startTime;
      })
      .map(function (t) {
        return {
          taskId: String(t.id),
          title: t.title,
          body: "Starts now – " + formatTime(t.startTime) + (t.category ? " · " + t.category : ""),
          fireAt: new Date(alarmTimeMs(t)).toISOString()
        };
      })
      .filter(function (a) { return new Date(a.fireAt).getTime() > now; });

    await fetch("/api/push/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscription: sub.toJSON(), alarms: upcoming }),
      keepalive: true
    });
  } catch (e) {
    console.warn("Alarm sync failed", e);
  }
}

// A push arrived while the page is open: ring the in-page alarm too
if (pushSupported) {
  navigator.serviceWorker.addEventListener("message", function (event) {
    if (!event.data || event.data.type !== "alarm") {
      return;
    }
    const task = tasks.find(function (t) { return String(t.id) === String(event.data.taskId); });
    if (!task || task.done || ringingId === task.id) {
      return;
    }
    if (!task.alarmRang) {
      task.alarmRang = true;
      delete task.snoozeUntil;
      saveTasks();
      renderTasks();
      ringAlarm(task);
    }
  });
}

// Start the app
applyTheme(localStorage.getItem("theme") || "light");
renderTasks();
// Refresh "Starts in" and overdue labels every minute
setInterval(renderTasks, 60000);
// Register for background alarms, then send the current alarm list to the server
registerServiceWorker().then(syncAlarms);
// Check alarms every few seconds
checkAlarms();
setInterval(checkAlarms, 5000);
