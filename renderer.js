document.addEventListener('DOMContentLoaded', () => {
  // ---------- Intro Title Click ----------
  const introTitle = document.getElementById('intro-title');
  const appEl = document.getElementById('app');
  introTitle.addEventListener('click', () => {
    introTitle.style.display = 'none';
    appEl.classList.remove('hidden');
  });

  // ---------- State ----------
  let lists = [];
  let tasks = [];
  let alertedTaskIds = new Set(); // avoid re-alerting same overdue task this session

  // ---------- Elements ----------
  const progressContainer = document.getElementById('progress-container');
  const taskListEl        = document.getElementById('task-list');

  const addBtn       = document.getElementById('add-btn');
  const addMenu      = document.getElementById('add-menu');
  const addTaskBtn   = document.getElementById('add-task-btn');
  const addListBtn   = document.getElementById('add-list-btn');

  const taskForm     = document.getElementById('task-form');
  const taskNameIn   = document.getElementById('task-name');
  const taskDueIn    = document.getElementById('task-due');
  const taskReminder = document.getElementById('task-reminder');
  const taskListSel  = document.getElementById('task-list-select');
  const saveTaskBtn  = document.getElementById('save-task');
  const cancelTask   = document.getElementById('cancel-task');

  const listForm     = document.getElementById('list-form');
  const listNameIn   = document.getElementById('list-name');
  const colorOptions = document.getElementById('color-options');
  const saveListBtn  = document.getElementById('save-list');
  const cancelList   = document.getElementById('cancel-list');

  const alertScreen  = document.getElementById('alert-screen');
  const alertCard    = document.getElementById('alert-card');
  const alertDone    = document.getElementById('alert-done');

  // ---------- Preset list colors ----------
  const presetColors = [
    "#ff4d6d", "#ffb84d", "#4dff4d", "#4db8ff", "#b84dff",
    "#ff4dff", "#ffff4d", "#b8ff4d", "#4dffff", "#ff944d"
  ];

  // Build color choices
  function buildColorChoices() {
    colorOptions.innerHTML = "";
    const usedColors = new Set(lists.map(l => l.color));
    presetColors.forEach((hex, idx) => {
      const swatch = document.createElement('div');
      swatch.className = "color-choice";
      swatch.style.backgroundColor = hex;
      swatch.dataset.color = hex;
      if (usedColors.has(hex)) {
        swatch.classList.add('disabled');
        swatch.style.opacity = "0.3";
        swatch.style.pointerEvents = "none";
      } else {
        swatch.addEventListener('click', () => {
          document.querySelectorAll('.color-choice').forEach(c => c.classList.remove('selected'));
          swatch.classList.add('selected');
        });
        if (colorOptions.querySelector('.color-choice.selected') === null && idx === 0) {
          swatch.classList.add('selected');
        }
      }
      colorOptions.appendChild(swatch);
    });
  }

  function ensureDefaultList() {
    if (lists.length === 0) {
      lists.push({ id: genId(), name: "Default", color: presetColors[0] });
    }
  }

  function refreshTaskListSelect() {
    taskListSel.innerHTML = "";
    lists.forEach(l => {
      const opt = document.createElement('option');
      opt.value = l.id;
      opt.textContent = l.name;
      taskListSel.appendChild(opt);
    });
  }

  function closeForms() {
    taskForm.classList.add('hidden');
    listForm.classList.add('hidden');
  }

  function genId() {
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
  }

  function formatDT(dtStr) {
    const d = new Date(dtStr);
    if (isNaN(d)) return dtStr;
    return d.toLocaleString();
  }

  function getDarkColor(hex) {
    const rgb = hex.replace('#','').match(/.{2}/g).map(x => parseInt(x,16));
    const dark = rgb.map(c => Math.round(c * 0.4));
    return `rgb(${dark.join(',')})`;
  }

  function renderProgress() {
    progressContainer.innerHTML = "";
    lists.slice(0, 3).forEach(list => {
      const listTasks = tasks.filter(t => t.listId === list.id);
      const done      = listTasks.filter(t => t.completed).length;
      const pct       = listTasks.length ? Math.round((done / listTasks.length) * 100) : 0;

      const group = document.createElement('div');
      group.className = "progress-group";

      const circle = document.createElement('div');
      circle.className = "pixel-circle";
  const color = list.color;
  const darkColor = getDarkColor(color);
  circle.style.setProperty('--ring-gradient', `conic-gradient(${color} 0% ${pct}%, ${darkColor} ${pct}%, ${darkColor} 100%)`);

      const pctEl = document.createElement('div');
      pctEl.className = "pct";
      pctEl.textContent = `${pct}%`;
      circle.appendChild(pctEl);

      const nameEl = document.createElement('div');
      nameEl.className = "progress-list-name";
      nameEl.textContent = list.name;

      group.appendChild(circle);
      group.appendChild(nameEl);
      progressContainer.appendChild(group);
    });
  }

  function renderTasks() {
    taskListEl.innerHTML = "";
    const incompletes = tasks.filter(t => !t.completed)
      .sort((a, b) => new Date(a.due) - new Date(b.due) || a.createdAt - b.createdAt);
    const completes = tasks.filter(t => t.completed)
      .sort((a, b) => new Date(a.due) - new Date(b.due) || a.createdAt - b.createdAt);
    const ordered = [...incompletes, ...completes];

    ordered.forEach(task => {
      const list = lists.find(l => l.id === task.listId);
      const card = document.createElement('div');
      card.className = "task-card";
      if (task.completed) card.classList.add('completed');
      card.style.background = list ? list.color : "#555";

      const title = document.createElement('div');
      title.className = "task-title";
      title.textContent = task.name;

      const due = document.createElement('div');
      due.className = "task-due";
      due.textContent = formatDT(task.due);

      card.addEventListener('click', () => {
        task.completed = !task.completed;
        renderTasks();
        renderProgress();
        setTimeout(checkDueTasks, 0);
      });

      card.appendChild(title);
      card.appendChild(due);
      taskListEl.appendChild(card);
    });
  }

  // ---------- Alert logic ----------
  function checkDueTasks() {
    const now = new Date();
    const dueTasks = tasks.filter(t => !t.completed && new Date(t.due) <= now);

    if (dueTasks.length === 0) {
      alertScreen.classList.add('hidden');
      return;
    }

    let taskToAlert = dueTasks.find(t => !alertedTaskIds.has(t.id));
    if (!taskToAlert) {
      alertScreen.classList.add('hidden'); // ensure hide if all already alerted
      return;
    }

    alertCard.innerHTML = `
      <h3 style="margin:0 0 10px;">${taskToAlert.name}</h3>
      <div>${formatDT(taskToAlert.due)}</div>
    `;
    alertScreen.classList.remove('hidden');
    alertedTaskIds.add(taskToAlert.id);
  }

  alertDone.addEventListener('click', () => {
    alertScreen.classList.add('hidden');
  });

  // ---------- Add menu ----------
  addBtn.addEventListener('click', () => {
    addMenu.classList.remove('hidden');
  });

  addTaskBtn.addEventListener('click', () => {
    ensureDefaultList();
    refreshTaskListSelect();
    taskNameIn.value = "";
    taskDueIn.value  = "";
    taskReminder.value = "";
    taskForm.classList.remove('hidden');
    addMenu.classList.add('hidden');
  });

  addListBtn.addEventListener('click', () => {
    listNameIn.value = "";
    buildColorChoices();
    listForm.classList.remove('hidden');
    addMenu.classList.add('hidden');
  });

  saveTaskBtn.addEventListener('click', () => {
    const name = taskNameIn.value.trim();
    const due  = taskDueIn.value;
    if (!name || !due) {
      alert("Please enter a task name and due date/time.");
      return;
    }
    const listId = taskListSel.value || (lists[0] && lists[0].id);
    tasks.push({
      id: genId(),
      name,
      due,
      reminder: taskReminder.value || "",
      listId,
      createdAt: Date.now(),
      completed: false
    });
    closeForms();
    renderTasks();
    renderProgress();
    checkDueTasks();
  });

  cancelTask.addEventListener('click', () => closeForms());

  saveListBtn.addEventListener('click', () => {
    const name = listNameIn.value.trim();
    const selected = colorOptions.querySelector('.color-choice.selected');
    if (!name || !selected) {
      alert("Please enter a list name and pick a color.");
      return;
    }
    lists.push({
      id: genId(),
      name,
      color: selected.dataset.color
    });
    closeForms();
    refreshTaskListSelect();
    renderProgress();
  });

  cancelList.addEventListener('click', () => closeForms());

  // ---------- Initial boot ----------
  ensureDefaultList();
  buildColorChoices();
  refreshTaskListSelect();
  renderProgress();
  renderTasks();

  setInterval(checkDueTasks, 30000);
});
