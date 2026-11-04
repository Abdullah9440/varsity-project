// Load saved data
let tasks = JSON.parse(localStorage.getItem("tasks")) || [];
let currentFilter = "all"; // "all", "active" or "completed"
let editingId = null;      // id of the task being edited (null = adding a new task)

// Get elements from the page
const form = document.getElementById("task-form");
const titleInput = document.getElementById("task-title");
const dateInput = document.getElementById("task-date");
const startInput = document.getElementById("task-start");
const endInput = document.getElementById("task-end");
const categoryInput = document.getElementById("task-category");
const priorityInput = document.getElementById("task-priority");
const notesInput = document.getElementById("task-notes");
const submitBtn = document.getElementById("submit-btn");
const cancelBtn = document.getElementById("cancel-btn");
const searchInput = document.getElementById("search");
const sortSelect = document.getElementById("sort");
const taskList = document.getElementById("task-list");
const filterButtons = document.querySelectorAll(".filter-btn");
const clearBtn = document.getElementById("clear-btn");
const themeBtn = document.getElementById("theme-btn");

const priorityRank = { High: 0, Medium: 1, Low: 2 };

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
const endPicker = makeTimePicker(endInput);

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
}

// Today's date as YYYY-MM-DD (same format that is saved in tasks)
function todayString() {
  const d = new Date();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return d.getFullYear() + "-" + month + "-" + day;
}

// Returns "overdue", "live", "soon", "today" or "" for a task
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
    const finish = task.endTime || task.startTime;
    if (finish && now > finish) {
      return "overdue";
    }
    if (task.startTime && task.endTime && now >= task.startTime) {
      return "live";
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

function addTask(title, date, startTime, endTime, category, priority, notes) {
  tasks.push({
    id: Date.now(),
    title: title,
    date: date,
    startTime: startTime,
    endTime: endTime,
    category: category,
    priority: priority,
    notes: notes,
    done: false
  });
}

function updateTask(id, title, date, startTime, endTime, category, priority, notes) {
  tasks = tasks.map(function (task) {
    if (task.id === id) {
      task.title = title;
      task.date = date;
      task.startTime = startTime;
      task.endTime = endTime;
      task.category = category;
      task.priority = priority;
      task.notes = notes;
    }
    return task;
  });
}

function toggleTask(id) {
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
  endPicker.setDate(task.endTime || null);
  categoryInput.value = task.category || "Office work";
  priorityInput.value = task.priority;
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
  endPicker.clear();
  priorityInput.value = "Medium";
  submitBtn.textContent = "Add task";
  cancelBtn.classList.add("hidden");
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
  } else if (mode === "priority") {
    // High first; same priority -> soonest due date first
    sorted.sort(function (a, b) {
      const diff = priorityRank[a.priority] - priorityRank[b.priority];
      if (diff !== 0) {
        return diff;
      }
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
  document.getElementById("progress-bar").style.width = percent + "%";
  document.getElementById("progress-text").textContent = percent + "% completed";
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
    li.className = "task-item priority-" + task.priority + (task.done ? " done" : "");

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
    } else if (status === "live") {
      meta.appendChild(createBadge("In progress", "live"));
    } else if (status === "soon") {
      meta.appendChild(createBadge("Starts in " + minutesBetween(nowTimeString(), task.startTime) + " min", "soon"));
    } else if (status === "today") {
      meta.appendChild(createBadge("Today", "today"));
    }

    let whenText = task.date ? formatDate(task.date) : "No date";
    if (task.startTime) {
      whenText += ", " + formatTime(task.startTime);
      if (task.endTime) {
        whenText += " – " + formatTime(task.endTime);
      }
    }
    meta.appendChild(document.createTextNode(whenText + " | " + task.priority));

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
  const endTime = endInput.value;
  if (startTime && endTime && endTime <= startTime) {
    alert("End time must be after the start time.");
    return;
  }
  if ((startTime || endTime) && !dateInput.value) {
    alert("Please pick a date for this time.");
    return;
  }

  if (editingId !== null) {
    updateTask(editingId, title, dateInput.value, startTime, endTime, categoryInput.value, priorityInput.value, notesInput.value.trim());
  } else {
    addTask(title, dateInput.value, startTime, endTime, categoryInput.value, priorityInput.value, notesInput.value.trim());
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

// Start the app
applyTheme(localStorage.getItem("theme") || "light");
renderTasks();
// Refresh "Starts in", "In progress" and overdue labels every minute
setInterval(renderTasks, 60000);
