// STUDYUP - CORE SYSTEM

const $ = id => document.getElementById(id);

// Sistema de notificaciones toast no bloqueante
function showToast(message) {
  let toast = $("appToast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "appToast";
    toast.style.cssText = `
      position: fixed;
      bottom: 80px;
      left: 50%;
      transform: translateX(-50%);
      background: #1f2a3d;
      color: #fff;
      padding: 10px 18px;
      border-radius: 20px;
      box-shadow: 0 4px 14px rgba(0,0,0,0.4);
      font-size: 13px;
      z-index: 1000;
      pointer-events: none;
      transition: opacity 0.3s ease;
    `;
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.style.opacity = "1";
  clearTimeout(toast.timeout);
  toast.timeout = setTimeout(() => {
    toast.style.opacity = "0";
  }, 2500);
}

// Estructura y persistencia de datos
const defaultData = {
  xp: 0,
  sessions: [],
  subjects: [
    { id: 1, name: "Anatomía", color: "#4aa3ff", minutes: 0 },
    { id: 2, name: "Histología", color: "#7c6cff", minutes: 0 },
    { id: 3, name: "Embriología", color: "#e8b95c", minutes: 0 }
  ],
  cards: [],
  activeDays: []
};

let data;

try {
  const saved = localStorage.getItem("studyupData");
  data = saved ? { ...defaultData, ...JSON.parse(saved) } : structuredClone(defaultData);
} catch {
  data = structuredClone(defaultData);
}

// Estado del cronómetro preciso
let elapsed = 0;
let startTime = null;
let timerRaf = null;
let running = false;
let selectedCard = 0;

function saveData() {
  localStorage.setItem("studyupData", JSON.stringify(data));
}

function formatTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;

  return [h, m, s]
    .map(n => String(n).padStart(2, "0"))
    .join(":");
}

function updateTimer() {
  $("timer").textContent = formatTime(elapsed);
  $("saveBtn").disabled = elapsed < 60;
}

function runTimerLoop() {
  if (!running) return;

  const now = Date.now();
  const delta = Math.floor((now - startTime) / 1000);
  elapsed += delta;
  startTime = now;

  updateTimer();
  timerRaf = setTimeout(runTimerLoop, 1000);
}

function startTimer() {
  if (running) {
    running = false;
    clearTimeout(timerRaf);
    $("startBtn").textContent = "▶ Continuar";
    return;
  }

  running = true;
  startTime = Date.now();
  $("startBtn").textContent = "Ⅱ Pausar";
  runTimerLoop();
}

function resetTimer() {
  running = false;
  clearTimeout(timerRaf);
  elapsed = 0;

  $("startBtn").textContent = "▶ Iniciar sesión";
  updateTimer();
}

function saveSession() {
  const subjectId = Number($("subjectSelect").value);
  const subject = data.subjects.find(s => s.id === subjectId);

  if (!subject) {
    showToast("Seleccioná una materia válida.");
    return;
  }

  if (elapsed < 60) {
    showToast("Estudiá al menos 1 minuto para registrar la sesión.");
    return;
  }

  const minutes = Math.floor(elapsed / 60);
  const xpEarned = minutes * 2;

  subject.minutes += minutes;
  data.xp += xpEarned;

  data.sessions.unshift({
    subject: subject.name,
    minutes,
    xp: xpEarned,
    date: new Date().toISOString()
  });

  const today = new Date().toDateString();
  if (!data.activeDays.includes(today)) {
    data.activeDays.push(today);
  }

  saveData();
  resetTimer();
  render();

  showToast(`¡Sesión guardada! Ganaste +${xpEarned} XP`);
}

function getRank(hours) {
  const ranks = [
    [35, "GRAN MAESTRO"],
    [30, "MAESTRO"],
    [26, "DIAMANTE"],
    [22, "PLATINO"],
    [18, "ORO I"],
    [16, "ORO II"],
    [14, "ORO III"],
    [12, "PLATA I"],
    [10, "PLATA II"],
    [8, "PLATA III"],
    [6, "BRONCE I"],
    [5, "BRONCE II"],
    [4, "BRONCE III"],
    [3, "HIERRO I"],
    [2, "HIERRO II"],
    [1, "HIERRO III"]
  ];

  for (const [limit, name] of ranks) {
    if (hours >= limit) return name;
  }

  return "HIERRO III";
}

function getWeekMinutes() {
  const now = new Date();
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);

  const day = monday.getDay();
  monday.setDate(monday.getDate() - (day === 0 ? 6 : day - 1));

  return data.sessions
    .filter(session => new Date(session.date) >= monday)
    .reduce((sum, session) => sum + session.minutes, 0);
}

function calculateStreak() {
  const days = new Set(data.activeDays);
  let streak = 0;
  const date = new Date();

  // Si hoy no se estudió todavía, comprobar si ayer estuvo activo
  if (!days.has(date.toDateString())) {
    date.setDate(date.getDate() - 1);
  }

  while (days.has(date.toDateString())) {
    streak++;
    date.setDate(date.getDate() - 1);
  }

  return streak;
}

function renderStats() {
  const weeklyMinutes = getWeekMinutes();
  const weeklyHours = weeklyMinutes / 60;

  $("totalXp").textContent = data.xp;
  $("level").textContent = Math.floor(data.xp / 500) + 1;
  $("nextLevel").textContent = `${500 - (data.xp % 500)} XP para subir`;

  $("overallRank").textContent = getRank(weeklyHours);
  $("weeklyHours").textContent = `${weeklyHours.toFixed(1)} h esta semana`;
  $("streak").textContent = calculateStreak();
}

function renderSubjects() {
  const select = $("subjectSelect");
  const list = $("subjectsList");

  select.innerHTML = "";
  list.innerHTML = "";

  data.subjects.forEach(subject => {
    // Opción para el selector del cronómetro
    const option = document.createElement("option");
    option.value = subject.id;
    option.textContent = subject.name;
    select.appendChild(option);

    // Tarjeta visual en el listado de materias
    const hours = (subject.minutes / 60).toFixed(1);
    const item = document.createElement("div");
    item.className = "subject-card";
    item.style.borderLeft = `4px solid ${subject.color}`;

    const title = document.createElement("strong");
    title.textContent = subject.name;

    const subtitle = document.createElement("p");
    subtitle.className = "muted";
    subtitle.textContent = `${hours} horas estudiadas`;

    const rankBadge = document.createElement("small");
    rankBadge.textContent = getRank(subject.minutes / 60);

    item.append(title, subtitle, rankBadge);
    list.appendChild(item);
  });
}

function renderMissions() {
  const minutes = getWeekMinutes();
  const missions = [
    { title: "Estudiá 2 horas", goal: 120 },
    { title: "Estudiá 5 horas", goal: 300 },
    { title: "Estudiá 10 horas", goal: 600 }
  ];

  const container = $("missions");
  container.innerHTML = "";
  let completed = 0;

  missions.forEach(mission => {
    const done = minutes >= mission.goal;
    if (done) completed++;

    const item = document.createElement("div");
    item.className = "mission-item";

    const title = document.createElement("strong");
    title.textContent = `${done ? "✓ " : "○ "}${mission.title}`;

    const progress = document.createElement("p");
    progress.className = "muted";
    progress.textContent = `${Math.min(minutes, mission.goal)} / ${mission.goal} minutos`;

    item.append(title, progress);
    container.appendChild(item);
  });

  $("missionCount").textContent = `${completed}/3`;
}

function renderHistory() {
  const history = $("sessionHistory");
  history.innerHTML = "";

  if (!data.sessions.length) {
    history.textContent = "Todavía no tenés sesiones registradas.";
    return;
  }

  data.sessions.slice(0, 5).forEach(session => {
    const item = document.createElement("div");
    item.className = "history-item";
    item.textContent = `${session.subject} · ${session.minutes} min · +${session.xp} XP`;
    history.appendChild(item);
  });
}

function renderFlashcards() {
  if (!data.cards.length) {
    $("cardQuestion").textContent = "Añadí una flashcard para comenzar.";
    $("cardAnswer").textContent = "";
    $("cardAnswer").classList.add("hidden");
    return;
  }

  if (selectedCard >= data.cards.length) {
    selectedCard = 0;
  }

  const card = data.cards[selectedCard];
  $("cardQuestion").textContent = card.front;
  $("cardAnswer").textContent = card.back;
  $("cardAnswer").classList.add("hidden");
}

function render() {
  renderStats();
  renderSubjects();
  renderMissions();
  renderHistory();
  renderFlashcards();
}

// EVENT LISTENERS

$("startBtn").addEventListener("click", startTimer);
$("resetBtn").addEventListener("click", resetTimer);
$("saveBtn").addEventListener("click", saveSession);

$("addSubject").addEventListener("click", () => {
  $("subjectDialog").showModal();
});

$("manageSubjects").addEventListener("click", () => {
  $("subjectDialog").showModal();
});

$("subjectForm").addEventListener("submit", event => {
  event.preventDefault();
  const name = $("subjectName").value.trim();

  if (!name) return;

  data.subjects.push({
    id: Date.now(),
    name,
    color: $("subjectColor").value,
    minutes: 0
  });

  saveData();
  $("subjectDialog").close();
  $("subjectForm").reset();
  render();
  showToast("¡Materia agregada correctamente!");
});

$("addCard").addEventListener("click", () => {
  $("cardDialog").showModal();
});

$("cardForm").addEventListener("submit", event => {
  event.preventDefault();

  const front = $("cardFront").value.trim();
  const back = $("cardBack").value.trim();

  if (!front || !back) {
    showToast("Completá tanto la pregunta como la respuesta.");
    return;
  }

  data.cards.push({ front, back });
  selectedCard = data.cards.length - 1;

  saveData();
  $("cardDialog").close();
  $("cardForm").reset();
  renderFlashcards();
  showToast("¡Flashcard creada!");
});

$("flipCard").addEventListener("click", () => {
  if (!data.cards.length) return;
  $("cardAnswer").classList.toggle("hidden");
});

$("nextCard").addEventListener("click", () => {
  if (!data.cards.length) return;
  selectedCard = (selectedCard + 1) % data.cards.length;
  renderFlashcards();
});

// Gestión y persistencia del tema visual
const savedTheme = localStorage.getItem("studyupTheme");
if (savedTheme === "light") {
  document.body.classList.add("light-mode");
}

$("themeBtn").addEventListener("click", () => {
  const isLight = document.body.classList.toggle("light-mode");
  localStorage.setItem("studyupTheme", isLight ? "light" : "dark");
});

// Advertencia al intentar salir si hay estudio en curso
window.addEventListener("beforeunload", event => {
  if (running && elapsed >= 60) {
    event.preventDefault();
    event.returnValue = "";
  }
});

// Registro de Service Worker para capacidades PWA
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(console.error);
  });
}

// Inicialización
render();
updateTimer();
